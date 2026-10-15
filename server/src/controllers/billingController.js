import crypto from "node:crypto";
import Razorpay from "razorpay";
import Seller from "../models/Seller.js";
import SubscriptionPayment from "../models/SubscriptionPayment.js";
import { getPlanConfig } from "../config/subscriptionPlans.js";
import { isDatabaseWriteLimitReached } from "../utils/storageUsage.js";

export const addOneMonth = (fromDate = new Date()) => {
  const date = new Date(fromDate);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + 1);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return date;
};

const createRazorpayClient = () => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
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
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan } = req.body || {};
    const targetPlan = getPlanConfig(String(plan || "free").trim().toLowerCase());

    if (!process.env.RAZORPAY_KEY_SECRET || !razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return res.status(503).json({
        success: false,
        message: "A complete Razorpay payment signature is required to activate a paid plan.",
      });
    }

    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(String(razorpay_order_id)) || !/^[a-zA-Z0-9_-]{1,100}$/.test(String(razorpay_payment_id)) || !/^[a-fA-F0-9]{64}$/.test(String(razorpay_signature))) {
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

    const razorpayClient = createRazorpayClient();
    if (!razorpayClient) {
      return res.status(503).json({ success: false, message: "Razorpay is not configured." });
    }
    const [order, payment] = await Promise.all([
      razorpayClient.orders.fetch(razorpay_order_id),
      razorpayClient.payments.fetch(razorpay_payment_id),
    ]);
    if (!isCapturedSubscriptionPayment({ payment, order, plan: targetPlan, userId: req.user.userId })) {
      return res.status(400).json({ success: false, message: "Payment order does not match this seller and plan." });
    }

    const session = await Seller.startSession();
    try {
      await session.withTransaction(async () => {
        await SubscriptionPayment.create([{
          sellerId: req.user.userId,
          razorpayOrderId: razorpay_order_id,
          razorpayPaymentId: razorpay_payment_id,
          plan: targetPlan.name,
          amount: targetPlan.amount,
          currency: targetPlan.currency,
          paidAt: new Date(payment.created_at ? payment.created_at * 1000 : Date.now()),
        }], { session });
        await Seller.findOneAndUpdate(
          { userId: req.user.userId },
          {
            plan: targetPlan.name,
            subscriptionStatus: "active",
            lastOrderId: razorpay_order_id,
            lastPaymentId: razorpay_payment_id,
            planUpdatedAt: new Date(),
            planExpiresAt: addOneMonth(),
          },
          { upsert: true, new: true, session }
        );
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
