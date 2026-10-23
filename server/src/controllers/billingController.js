import crypto from "node:crypto";
import Razorpay from "razorpay";
import Seller from "../models/Seller.js";
import SubscriptionPayment from "../models/SubscriptionPayment.js";
import SubscriptionCheckout from "../models/SubscriptionCheckout.js";
import RazorpayWebhookEvent from "../models/RazorpayWebhookEvent.js";
import { getPlanConfig } from "../config/subscriptionPlans.js";
import { isDatabaseWriteLimitReached } from "../utils/storageUsage.js";
import { createNotification } from "./notificationController.js";

export const addOneMonth = (fromDate = new Date()) => {
  const date = new Date(fromDate);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + 1);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return date;
};

export const isRazorpayConfigurationAllowed = ({ keyId, nodeEnv = process.env.NODE_ENV } = {}) =>
  Boolean(keyId) && (nodeEnv !== "staging" || keyId.startsWith("rzp_test_"));

const createRazorpayClient = () => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!isRazorpayConfigurationAllowed({ keyId }) || !keySecret) {
    return null;
  }

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
};

export const isCapturedSubscriptionPayment = ({ payment, order, plan, userId }) =>
  Boolean(
    payment &&
    order &&
    payment.status === "captured" &&
    payment.captured === true &&
    String(payment.order_id || "") === String(order.id || order.order_id || "") &&
    Number(payment.amount) === plan.amount &&
    payment.currency === plan.currency &&
    Number(order.amount) === plan.amount &&
    order.currency === plan.currency &&
    String(order.notes?.userId || "") === String(userId) &&
    String(order.notes?.plan || "") === plan.name
  );

