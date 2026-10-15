import mongoose from 'mongoose';
import crypto from 'node:crypto';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Seller from '../models/Seller.js';
import { normalizeStoreSlug } from '../utils/storeSlug.js';
import { sendOrderEmail } from '../services/emailService.js';
import { applyEmailWebhookStatus } from '../services/emailWebhookService.js';
import { publishStoreEvent } from '../utils/storeEvents.js';
import { isDatabaseWriteLimitReached } from '../utils/storageUsage.js';
import { getProductLimitForSeller } from '../utils/planEntitlements.js';

export const VALID_ORDER_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'RETURNED',
];

export const VALID_ORDER_TRANSITIONS = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'CANCELLED'],
  DELIVERED: ['RETURNED'],
  CANCELLED: [],
  RETURNED: [],
};

export const validateOrderStatusTransition = (currentStatus, nextStatus) => {
  const current = String(currentStatus || 'PENDING').toUpperCase();
  const next = String(nextStatus || '').toUpperCase();

  if (!VALID_ORDER_STATUSES.includes(next)) {
    throw new Error(`Invalid order status: ${next}`);
  }

  if (current === next) {
    return true;
  }

  const allowedTransitions = VALID_ORDER_TRANSITIONS[current] || [];

  if (!allowedTransitions.includes(next)) {
    throw new Error(`Invalid order status transition: ${current} -> ${next}`);
  }

  return true;
};

