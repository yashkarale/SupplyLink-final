import mongoose from "mongoose";
import Seller from "../models/Seller.js";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import SubscriptionPayment from "../models/SubscriptionPayment.js";
import SubscriptionCheckout from "../models/SubscriptionCheckout.js";
import AdminAuditLog from "../models/AdminAuditLog.js";

const pagination = (query) => {
  const requestedPage = Number.parseInt(query.page || "1", 10);
  const requestedLimit = Number.parseInt(query.limit || "25", 10);
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const limit = Number.isInteger(requestedLimit) && requestedLimit > 0 ? Math.min(requestedLimit, 100) : 25;
  return { page, limit, skip: (page - 1) * limit };
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const getAdminDashboard = async (req, res) => {
  try {
    const now = new Date();
    const [sellerCounts, activeSubscribers, expiredSubscribers, paidRevenue, visibleSellerIds, totalOrders, recentOrders] = await Promise.all([
      Seller.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      Seller.countDocuments({ plan: { $in: ["launch", "scale", "starter", "pro"] }, subscriptionStatus: "active", planExpiresAt: { $gt: now } }),
      Seller.countDocuments({ plan: { $in: ["launch", "scale", "starter", "pro"] }, $or: [{ subscriptionStatus: { $ne: "active" } }, { planExpiresAt: { $lte: now } }] }),
      SubscriptionPayment.aggregate([{ $group: { _id: null, grossAmount: { $sum: "$amount" }, refundedAmount: { $sum: "$refundedAmount" }, paymentCount: { $sum: 1 } } }]),
      Seller.find({ isPublished: true, status: "active" }).select("userId").lean(),
      Order.countDocuments({}),
      Order.countDocuments({ createdAt: { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } }),
    ]);
    const countByStatus = new Map(sellerCounts.map((entry) => [entry._id, entry.count]));
    const sellerIds = visibleSellerIds.map((seller) => seller.userId);
    const [freeSubscribers, productListings] = await Promise.all([
      Seller.countDocuments({ plan: { $in: ["free", ""] }, $or: [{ subscriptionStatus: { $ne: "active" } }, { planExpiresAt: { $lte: now } }] }),
      sellerIds.length ? Product.countDocuments({ sellerId: { $in: sellerIds }, isPublished: true, status: "published" }) : 0,
    ]);
    const revenue = paidRevenue[0] || { grossAmount: 0, refundedAmount: 0, paymentCount: 0 };
    return res.status(200).json({
      success: true,
      metrics: {
        registeredSellers: sellerCounts.reduce((sum, entry) => sum + entry.count, 0),
        activeSellers: countByStatus.get("active") || 0,
        suspendedSellers: countByStatus.get("suspended") || 0,
        freeSubscribers,
        activePaidSubscribers: activeSubscribers,
        expiredPaidSubscribers: expiredSubscribers,
        subscriptionRevenue: Math.max(0, Number(revenue.grossAmount || 0) - Number(revenue.refundedAmount || 0)),
        subscriptionPayments: Number(revenue.paymentCount || 0),
        publishedProductListings: productListings,
        orders: totalOrders,
        ordersLast30Days: recentOrders,
      },
    });
  } catch (error) {
    console.error("Admin dashboard metrics failed:", error.message);
    return res.status(500).json({ success: false, message: "Unable to load platform metrics." });
  }
};

export const listAdminSellers = async (req, res) => {
  try {
    const { page, limit, skip } = pagination(req.query);
    const query = {};
    const status = String(req.query.status || "").trim().toLowerCase();
    const plan = String(req.query.plan || "").trim().toLowerCase();
    const publication = String(req.query.publication || "").trim().toLowerCase();
    const search = String(req.query.search || "").trim().slice(0, 100);
    if (["active", "pending", "suspended"].includes(status)) query.status = status;
    if (["free", "launch", "scale", "starter", "pro"].includes(plan)) query.plan = plan;
    if (["published", "draft"].includes(publication)) query.isPublished = publication === "published";
    if (search) {
      const pattern = new RegExp(escapeRegex(search), "i");
      query.$or = [{ businessName: pattern }, { email: pattern }, { storeSlug: pattern }, { city: pattern }, { locality: pattern }];
    }
    const [total, sellers] = await Promise.all([
      Seller.countDocuments(query),
      Seller.find(query)
        .select("_id userId email businessName storeSlug description category country state city locality area phone whatsapp status isPublished plan subscriptionStatus planExpiresAt createdAt updatedAt")
        .sort({ createdAt: -1, _id: 1 }).skip(skip).limit(limit).lean(),
    ]);
    return res.status(200).json({
      success: true,
      sellers: sellers.map((seller) => ({
        id: seller._id,
        businessName: seller.businessName,
        storeSlug: seller.storeSlug,
        email: seller.email,
        phone: seller.phone || "",
        whatsapp: seller.whatsapp || "",
        description: seller.description || "",
        category: seller.category || "",
        country: seller.country || "",
        state: seller.state || "",
        city: seller.city || "",
        locality: seller.locality || "",
        area: seller.area || "",
        status: seller.status,
        isPublished: Boolean(seller.isPublished),
        plan: seller.plan,
        subscriptionStatus: seller.subscriptionStatus,
        planExpiresAt: seller.planExpiresAt || null,
        createdAt: seller.createdAt,
      })),
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (error) {
    console.error("Admin seller search failed:", error.message);
    return res.status(500).json({ success: false, message: "Unable to load sellers." });
  }
};

export const setAdminSellerStatus = async (req, res) => {
  const requestedStatus = String(req.body?.status || "").trim().toLowerCase();
  if (!new Set(["active", "suspended"]).has(requestedStatus)) {
    return res.status(400).json({ success: false, message: "Choose active or suspended status." });
  }
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: "Seller id is invalid." });
  }
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const seller = await Seller.findById(req.params.id).session(session);
      if (!seller) {
        const error = new Error("Seller not found.");
        error.status = 404;
        throw error;
      }
      const previousStatus = seller.status;
      if (previousStatus === requestedStatus) {
        result = { seller, changed: false };
        return;
      }
      const update = await Seller.updateOne({ _id: seller._id, status: previousStatus }, { $set: { status: requestedStatus } }, { session });
      if (update.modifiedCount !== 1) {
        const error = new Error("Seller status changed concurrently. Refresh and try again.");
        error.status = 409;
        throw error;
      }
      await AdminAuditLog.create([{
        actorUserId: req.admin.userId,
        action: requestedStatus === "suspended" ? "seller.suspend" : "seller.reactivate",
        targetSellerId: seller._id,
        targetUserId: seller.userId,
        previousStatus,
        nextStatus: requestedStatus,
      }], { session });
      seller.status = requestedStatus;
      result = { seller, changed: true };
    });
    return res.status(200).json({
      success: true,
      changed: result.changed,
      seller: { id: result.seller._id, businessName: result.seller.businessName, status: result.seller.status, isPublished: result.seller.isPublished },
    });
  } catch (error) {
    console.error("Admin seller moderation failed:", error.message);
    return res.status(error.status || 500).json({ success: false, message: error.status ? error.message : "Unable to update seller status." });
  } finally {
    await session.endSession();
  }
};