export const verifyRazorpayWebhookSignature = ({ rawBody, signature, secret }) => {
  if (!Buffer.isBuffer(rawBody) || !rawBody.length || !signature || !secret || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest();
  const received = Buffer.from(signature, "hex");
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
};

const validRazorpayId = (value) => typeof value === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(value);

const applyCapturedPayment = async ({ orderId, payment, order, session }) => {
  const checkout = await SubscriptionCheckout.findOne({ razorpayOrderId: orderId }).session(session);
  if (!checkout) throw new Error("No server-created checkout matches this payment.");
  const existingPayment = await SubscriptionPayment.findOne({ razorpayPaymentId: payment.id }).session(session);
  if (existingPayment) {
    if (String(existingPayment.sellerId) !== String(checkout.sellerId) || existingPayment.razorpayOrderId !== orderId) {
      throw new Error("Payment is already associated with a different checkout.");
    }
    await SubscriptionCheckout.updateOne({ _id: checkout._id }, { $set: { status: "paid", razorpayPaymentId: payment.id } }, { session });
    return existingPayment;
  }
  const plan = getPlanConfig(checkout.plan);
  if (!isCapturedSubscriptionPayment({ payment, order, plan, userId: checkout.sellerId })) {
    throw new Error("Captured payment does not match the server-created checkout.");
  }

  const seller = await Seller.findOne({ userId: checkout.sellerId }).session(session);
  if (!seller) throw new Error("Seller account was not found for this checkout.");
  const paidAt = new Date(payment.created_at ? payment.created_at * 1000 : Date.now());
  const currentExpiry = seller.planExpiresAt ? new Date(seller.planExpiresAt) : null;
  const entitlementStartedAt = currentExpiry && currentExpiry > paidAt ? currentExpiry : paidAt;
  const entitlementExpiresAt = addOneMonth(entitlementStartedAt);

  const [savedPayment] = await SubscriptionPayment.create([{
    sellerId: checkout.sellerId,
    razorpayOrderId: orderId,
    razorpayPaymentId: payment.id,
    plan: plan.name,
    amount: plan.amount,
    currency: plan.currency,
    paidAt,
    entitlementStartedAt,
    entitlementExpiresAt,
  }], { session });
  await SubscriptionCheckout.updateOne({ _id: checkout._id }, {
    $set: { status: "paid", razorpayPaymentId: payment.id },
  }, { session });
  await Seller.updateOne({ _id: seller._id }, {
    $set: {
      plan: plan.name,
      subscriptionStatus: "active",
      lastOrderId: orderId,
      lastPaymentId: payment.id,
      planUpdatedAt: paidAt,
      planExpiresAt: entitlementExpiresAt,
    },
  }, { session });
  await createNotification({
    sellerId: checkout.sellerId,
    type: "subscription_activated",
    title: "Subscription activated",
    message: `Your ${plan.displayName || plan.name} plan is now active until ${new Date(entitlementExpiresAt).toLocaleDateString("en-IN")}.`,
    data: { plan: plan.name, amount: plan.amount, expiresAt: entitlementExpiresAt },
    link: `/billing`,
    session,
  });
  return savedPayment;
};

const applyRefund = async ({ payment, providerPayment, session }) => {
  const record = await SubscriptionPayment.findOne({ razorpayPaymentId: payment.id }).session(session);
  if (!record) throw new Error("Refund does not match a recorded Supply Link subscription payment.");
  const amountRefunded = Math.max(0, Number(providerPayment.amount_refunded || 0));
  await SubscriptionPayment.updateOne({ _id: record._id }, {
    $set: {
      refundedAmount: amountRefunded,
      ...(amountRefunded >= record.amount ? { refundedAt: new Date() } : {}),
    },
  }, { session });
  if (amountRefunded < record.amount) return;

  const seller = await Seller.findOne({ userId: record.sellerId }).session(session);
  if (!seller || seller.lastPaymentId !== record.razorpayPaymentId) return;
  const now = new Date();
  const replacement = await SubscriptionPayment.findOne({
    sellerId: record.sellerId,
    razorpayPaymentId: { $ne: record.razorpayPaymentId },
    refundedAt: null,
    entitlementExpiresAt: { $gt: now },
  }).sort({ entitlementExpiresAt: -1 }).session(session);
  await Seller.updateOne({ _id: seller._id }, replacement ? {
    $set: {
      plan: replacement.plan,
      subscriptionStatus: "active",
      lastOrderId: replacement.razorpayOrderId,
      lastPaymentId: replacement.razorpayPaymentId,
      planExpiresAt: replacement.entitlementExpiresAt,
      planUpdatedAt: now,
    },
  } : {
    $set: { plan: "free", subscriptionStatus: "inactive", planExpiresAt: null, planUpdatedAt: now, lastOrderId: "", lastPaymentId: "" },
  }, { session });
};

const buildBillingResponseForSeller = (seller) => {
  const legacyNames = { starter: "launch", pro: "scale" };
  const plan = legacyNames[seller?.plan] || seller?.plan || "free";
  const activePlan = getPlanConfig(plan);
  const paidPlan = activePlan.amount > 0;
  const isEntitlementActive = seller?.subscriptionStatus === "active"
    && seller?.planExpiresAt
    && new Date(seller.planExpiresAt).getTime() > Date.now();

  return {
    success: true,
    subscription: {
      plan: activePlan.name,
      displayName: activePlan.displayName,
      amount: activePlan.amount,
      currency: activePlan.currency,
      interval: activePlan.interval,
      productLimit: paidPlan && !isEntitlementActive ? 2 : activePlan.productLimit,
      status: paidPlan ? (isEntitlementActive ? "active" : "expired") : (seller?.subscriptionStatus || "inactive"),
      updatedAt: seller?.planUpdatedAt || null,
      expiresAt: seller?.planExpiresAt || null,
    },
  };
};

export const getBillingStatus = async (req, res) => {
  try {
    const seller = await Seller.findOne({ userId: req.user.userId }).lean();

    if (!seller) {
      return res.status(200).json({
        success: true,
        subscription: {
          plan: "free",
          displayName: "Free",
          amount: 0,
          currency: "INR",
          interval: "month",
          productLimit: 2,
          status: "inactive",
          updatedAt: null,
          expiresAt: null,
        },
      });
    }

    return res.status(200).json(buildBillingResponseForSeller(seller));
  } catch (error) {
    console.error("Billing status error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to fetch billing status",
    });
  }
};

