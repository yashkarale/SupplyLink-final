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
import { createPrivateImageDownloadUrl, destroyCloudinaryImage, inspectUploadedImage, uploadImageToCloudinary } from '../services/mediaStorage.js';
import { createNotification } from './notificationController.js';

const isPaymentProofStorageConfigured = () => Boolean(
  process.env.API_PUBLIC_URL && process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET,
);

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

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

const deriveOrderSecret = (purpose, sellerId, requestId) => crypto
  .createHash("sha256")
  .update(`supplylink:${purpose}:${sellerId}:${requestId}`)
  .digest("base64url");

const sendExistingIdempotentOrder = async (res, sellerId, requestId) => {
  const order = await Order.findOne({ sellerId, clientRequestId: requestId }).lean();
  if (!order) return false;
  const trackingToken = deriveOrderSecret("tracking", sellerId, requestId);
  const paymentProofToken = order.paymentMethod === "WHATSAPP"
    ? deriveOrderSecret("payment-proof", sellerId, requestId)
    : undefined;
  res.status(200).json({
    success: true,
    message: "This order was already received.",
    order: { orderReference: order.orderReference, orderStatus: order.orderStatus, totalAmount: order.totalAmount },
    trackingToken,
    ...(paymentProofToken ? { paymentProofToken } : {}),
    emailDelivery: order.emailDelivery.map(({ recipient, status }) => ({ recipient, status })),
  });
  return true;
};

const normalizeCustomer = (customer) => {
  const payload = customer || {};
  const name = String(payload.name || '').trim();
  const phone = String(payload.phone || '').trim();
  const address = String(payload.address || '').trim();
  const postalCode = String(payload.postalCode || '').trim();

  if (!name || !phone || !address || !postalCode) {
    throw new Error('Customer name, phone, delivery address, and postal PIN code are required');
  }

  const email = String(payload.email || '').trim();
  if (name.length > 120 || phone.length > 32 || address.length > 500 || email.length > 254) {
    throw new Error('Customer details exceed the allowed length');
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Enter a valid email address');
  }
  if (!/^[+0-9() .-]{8,24}$/.test(phone) || phone.replace(/\D/g, '').length < 8) throw new Error('Enter a valid phone number');
  if (!/^\d{6}$/.test(postalCode)) throw new Error('Enter a valid 6-digit postal PIN code');

  return {
    name,
    phone,
    email,
    city: String(payload.city || '').trim().slice(0, 120),
    postalCode,
    address,
    notes: String(payload.notes || '').trim().slice(0, 500),
  };
};