export const listAdminSubscriptions = async (req, res) => {
  try {
    const { page, limit, skip } = pagination(req.query);
    const [total, payments, checkoutTotal, checkouts] = await Promise.all([
      SubscriptionPayment.countDocuments({}),
      SubscriptionPayment.find({}).select("sellerId razorpayOrderId razorpayPaymentId plan amount currency paidAt entitlementStartedAt entitlementExpiresAt refundedAt refundedAmount createdAt")
        .sort({ paidAt: -1, _id: 1 }).skip(skip).limit(limit).lean(),
      SubscriptionCheckout.countDocuments({ status: { $in: ["pending", "failed"] } }),
      SubscriptionCheckout.find({ status: { $in: ["pending", "failed"] } }).select("sellerId razorpayOrderId plan amount currency status createdAt updatedAt")
        .sort({ updatedAt: -1, _id: 1 }).skip(skip).limit(limit).lean(),
    ]);
    const sellerIds = [...new Set([...payments, ...checkouts].map((payment) => String(payment.sellerId)))];
    const sellers = await Seller.find({ userId: { $in: sellerIds } }).select("userId businessName storeSlug subscriptionStatus planExpiresAt").lean();
    const sellerMap = new Map(sellers.map((seller) => [String(seller.userId), seller]));
    return res.status(200).json({
      success: true,
      payments: payments.map((payment) => {
        const seller = sellerMap.get(String(payment.sellerId));
        return {
          id: payment._id,
          seller: seller ? { businessName: seller.businessName, storeSlug: seller.storeSlug } : null,
          plan: payment.plan,
          amount: payment.amount,
          currency: payment.currency,
          paymentStatus: "verified",
          paidAt: payment.paidAt,
          entitlementExpiresAt: payment.entitlementExpiresAt,
          refundedAmount: Number(payment.refundedAmount || 0),
          refundedAt: payment.refundedAt || null,
          status: payment.refundedAt ? "refunded" : seller?.subscriptionStatus === "active" && seller?.planExpiresAt > new Date() ? "active" : "expired",
        };
      }),
      checkouts: checkouts.map((checkout) => ({
        id: checkout._id,
        seller: sellerMap.get(String(checkout.sellerId)) ? {
          businessName: sellerMap.get(String(checkout.sellerId)).businessName,
          storeSlug: sellerMap.get(String(checkout.sellerId)).storeSlug,
        } : null,
        plan: checkout.plan,
        amount: checkout.amount,
        currency: checkout.currency,
        status: checkout.status,
        orderReference: checkout.razorpayOrderId,
        createdAt: checkout.createdAt,
        updatedAt: checkout.updatedAt,
      })),
      checkoutPagination: { page, limit, total: checkoutTotal, totalPages: Math.max(1, Math.ceil(checkoutTotal / limit)) },
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (error) {
    console.error("Admin subscriptions failed:", error.message);
    return res.status(500).json({ success: false, message: "Unable to load subscription records." });
  }
};

export const listAdminAuditLogs = async (req, res) => {
  try {
    const { page, limit, skip } = pagination(req.query);
    const [total, logs] = await Promise.all([
      AdminAuditLog.countDocuments({}),
      AdminAuditLog.find({}).sort({ createdAt: -1, _id: 1 }).skip(skip).limit(limit).lean(),
    ]);
    return res.status(200).json({ success: true, logs, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } });
  } catch (error) {
    console.error("Admin audit history failed:", error.message);
    return res.status(500).json({ success: false, message: "Unable to load moderation history." });
  }
};