export const createSubscriptionOrder = async (req, res) => {
  try {
    const requestedPlan = String(req.body?.plan || "free").trim().toLowerCase();
    const plan = getPlanConfig(requestedPlan);
    const razorpayClient = createRazorpayClient();

    if (plan.amount === 0) {
      await Seller.findOneAndUpdate(
        { userId: req.user.userId },
        {
          plan: plan.name,
          subscriptionStatus: "inactive",
          planUpdatedAt: new Date(),
          planExpiresAt: null,
        },
        { upsert: true, new: true }
      );

      return res.status(200).json({
        success: true,
        message: "Free plan activated",
        subscription: {
          plan: plan.name,
          amount: 0,
          currency: plan.currency,
          displayName: plan.displayName,
        },
      });
    }

    if (!razorpayClient) {
      return res.status(503).json({
        success: false,
        message: "Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to accept subscription payments.",
      });
    }

    try {
      if (await isDatabaseWriteLimitReached(Seller.db.db)) {
        return res.status(503).json({
          success: false,
          message: "Subscription checkout is temporarily paused while database capacity is prepared. No payment was taken.",
        });
      }
    } catch (error) {
      console.error("Subscription storage check failed:", error.message);
      return res.status(503).json({ success: false, message: "Subscription checkout is temporarily unavailable. No payment was taken." });
    }

    const order = await razorpayClient.orders.create({
      amount: plan.amount,
      currency: plan.currency,
      receipt: `supplylink_${req.user.userId}_${Date.now()}`,
      notes: {
        plan: plan.name,
        userId: String(req.user.userId),
      },
    });

    await SubscriptionCheckout.create({
      sellerId: req.user.userId,
      razorpayOrderId: order.id,
      plan: plan.name,
      amount: plan.amount,
      currency: plan.currency,
      status: "pending",
    });

    return res.status(200).json({
      success: true,
      keyId: process.env.RAZORPAY_KEY_ID,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
      },
      subscription: {
        plan: plan.name,
        displayName: plan.displayName,
        amount: plan.amount,
        currency: plan.currency,
      },
    });
  } catch (error) {
    console.error("Create subscription order error:", error.message);
    return res.status(400).json({
      success: false,
      message: error.message || "Unable to create subscription order",
    });
  }
};

export const verifySubscription = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};

    if (!process.env.RAZORPAY_KEY_SECRET || !razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return res.status(503).json({
        success: false,
        message: "A complete Razorpay payment signature is required to activate a paid plan.",
      });
    }

    if (!validRazorpayId(razorpay_order_id) || !validRazorpayId(razorpay_payment_id) || !/^[a-fA-F0-9]{64}$/.test(String(razorpay_signature))) {
      return res.status(400).json({ success: false, message: "Invalid Razorpay payment details." });
    }

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    const expectedBuffer = Buffer.from(expectedSignature, "utf8");
    const receivedBuffer = Buffer.from(String(razorpay_signature), "utf8");
    if (expectedBuffer.length !== receivedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)) {
      return res.status(400).json({
        success: false,
        message: "Payment verification failed",
      });
    }

    const checkout = await SubscriptionCheckout.findOne({
      razorpayOrderId: razorpay_order_id,
      sellerId: req.user.userId,
    }).lean();
    if (!checkout) return res.status(404).json({ success: false, message: "Subscription checkout was not found." });
    const targetPlan = getPlanConfig(checkout.plan);

    const razorpayClient = createRazorpayClient();
    if (!razorpayClient) {
      return res.status(503).json({ success: false, message: "Razorpay is not configured." });
    }
    const [order, payment] = await Promise.all([
      razorpayClient.orders.fetch(razorpay_order_id),
      razorpayClient.payments.fetch(razorpay_payment_id),
    ]);
    if (payment.id !== razorpay_payment_id || order.id !== razorpay_order_id || !isCapturedSubscriptionPayment({ payment, order, plan: targetPlan, userId: req.user.userId })) {
      return res.status(400).json({ success: false, message: "Payment order does not match this seller and plan." });
    }

    const session = await Seller.startSession();
    try {
      await session.withTransaction(async () => {
        await applyCapturedPayment({ orderId: razorpay_order_id, payment, order, session });
      });
    } finally {
      await session.endSession();
    }

    return res.status(200).json({
      success: true,
      message: "Subscription activated successfully",
      subscription: {
        plan: targetPlan.name,
        displayName: targetPlan.displayName,
        status: "active",
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "This Razorpay payment has already been applied." });
    }
    console.error("Verify subscription error:", error.message);
    return res.status(400).json({
      success: false,
      message: error.message || "Unable to verify payment",
    });
  }
};