const normalizePaymentMethod = (paymentMethod) => {
  const value = String(paymentMethod || 'COD').trim().toUpperCase();
  const allowed = ['COD', 'UPI', 'BANK_TRANSFER', 'CARD', 'WHATSAPP'];

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

    const requestId = String(req.body?.requestId || "");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
      return res.status(400).json({ success: false, message: "A valid checkout requestId is required." });
    }
    if (await sendExistingIdempotentOrder(res, seller.userId, requestId)) return;

    const paymentMethod = normalizePaymentMethod(req.body?.paymentMethod);
    if (paymentMethod === 'WHATSAPP' && !seller.paymentQrUrl) {
      return res.status(400).json({ success: false, message: 'This seller has not uploaded a payment QR yet.' });
    }
    if (paymentMethod === 'WHATSAPP' && !isPaymentProofStorageConfigured()) {
      return res.status(503).json({ success: false, message: 'Secure payment screenshot storage is not configured. No order was saved.' });
    }

    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const customer = normalizeCustomer(req.body?.customer);

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
    const trackingToken = deriveOrderSecret("tracking", seller.userId, requestId);
    const trackingTokenHash = crypto.createHash('sha256').update(trackingToken).digest('hex');
    const paymentProofToken = paymentMethod === 'WHATSAPP' ? deriveOrderSecret("payment-proof", seller.userId, requestId) : '';
    const paymentProofTokenHash = paymentProofToken ? crypto.createHash('sha256').update(paymentProofToken).digest('hex') : '';

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
            clientRequestId: requestId,
            orderReference: generateOrderReference(),
            trackingTokenHash,
            trackingTokenExpiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
            ...(paymentProofTokenHash ? {
              paymentProofTokenHash,
              paymentProofTokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
              paymentPendingUntil: new Date(Date.now() + 24 * 60 * 60 * 1000),
            } : {}),
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

        const persistedOrder = createdOrder[0];
        await createNotification({
          sellerId: seller.userId,
          type: "order_created",
          title: "New order received",
          message: `Order ${persistedOrder.orderReference} from ${customer.name} for ${formatCurrency(persistedOrder.totalAmount)}`,
          data: { orderReference: persistedOrder.orderReference, totalAmount: persistedOrder.totalAmount, customerName: customer.name },
          link: `/orders/${persistedOrder._id}`,
          session,
        });
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
        ...(paymentProofToken ? { paymentProofToken } : {}),
        emailDelivery: emailDelivery.map(({ recipient, status }) => ({ recipient, status })),
      });
    } catch (error) {
      console.error('Create public order error:', error.message);
      if (error.code === 11000 && await sendExistingIdempotentOrder(res, seller.userId, requestId)) return;
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

export const uploadPublicPaymentProof = async (req, res) => {
  let uploaded;
  try {
    const slug = normalizeStoreSlug(req.params.slug);
    const reference = String(req.params.reference || '');
    const token = String(req.query.token || '');
    if (!/^[A-Za-z0-9_-]{40,50}$/.test(token)) return res.status(404).json({ success: false, message: 'Payment upload link is invalid or expired.' });
    const seller = await Seller.findOne({ storeSlug: slug, isPublished: true, status: { $ne: 'suspended' } }).select('userId storeSlug').lean();
    if (!seller) return res.status(404).json({ success: false, message: 'Store not found.' });
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const order = await Order.findOne({
      sellerId: seller.userId,
      orderReference: reference,
      paymentMethod: 'WHATSAPP',
      paymentStatus: 'PENDING',
      orderStatus: 'PENDING',
      paymentProofTokenHash: tokenHash,
      paymentProofTokenExpiresAt: { $gt: new Date() },
    }).select('+paymentProofTokenHash +paymentProofTokenExpiresAt +paymentProofPublicId');
    if (!order) return res.status(409).json({ success: false, message: 'This order cannot accept a payment screenshot. Check the link or contact the seller.' });
    if (order.paymentProofUploadedAt && order.paymentProofPublicId) {
      return res.status(200).json({ success: true, alreadyUploaded: true, message: 'Screenshot is already saved for seller review.' });
    }

    const inspected = inspectUploadedImage(req.body, req.headers['content-type'], 'payment-proof');
    uploaded = await uploadImageToCloudinary({
      buffer: req.body,
      contentType: req.headers['content-type'],
      folder: 'supplylink/payment-proofs',
      publicId: `${order._id}-${crypto.randomUUID()}`,
      deliveryType: 'authenticated',
    });
    const result = await Order.updateOne({
      _id: order._id,
      paymentProofTokenHash: tokenHash,
      paymentProofUploadedAt: null,
      paymentStatus: 'PENDING',
    }, {
      $set: {
        paymentProofPublicId: uploaded.publicId,
        paymentProofFormat: uploaded.format,
        paymentProofUploadedAt: new Date(),
        paymentProofDeleteAfter: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      },
    });
    if (result.modifiedCount !== 1) {
      await destroyCloudinaryImage(uploaded.publicId, 'authenticated').catch((error) => console.error('Orphan payment screenshot cleanup failed:', error.message));
      return res.status(409).json({ success: false, message: 'A payment screenshot was already submitted for this order.' });
    }
    publishStoreEvent(seller.storeSlug, 'order.payment-proof-uploaded');
    return res.status(201).json({ success: true, message: 'Screenshot uploaded for seller review.', image: { width: inspected.width, height: inspected.height } });
  } catch (error) {
    console.error('Payment screenshot upload failed:', error.message);
    return res.status(error.status || 502).json({ success: false, message: error.message || 'Unable to upload the payment screenshot.' });
  }
};

export const getPublicPaymentProof = async (req, res) => {
  try {
    const slug = normalizeStoreSlug(req.params.slug);
    const reference = String(req.query.reference || '');
    const token = String(req.query.token || '');
    if (!/^[A-Za-z0-9_-]{40,50}$/.test(token)) return res.status(404).send('Payment screenshot link is invalid or expired.');
    const seller = await Seller.findOne({ storeSlug: slug, isPublished: true, status: { $ne: 'suspended' } }).select('userId').lean();
    if (!seller) return res.status(404).send('Store not found.');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const order = await Order.findOne({
      sellerId: seller.userId,
      orderReference: reference,
      paymentProofTokenHash: tokenHash,
      paymentProofTokenExpiresAt: { $gt: new Date() },
      paymentProofUploadedAt: { $ne: null },
    }).select('+paymentProofPublicId +paymentProofFormat').lean();
    if (!order?.paymentProofPublicId) return res.status(404).send('Payment screenshot link is invalid or expired.');
    const downloadUrl = createPrivateImageDownloadUrl({
      publicId: order.paymentProofPublicId,
      format: order.paymentProofFormat,
      expiresAt: Math.floor(Date.now() / 1000) + 10 * 60,
    });
    res.set('Cache-Control', 'private, no-store');
    return res.redirect(302, downloadUrl);
  } catch (error) {
    console.error('Public payment proof access failed:', error.message);
    return res.status(error.status || 500).send(error.message || 'Unable to open payment screenshot.');
  }
};

export const getSellerPaymentProof = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, message: 'Order not found.' });
  try {
    const order = await Order.findOne({ _id: req.params.id, sellerId: req.user.userId, paymentProofUploadedAt: { $ne: null } })
      .select('+paymentProofPublicId +paymentProofFormat').lean();
    if (!order?.paymentProofPublicId) return res.status(404).json({ success: false, message: 'Payment screenshot not found.' });
    const url = createPrivateImageDownloadUrl({ publicId: order.paymentProofPublicId, format: order.paymentProofFormat, expiresAt: Math.floor(Date.now() / 1000) + 5 * 60 });
    return res.status(200).json({ success: true, url, expiresInSeconds: 300 });
  } catch (error) {
    console.error('Seller payment proof access failed:', error.message);
    return res.status(error.status || 500).json({ success: false, message: error.message || 'Unable to open payment screenshot.' });
  }
};

