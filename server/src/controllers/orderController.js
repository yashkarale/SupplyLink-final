import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Seller from '../models/Seller.js';

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

  return {
    name,
    phone,
    email: String(payload.email || '').trim(),
    city: String(payload.city || '').trim(),
    postalCode: String(payload.postalCode || '').trim(),
    address,
    notes: String(payload.notes || '').trim(),
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
    const slug = String(req.params.slug || '').trim();

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

    const productIds = items.map((item) => String(item.productId || ''));
    const products = await Product.find({
      _id: { $in: productIds },
      sellerId: seller.userId,
      isPublished: true,
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

    const shippingAmount = Number(req.body?.shippingAmount || 0);
    const discountAmount = Number(req.body?.discountAmount || 0);
    const totalAmount = Math.max(0, subtotal + shippingAmount - discountAmount);

    const session = await mongoose.startSession();

    try {
      let createdOrder;

      await session.withTransaction(async () => {
        for (const change of stockUpdateQueue) {
          await Product.updateOne(
            { _id: change.productId, sellerId: seller.userId },
            { $inc: { stock: -change.quantity } },
            { session }
          );
        }

        createdOrder = await Order.create(
          [{
            sellerId: seller.userId,
            orderReference: generateOrderReference(),
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

      return res.status(201).json({
        success: true,
        message: 'Order placed successfully',
        order: createdOrder[0],
      });
    } catch (error) {
      console.error('Create public order error:', error.message);
      return res.status(500).json({
        success: false,
        message: 'Unable to place order',
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
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      sellerId: req.user.userId,
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    const nextStatus = String(req.body.orderStatus || order.orderStatus || 'PENDING').toUpperCase();
    const nextPaymentStatus = req.body.paymentStatus
      ? String(req.body.paymentStatus).toUpperCase()
      : order.paymentStatus;

    validateOrderStatusTransition(order.orderStatus, nextStatus);

    const previousStatus = order.orderStatus;
    order.orderStatus = nextStatus;
    order.paymentStatus = nextPaymentStatus;

    if (nextStatus === 'CANCELLED' && previousStatus !== 'CANCELLED') {
      for (const item of order.items) {
        const product = await Product.findOne({ _id: item.productId, sellerId: req.user.userId });

        if (product) {
          product.stock = Math.max(0, Number(product.stock || 0) + Number(item.quantity || 0));
          await product.save();
        }
      }
    }

    order.statusHistory.push({
      from: previousStatus,
      to: nextStatus,
      changedAt: new Date(),
    });

    await order.save();

    return res.status(200).json({
      success: true,
      message: 'Order status updated',
      order,
    });
  } catch (error) {
    console.error('Update seller order status error:', error.message);

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
  }
};