export const handleRazorpayWebhook = async (req, res) => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const rawBody = req.rawBody;
  const signature = req.get("x-razorpay-signature");
  if (!webhookSecret || !verifyRazorpayWebhookSignature({ rawBody, signature, secret: webhookSecret })) {
    return res.status(400).json({ success: false, message: "Invalid Razorpay webhook signature." });
  }

  let payload;
  try { payload = JSON.parse(rawBody.toString("utf8")); } catch {
    return res.status(400).json({ success: false, message: "Invalid webhook payload." });
  }
  if (!payload?.event || typeof payload.event !== "string") {
    return res.status(400).json({ success: false, message: "Webhook event is missing." });
  }
  const suppliedEventId = req.get("x-razorpay-event-id");
  const eventId = suppliedEventId && /^[a-zA-Z0-9_-]{1,200}$/.test(suppliedEventId)
    ? suppliedEventId
    : crypto.createHash("sha256").update(rawBody).digest("hex");
  const payment = payload.payload?.payment?.entity;
  const refund = payload.payload?.refund?.entity;
  const paymentId = payment?.id || refund?.payment_id;

  try {
    const client = createRazorpayClient();
    let fetchedPayment;
    let fetchedOrder;
    if (payload.event === "payment.captured") {
      if (!validRazorpayId(payment?.id) || !validRazorpayId(payment?.order_id)) throw new Error("Captured payment identifiers are invalid.");
      if (!client) return res.status(503).json({ success: false, message: "Razorpay is not configured." });
      [fetchedPayment, fetchedOrder] = await Promise.all([
        client.payments.fetch(payment.id),
        client.orders.fetch(payment.order_id),
      ]);
    } else if (payload.event === "refund.processed") {
      if (!validRazorpayId(paymentId)) throw new Error("Refund payment identifier is invalid.");
      if (!client) return res.status(503).json({ success: false, message: "Razorpay is not configured." });
      fetchedPayment = await client.payments.fetch(paymentId);
      if (!fetchedPayment || fetchedPayment.id !== paymentId) throw new Error("Refund payment could not be verified.");
    }

    const session = await Seller.startSession();
    try {
      await session.withTransaction(async () => {
        await RazorpayWebhookEvent.create([{
          eventId,
          event: payload.event,
          resourceId: paymentId || payment?.order_id || "",
          processedAt: new Date(),
        }], { session });

        if (payload.event === "payment.captured") {
          await applyCapturedPayment({ orderId: payment.order_id, payment: fetchedPayment, order: fetchedOrder, session });
        } else if (payload.event === "payment.failed" && validRazorpayId(payment?.order_id)) {
          const failedCheckout = await SubscriptionCheckout.findOne({ razorpayOrderId: payment.order_id }).session(session);
          if (failedCheckout) {
            await createNotification({
              sellerId: failedCheckout.sellerId,
              type: "payment_failed",
              title: "Subscription payment failed",
              message: `Your Razorpay payment for the ${failedCheckout.plan} plan failed. Your plan may expire if payment is not completed.`,
              data: { orderId: payment.order_id, plan: failedCheckout.plan },
              link: `/billing`,
              session,
            });
          }
          await SubscriptionCheckout.updateOne(
            { razorpayOrderId: payment.order_id, status: "pending" },
            { $set: { status: "failed", razorpayPaymentId: payment.id || "" } },
            { session },
          );
        } else if (payload.event === "refund.processed") {
          await applyRefund({ payment: { id: paymentId }, providerPayment: fetchedPayment, session });
        }
      });
    } finally {
      await session.endSession();
    }
    return res.status(200).json({ success: true, received: true });
  } catch (error) {
    if (error.code === 11000) {
      if (await RazorpayWebhookEvent.exists({ eventId })) return res.status(200).json({ success: true, received: true, duplicate: true });
      console.error("Razorpay webhook collided with an existing payment/order record:", eventId);
      return res.status(500).json({ success: false, message: "Webhook conflicted with an existing payment record." });
    }
    console.error("Razorpay webhook processing failed:", error.message);
    return res.status(500).json({ success: false, message: "Webhook processing failed; provider may retry." });
  }
};