export const confirmSellerManualPayment = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, message: 'Order not found.' });
  const session = await mongoose.startSession();
  try {
    let order;
    await session.withTransaction(async () => {
      order = await Order.findOne({ _id: req.params.id, sellerId: req.user.userId }).session(session);
      if (!order) throw Object.assign(new Error('Order not found.'), { status: 404 });
      if (order.paymentMethod !== 'WHATSAPP' || !order.paymentProofUploadedAt || order.paymentStatus !== 'PENDING' || order.orderStatus !== 'PENDING') {
        throw Object.assign(new Error('Only a pending WhatsApp order with an uploaded screenshot can be confirmed.'), { status: 409 });
      }
      order.paymentStatus = 'VERIFIED';
      order.paymentVerificationMethod = 'SELLER_MANUAL';
      order.paymentVerifiedAt = new Date();
      order.paymentVerifiedBy = req.user.userId;
      order.orderStatus = 'CONFIRMED';
      order.statusHistory.push({ from: 'PENDING', to: 'CONFIRMED', changedAt: new Date() });
      await order.save({ session });
    });
    return res.status(200).json({ success: true, message: 'Payment confirmation recorded by seller.', order });
  } catch (error) {
    return res.status(error.status || 500).json({ success: false, message: error.message || 'Unable to confirm payment.' });
  } finally {
    await session.endSession();
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

      if (order.paymentMethod === 'WHATSAPP' && order.paymentStatus !== 'VERIFIED' && nextStatus !== 'CANCELLED') {
        const paymentError = new Error('Check and confirm the WhatsApp payment before processing this order.');
        paymentError.status = 409;
        throw paymentError;
      }
      if (nextStatus === 'CANCELLED' && order.paymentStatus === 'VERIFIED') {
        const refundError = new Error('This order is paid. Record a refund before cancelling it.');
        refundError.status = 409;
        throw refundError;
      }

      const previousStatus = order.orderStatus;
      let cancellationClaimed = false;
      if (nextStatus === 'CANCELLED' && previousStatus !== 'CANCELLED') {
        const claim = await Order.updateOne(
          { _id: order._id, sellerId: req.user.userId, orderStatus: { $ne: 'CANCELLED' } },
          { $set: { orderStatus: 'CANCELLED' } },
          { session }
        );
        if (claim.modifiedCount !== 1) {
          const alreadyCancelled = new Error('Order is already cancelled.');
          alreadyCancelled.status = 409;
          throw alreadyCancelled;
        }
        cancellationClaimed = true;
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

      if (cancellationClaimed) {
        order.orderStatus = 'CANCELLED';
      } else {
        order.orderStatus = nextStatus;
      }
      if (nextStatus === 'CANCELLED' && order.paymentStatus === 'PENDING') order.paymentStatus = 'FAILED';
      order.statusHistory.push({ from: previousStatus, to: nextStatus, changedAt: new Date() });
      await order.save({ session });
      updatedOrder = order;

      await createNotification({
        sellerId: req.user.userId,
        type: "order_status_changed",
        title: "Order status updated",
        message: `Order ${order.orderReference} is now ${nextStatus.toLowerCase()}`,
        data: { orderReference: order.orderReference, orderStatus: nextStatus, previousStatus },
        link: `/orders/${order._id}`,
        session,
      });
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
    if (error.status === 409) return res.status(409).json({ success: false, message: error.message });
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