const generateOrderReference = () =>
  `SL-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

const normalizeCustomer = (customer) => {
  const payload = customer || {};
  const name = String(payload.name || '').trim();
  const phone = String(payload.phone || '').trim();
  const address = String(payload.address || '').trim();

  if (!name || !phone || !address) {
    throw new Error('Customer name, phone, and address are required');
  }

  const email = String(payload.email || '').trim();
  if (name.length > 120 || phone.length > 32 || address.length > 500 || email.length > 254) {
    throw new Error('Customer details exceed the allowed length');
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Enter a valid email address');
  }

  return {
    name,
    phone,
    email,
    city: String(payload.city || '').trim().slice(0, 120),
    postalCode: String(payload.postalCode || '').trim().slice(0, 24),
    address,
    notes: String(payload.notes || '').trim().slice(0, 500),
  };
};

const normalizePaymentMethod = (paymentMethod) => {
  const value = String(paymentMethod || 'COD').trim().toUpperCase();
  const allowed = ['COD', 'UPI', 'BANK_TRANSFER', 'CARD'];

  if (!allowed.includes(value)) {
    throw new Error('Unsupported payment method');
  }

  return value;
};

export const createPublicOrder = async (req, res) => {
  try {
    const slug = normalizeStoreSlug(req.params.slug);

    if (!slug) {
      return res.status(400).json({
        success: false,
        message: 'Store slug is required',
      });
    }

    const seller = await Seller.findOne({
      storeSlug: slug,
      isPublished: true,
      status: { $ne: 'suspended' },
    }).lean();

    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Store not found or unavailable',
      });
    }

    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const customer = normalizeCustomer(req.body?.customer);
    const paymentMethod = normalizePaymentMethod(req.body?.paymentMethod);

    if (items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one product is required',
      });
    }
    if (items.length > 25) {
      return res.status(400).json({ success: false, message: 'An order can contain at most 25 different products.' });
    }

    let storageLimitReached;
    try {
      storageLimitReached = await isDatabaseWriteLimitReached(mongoose.connection.db);
    } catch (error) {
      console.error('Order storage check failed:', error.message);
      return res.status(503).json({
        success: false,
        message: 'Online order saving is temporarily unavailable. Please contact the seller directly.',
      });
    }
    if (storageLimitReached) {
      return res.status(503).json({
        success: false,
        message: 'This store cannot accept online orders right now. Please contact the seller directly.',
      });
    }

    const productIds = items.map((item) => String(item.productId || ''));
    const sellerProductLimit = getProductLimitForSeller(seller);
    let eligibleProductIds = productIds;
    if (sellerProductLimit !== null) {
      const visibleProducts = await Product.find({
        sellerId: seller.userId,
        isPublished: true,
        status: 'published',
      }).sort({ createdAt: -1 }).limit(sellerProductLimit).select('_id').lean();
      const visibleIds = new Set(visibleProducts.map((product) => String(product._id)));
      if (productIds.some((productId) => !visibleIds.has(productId))) {
        return res.status(400).json({ success: false, message: 'One or more products are not available on this seller plan.' });
      }
      eligibleProductIds = productIds.filter((productId) => visibleIds.has(productId));
    }
    const products = await Product.find({
      _id: { $in: eligibleProductIds },
      sellerId: seller.userId,
      isPublished: true,
      status: "published",
    }).lean();

    if (products.length !== productIds.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more products are unavailable',
      });
    }

    const productMap = new Map(products.map((product) => [String(product._id), product]));
    const snapshotItems = [];
    let subtotal = 0;
    const stockUpdateQueue = [];

    for (const item of items) {
      const productId = String(item.productId || '');
      const product = productMap.get(productId);
      const quantity = Number(item.quantity ?? 0);
      const variant = item.variant ? String(item.variant) : null;

      if (!product) {
        return res.status(400).json({
          success: false,
          message: 'One or more products are unavailable',
        });
      }

      if (!Number.isInteger(quantity) || quantity < 1) {
        return res.status(400).json({
          success: false,
          message: `Invalid quantity for ${product.name}`,
        });
      }

      if (Number(product.stock || 0) < quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.name}`,
        });
      }

      const lineTotal = Number(product.price || 0) * quantity;
      subtotal += lineTotal;
      stockUpdateQueue.push({ productId: product._id, quantity });

      snapshotItems.push({
        productId: product._id,
        name: product.name,
        variant,
        unitPrice: Number(product.price || 0),
        quantity,
        lineTotal,
      });
    }

    const shippingAmount = 0;
    const discountAmount = 0;
    const totalAmount = Math.max(0, subtotal + shippingAmount - discountAmount);
    const trackingToken = crypto.randomBytes(32).toString('base64url');
    const trackingTokenHash = crypto.createHash('sha256').update(trackingToken).digest('hex');

    const session = await mongoose.startSession();

    try {
      let createdOrder;

      await session.withTransaction(async () => {
        for (const change of stockUpdateQueue) {
          const result = await Product.updateOne(
            { _id: change.productId, sellerId: seller.userId, stock: { $gte: change.quantity }, isPublished: true },
            { $inc: { stock: -change.quantity } },
            { session }
          );
          if (result.modifiedCount !== 1) {
            const stockError = new Error("Stock changed while placing your order. Please refresh the store and try again.");
            stockError.status = 409;
            throw stockError;
          }
        }

        createdOrder = await Order.create(
          [{
            sellerId: seller.userId,
            orderReference: generateOrderReference(),
            trackingTokenHash,
            trackingTokenExpiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
            customer,
            items: snapshotItems,
            subtotal,
            shippingAmount,
            discountAmount,
            totalAmount,
            paymentMethod,
            paymentStatus: 'PENDING',
            orderStatus: 'PENDING',
            statusHistory: [{
              from: 'PENDING',
              to: 'PENDING',
              changedAt: new Date(),
            }],
          }],
          { session }
        );
      });

      publishStoreEvent(seller.storeSlug, 'catalog.updated');

      const persistedOrder = createdOrder[0];
      const emailDelivery = await Promise.all([
        sendOrderEmail({
          to: seller.email,
          subject: `New order ${persistedOrder.orderReference}`,
          order: persistedOrder,
          storeName: seller.businessName,
          idempotencyKey: `supplylink-${persistedOrder._id}-seller`,
        }).then((delivery) => ({ recipient: 'seller', ...delivery, updatedAt: new Date() })),
        customer.email
          ? sendOrderEmail({
              to: customer.email,
              subject: `Order request ${persistedOrder.orderReference} received`,
              order: persistedOrder,
              storeName: seller.businessName,
              trackingToken,
              idempotencyKey: `supplylink-${persistedOrder._id}-buyer`,
            }).then((delivery) => ({ recipient: 'buyer', ...delivery, updatedAt: new Date() }))
          : Promise.resolve({ recipient: 'buyer', status: 'skipped', updatedAt: new Date() }),
      ]);
      try {
        await Order.updateOne({ _id: persistedOrder._id }, { $set: { emailDelivery } });
        await Promise.all(emailDelivery.filter((delivery) => delivery.providerMessageId).map((delivery) => applyEmailWebhookStatus(delivery.providerMessageId)));
      } catch (emailStatusError) {
        console.error('Order email status could not be recorded:', emailStatusError.message);
      }

      return res.status(201).json({
        success: true,
        message: 'Order placed successfully',
        order: {
          orderReference: createdOrder[0].orderReference,
          orderStatus: createdOrder[0].orderStatus,
          totalAmount: createdOrder[0].totalAmount,
        },
        trackingToken,
        emailDelivery: emailDelivery.map(({ recipient, status }) => ({ recipient, status })),
      });
    } catch (error) {
      console.error('Create public order error:', error.message);
      return res.status(error.status || 500).json({
        success: false,
        message: error.status === 409 ? error.message : 'Unable to place order',
      });
    } finally {
      session.endSession();
    }
  } catch (error) {
    console.error('Create public order validation error:', error.message);
    return res.status(400).json({
      success: false,
      message: error.message || 'Unable to place order',
    });
  }
};

export const trackPublicOrder = async (req, res) => {
  try {
    const token = String(req.params.token || '');
    if (!/^[A-Za-z0-9_-]{40,50}$/.test(token)) {
      return res.status(404).json({ success: false, message: 'Order tracking link is invalid or expired' });
    }
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const now = new Date();
    const legacyTokenCutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const order = await Order.findOne({
      trackingTokenHash: tokenHash,
      $or: [
        { trackingTokenExpiresAt: { $gt: now } },
        { trackingTokenExpiresAt: null, createdAt: { $gt: legacyTokenCutoff } },
      ],
    })
      .select('orderReference orderStatus paymentStatus statusHistory items.name items.quantity createdAt')
      .lean();
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order tracking link is invalid or expired' });
    }
    return res.status(200).json({
      success: true,
      order: {
        reference: order.orderReference,
        status: order.orderStatus,
        paymentStatus: order.paymentStatus,
        createdAt: order.createdAt,
        items: order.items.map(({ name, quantity }) => ({ name, quantity })),
        history: order.statusHistory.map(({ from, to, changedAt }) => ({ from, to, changedAt })),
      },
    });
  } catch (error) {
    console.error('Public order tracking error:', error.message);
    return res.status(500).json({ success: false, message: 'Unable to retrieve order status' });
  }
};

export const getSellerOrders = async (req, res) => {
  try {
    const orders = await Order.find({ sellerId: req.user.userId }).sort({ createdAt: -1 }).lean();

    return res.status(200).json({
      success: true,
      orders,
    });
  } catch (error) {
    console.error('Get seller orders error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Unable to load orders',
    });
  }
};

export const updateSellerOrderStatus = async (req, res) => {
  if (Object.prototype.hasOwnProperty.call(req.body || {}, 'paymentStatus')) {
    return res.status(400).json({
      success: false,
      message: 'Payment status can only be updated by a verified payment provider.',
    });
  }

  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  const session = await mongoose.startSession();
  try {
    let updatedOrder;
    await session.withTransaction(async () => {
      const order = await Order.findOne({
        _id: req.params.id,
        sellerId: req.user.userId,
      }).session(session);

      if (!order) {
        const error = new Error('Order not found');
        error.status = 404;
        throw error;
      }

      const nextStatus = String(req.body.orderStatus || order.orderStatus || 'PENDING').toUpperCase();
      validateOrderStatusTransition(order.orderStatus, nextStatus);

      const previousStatus = order.orderStatus;
      if (nextStatus === 'CANCELLED' && previousStatus !== 'CANCELLED') {
        for (const item of order.items) {
          const result = await Product.updateOne(
            { _id: item.productId, sellerId: req.user.userId },
            { $inc: { stock: Number(item.quantity || 0) } },
            { session }
          );
          if (result.matchedCount !== 1) {
            throw new Error('An order product is no longer available; cancellation was not applied.');
          }
        }
      }

      order.orderStatus = nextStatus;
      order.statusHistory.push({ from: previousStatus, to: nextStatus, changedAt: new Date() });
      await order.save({ session });
      updatedOrder = order;
    });

    return res.status(200).json({
      success: true,
      message: 'Order status updated',
      order: updatedOrder,
    });
  } catch (error) {
    console.error('Update seller order status error:', error.message);

    if (error.status === 404) {
      return res.status(404).json({ success: false, message: error.message });
    }
    if (error.message && error.message.toLowerCase().includes('invalid order status')) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Unable to update order status',
    });
  } finally {
    await session.endSession();
  }
};
