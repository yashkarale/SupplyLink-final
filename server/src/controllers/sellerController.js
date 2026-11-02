import mongoose from "mongoose";
import Seller from "../models/Seller.js";
import Product from "../models/Product.js";
import User from "../models/User.js";
import Order from "../models/Order.js";
import { normalizeStoreSlug } from "../utils/storeSlug.js";
import { storeEvents } from "../utils/storeEvents.js";
import { buildWhatsAppUrl, normalizeE164 } from "../utils/whatsapp.js";
import { getProductLimitForSeller } from "../utils/planEntitlements.js";
import { aggregateCustomers, isRecognizedRevenueOrder, normalizeCustomerEmail, normalizeCustomerPhone, summarizeOrderValues } from "../utils/customerMetrics.js";
import { destroyCloudinaryImage, inspectUploadedImage, uploadImageToCloudinary } from "../services/mediaStorage.js";
import crypto from "node:crypto";

const formatDayLabel = (date) => date.toLocaleDateString("en-IN", { weekday: "short" });

const normalizeFaqs = (value) => {
  const rawFaqs = Array.isArray(value) ? value : typeof value === "string" ? value.split(/\n+/) : [];

  const faqItems = rawFaqs
    .map((entry) => {
      if (!entry) return null;

      const faqText = typeof entry === "string" ? entry : `${entry.question || ""} ${entry.answer || ""}`;
      const cleaned = String(faqText).trim();

      if (!cleaned) return null;

      const answerMatch = cleaned.match(/^(.+?)\s*(?:\||-|:)\s*(.+)$/);
      const question = answerMatch ? answerMatch[1].trim() : cleaned.includes("?") ? cleaned : "";
      const answer = answerMatch ? answerMatch[2].trim() : cleaned.includes("?") ? "" : cleaned;

      if (!question || !answer) return null;

      return {
        question: question.replace(/\?+$/, "") + "?",
        answer,
      };
    })
    .filter(Boolean)
    .slice(0, 8);

  return faqItems;
};

const weekdayNames = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
const validTime = (value) => typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
const invalidProfileField = (message) => Object.assign(new Error(message), { status: 400 });

const normalizeBusinessSettings = (body = {}) => {
  const result = {};
  const textFields = [
    ["country", 120], ["state", 120], ["city", 120], ["area", 120], ["locality", 120],
    ["businessAddress", 300], ["pickupInstructions", 500], ["deliveryTerms", 1000],
  ];
  for (const [field, maximum] of textFields) {
    if (body[field] === undefined) continue;
    const value = String(body[field] || "").trim();
    if (value.length > maximum) throw invalidProfileField(`${field} must be ${maximum} characters or fewer.`);
    result[field] = value;
  }
  if (body.phone !== undefined) {
    const raw = String(body.phone || "").trim();
    const phone = normalizeE164(raw);
    if (raw && !phone) throw invalidProfileField("Enter the phone number with its country code.");
    result.phone = phone || "";
  }
  if (body.category !== undefined) {
    const category = String(body.category || "").trim();
    if (!category || category.length > 80) throw invalidProfileField("Enter a business category up to 80 characters.");
    result.category = category;
  }
  for (const field of ["pickupAvailable", "sellerDeliveryAvailable"]) {
    if (body[field] !== undefined) {
      if (typeof body[field] !== "boolean") throw invalidProfileField(`${field} must be true or false.`);
      result[field] = body[field];
    }
  }
  if (body.deliveryFeeType !== undefined) {
    const value = String(body.deliveryFeeType || "").trim().toLowerCase();
    if (!["", "flat", "distance", "custom"].includes(value)) throw invalidProfileField("Choose a supported delivery fee type.");
    result.deliveryFeeType = value;
  }
  if (body.deliveryAreas !== undefined) {
    if (!Array.isArray(body.deliveryAreas) || body.deliveryAreas.length > 30) throw invalidProfileField("Enter up to 30 delivery areas.");
    result.deliveryAreas = body.deliveryAreas.map((item) => {
      const area = String(item?.area || "").trim();
      const fee = Number(item?.fee ?? 0);
      const minimumOrder = Number(item?.minimumOrder ?? 0);
      if (!area || area.length > 120 || !Number.isFinite(fee) || fee < 0 || fee > 10000000 || !Number.isFinite(minimumOrder) || minimumOrder < 0 || minimumOrder > 10000000) {
        throw invalidProfileField("Each delivery area needs a name and valid non-negative fee and minimum order values.");
      }
      return { area, fee, minimumOrder };
    });
  }
  if (body.openingHours !== undefined) {
    if (!Array.isArray(body.openingHours) || body.openingHours.length > 7) throw invalidProfileField("Operating hours must contain up to seven days.");
    const seen = new Set();
    result.openingHours = body.openingHours.map((entry) => {
      const day = String(entry?.day || "").toUpperCase();
      if (!weekdayNames.includes(day) || seen.has(day) || typeof entry?.isClosed !== "boolean") throw invalidProfileField("Operating hours contain an invalid or duplicate day.");
      seen.add(day);
      const intervals = Array.isArray(entry.intervals) ? entry.intervals : [];
      if (intervals.length > 4 || (!entry.isClosed && !intervals.length)) throw invalidProfileField("Each open day needs one to four time ranges.");
      const normalizedIntervals = intervals.map((interval) => {
        const open = String(interval?.open || "");
        const close = String(interval?.close || "");
        if (!validTime(open) || !validTime(close) || open >= close) throw invalidProfileField("Operating hours need valid start and end times.");
        return { open, close };
      });
      return { day, isClosed: entry.isClosed, intervals: entry.isClosed ? [] : normalizedIntervals };
    });
  }
  return result;
};

const serializeSeller = (seller) => ({
  id: seller._id,
  userId: seller.userId,
  email: seller.email,
  businessName: seller.businessName,
  storeSlug: seller.storeSlug,
  description: seller.description,
  businessAddress: seller.businessAddress || "",
  phone: seller.phone,
  whatsapp: seller.whatsapp,
  paymentQrUrl: seller.paymentQrUrl || "",
  category: seller.category,
  country: seller.country || "",
  state: seller.state || "",
  city: seller.city || "",
  area: seller.area || "",
  locality: seller.locality || "",
  pickupAvailable: Boolean(seller.pickupAvailable),
  pickupInstructions: seller.pickupInstructions || "",
  sellerDeliveryAvailable: Boolean(seller.sellerDeliveryAvailable),
  deliveryFeeType: seller.deliveryFeeType || "",
  deliveryAreas: Array.isArray(seller.deliveryAreas) ? seller.deliveryAreas.map((item) => ({ area: item.area || "", fee: Number(item.fee || 0), minimumOrder: Number(item.minimumOrder || 0) })) : [],
  deliveryTerms: seller.deliveryTerms || "",
  openingHours: Array.isArray(seller.openingHours) ? seller.openingHours.map((hours) => ({ day: hours.day, isClosed: Boolean(hours.isClosed), intervals: (hours.intervals || []).map((interval) => ({ open: interval.open, close: interval.close })) })) : [],
  faqs: Array.isArray(seller.faqs) ? seller.faqs : [],
  plan: seller.plan,
  subscriptionStatus: seller.subscriptionStatus,
  isPublished: seller.isPublished,
  status: seller.status,
  planUpdatedAt: seller.planUpdatedAt,
  createdAt: seller.createdAt,
  updatedAt: seller.updatedAt,
});

const parseAnalyticsDateRange = (fromDateValue, toDateValue) => {
  const fromDate = fromDateValue ? new Date(fromDateValue) : null;
  const toDate = toDateValue ? new Date(toDateValue) : new Date();

  if (fromDate && Number.isNaN(fromDate.getTime())) {
    return { fromDate: null, toDate: new Date() };
  }

  if (toDate && Number.isNaN(toDate.getTime())) {
    return { fromDate: fromDate && !Number.isNaN(fromDate.getTime()) ? fromDate : null, toDate: new Date() };
  }

  const normalizedFrom = fromDate && !Number.isNaN(fromDate.getTime()) ? fromDate : null;
  const normalizedTo = toDate && !Number.isNaN(toDate.getTime()) ? new Date(toDate) : new Date();

  if (normalizedFrom && normalizedFrom > normalizedTo) {
    return { fromDate: normalizedTo, toDate: normalizedFrom };
  }

  return { fromDate: normalizedFrom, toDate: normalizedTo };
};

const buildCompletedRevenueCondition = () => ({
  $and: [
    { $ne: ["$orderStatus", "CANCELLED"] },
    { $ne: ["$orderStatus", "RETURNED"] },
    { $ne: ["$paymentStatus", "FAILED"] },
    {
      $or: [
        { $eq: ["$paymentStatus", "VERIFIED"] },
        { $and: [{ $eq: ["$paymentMethod", "COD"] }, { $eq: ["$orderStatus", "DELIVERED"] }] },
      ],
    },
  ],
});

export const calculateSellerBusinessMetrics = async ({ sellerId, fromDate, toDate }) => {
  const sellerObjectId = mongoose.isValidObjectId(sellerId) ? new mongoose.Types.ObjectId(sellerId) : sellerId;
  const match = { sellerId: sellerObjectId };
  const range = parseAnalyticsDateRange(fromDate, toDate);
  if (range.fromDate) match.createdAt = { $gte: range.fromDate };
  if (range.toDate) {
    match.createdAt = {
      ...(match.createdAt || {}),
      $lte: range.toDate,
    };
  }

  const completedCondition = buildCompletedRevenueCondition();
  const customerMatch = {
    ...match,
    $or: [
      { "customer.email": { $exists: true, $ne: "" } },
      { "customer.phone": { $exists: true, $ne: "" } },
    ],
  };
  const [overviewDoc, dailySeries, weeklySeries, monthlySeries, productPerformance, paymentBreakdown, customerBreakdownResult] = await Promise.all([
    Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: { $cond: [completedCondition, "$totalAmount", 0] } },
          totalSales: { $sum: { $cond: [completedCondition, 1, 0] } },
          onlineRevenue: { $sum: { $cond: [{ $and: [{ $eq: ["$orderType", "ONLINE"] }, completedCondition] }, "$totalAmount", 0] } },
          offlineRevenue: { $sum: { $cond: [{ $and: [{ $eq: ["$orderType", "OFFLINE_POS"] }, completedCondition] }, "$totalAmount", 0] } },
          onlineSalesCount: { $sum: { $cond: [{ $and: [{ $eq: ["$orderType", "ONLINE"] }, completedCondition] }, 1, 0] } },
          offlineSalesCount: { $sum: { $cond: [{ $and: [{ $eq: ["$orderType", "OFFLINE_POS"] }, completedCondition] }, 1, 0] } },
          totalOrderValue: { $sum: "$totalAmount" },
          completedOrderValue: { $sum: { $cond: [completedCondition, "$totalAmount", 0] } },
        },
      },
      {
        $project: {
          _id: 0,
          totalRevenue: 1,
          totalSales: 1,
          onlineRevenue: 1,
          offlineRevenue: 1,
          onlineSalesCount: 1,
          offlineSalesCount: 1,
          totalOrderValue: 1,
          averageOrderValue: {
            $cond: [{ $gt: ["$totalSales", 0] }, { $divide: ["$completedOrderValue", "$totalSales"] }, 0],
          },
        },
      },
    ]).then((results) => results[0] || {
      totalRevenue: 0,
      totalSales: 0,
      onlineRevenue: 0,
      offlineRevenue: 0,
      onlineSalesCount: 0,
      offlineSalesCount: 0,
      averageOrderValue: 0,
    }),
    Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          revenue: { $sum: { $cond: [completedCondition, "$totalAmount", 0] } },
          salesCount: { $sum: { $cond: [completedCondition, 1, 0] } },
          onlineRevenue: { $sum: { $cond: [{ $and: [{ $eq: ["$orderType", "ONLINE"] }, completedCondition] }, "$totalAmount", 0] } },
          offlineRevenue: { $sum: { $cond: [{ $and: [{ $eq: ["$orderType", "OFFLINE_POS"] }, completedCondition] }, "$totalAmount", 0] } },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, date: "$_id", revenue: 1, salesCount: 1, onlineRevenue: 1, offlineRevenue: 1 } },
    ]),
    Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%W", date: "$createdAt" } },
          revenue: { $sum: { $cond: [completedCondition, "$totalAmount", 0] } },
          salesCount: { $sum: { $cond: [completedCondition, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, period: "$_id", revenue: 1, salesCount: 1 } },
    ]),
    Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
          revenue: { $sum: { $cond: [completedCondition, "$totalAmount", 0] } },
          salesCount: { $sum: { $cond: [completedCondition, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, period: "$_id", revenue: 1, salesCount: 1 } },
    ]),
    Order.aggregate([
      { $match: match },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.productId",
          name: { $first: "$items.name" },
          quantitySold: { $sum: "$items.quantity" },
          revenue: { $sum: { $cond: [{ $and: [{ $eq: ["$orderType", "ONLINE"] }, completedCondition] }, "$items.lineTotal", 0] } },
          onlineRevenue: { $sum: { $cond: [{ $and: [{ $eq: ["$orderType", "ONLINE"] }, completedCondition] }, "$items.lineTotal", 0] } },
          offlineRevenue: { $sum: { $cond: [{ $and: [{ $eq: ["$orderType", "OFFLINE_POS"] }, completedCondition] }, "$items.lineTotal", 0] } },
          onlineQuantity: { $sum: { $cond: [{ $and: [{ $eq: ["$orderType", "ONLINE"] }, completedCondition] }, "$items.quantity", 0] } },
          offlineQuantity: { $sum: { $cond: [{ $and: [{ $eq: ["$orderType", "OFFLINE_POS"] }, completedCondition] }, "$items.quantity", 0] } },
          lastSaleAt: { $max: "$createdAt" },
        },
      },
      { $sort: { revenue: -1, quantitySold: -1, name: 1 } },
      { $limit: 10 },
      { $project: { _id: 1, name: 1, quantitySold: 1, revenue: 1, onlineRevenue: 1, offlineRevenue: 1, onlineQuantity: 1, offlineQuantity: 1, lastSaleAt: 1 } },
    ]),
    Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$paymentMethod",
          revenue: { $sum: { $cond: [completedCondition, "$totalAmount", 0] } },
          salesCount: { $sum: { $cond: [completedCondition, 1, 0] } },
        },
      },
      { $sort: { revenue: -1, salesCount: -1 } },
      { $project: { _id: 0, method: "$_id", revenue: 1, salesCount: 1 } },
    ]),
    Order.aggregate([
      { $match: customerMatch },
      { $addFields: { _email: { $toLower: { $trim: { input: { $ifNull: ["$customer.email", ""] } } } }, _phoneRaw: { $trim: { input: { $ifNull: ["$customer.phone", ""] } } } } },
      { $addFields: { _phoneDigits: { $regexReplace: { input: "$_phoneRaw", regex: "[^0-9]", replacement: "" } }, _phoneInternational: { $regexMatch: { input: "$_phoneRaw", regex: "^\\s*(\\+|00)" } } } },
      { $addFields: { _phone: { $cond: [{ $and: [{ $gte: [{ $strLenCP: "$_phoneDigits" }, 7] }, { $lte: [{ $strLenCP: "$_phoneDigits" }, 15] }] }, { $cond: ["$_phoneInternational", { $concat: ["+", "$_phoneDigits"] }, "$_phoneDigits"] }, ""] } } },
      { $sort: { createdAt: 1, _id: 1 } },
      {
        $group: {
          _id: { $switch: { branches: [
            { case: { $and: [{ $ne: ["$_email", ""] }, { $ne: ["$_phone", ""] }] }, then: { $concat: ["pair:", "$_email", "|", "$_phone"] } },
            { case: { $ne: ["$_email", ""] }, then: { $concat: ["email:", "$_email"] } },
            { case: { $ne: ["$_phone", ""] }, then: { $concat: ["phone:", "$_phone"] } },
          ], default: { $concat: ["guest:", { $toString: "$_id" }] } } },
          customerName: { $last: "$customer.name" },
          email: { $last: "$customer.email" },
          phone: { $last: "$customer.phone" },
          totalValue: { $sum: { $cond: [completedCondition, "$totalAmount", 0] } },
          lastOrderAt: { $max: "$createdAt" },
          orderCount: { $sum: 1 },
        },
      },
      { $sort: { totalValue: -1, lastOrderAt: -1 } },
      { $facet: {
        customers: [{ $limit: 10 }, { $project: { _id: 0, customerName: 1, email: 1, phone: 1, totalValue: 1, orderCount: 1, lastOrderAt: 1 } }],
        summary: [{ $group: { _id: null, totalUniqueCustomers: { $sum: 1 }, repeatCustomers: { $sum: { $cond: [{ $gt: ["$orderCount", 1] }, 1, 0] } } } }],
      } },
    ]),
  ]);

  const customerBreakdown = customerBreakdownResult?.[0]?.customers || [];
  const customerSummary = customerBreakdownResult?.[0]?.summary?.[0] || { totalUniqueCustomers: 0, repeatCustomers: 0 };

  const productsWithoutRecentSales = await Product.aggregate([
    { $match: { sellerId: sellerObjectId } },
    { $lookup: {
      from: Order.collection.name,
      let: { productId: "$_id" },
      pipeline: [
        { $match: { $expr: { $and: [
          { $eq: ["$sellerId", sellerObjectId] },
          { $in: ["$$productId", "$items.productId"] },
          ...(range.fromDate ? [{ $gte: ["$createdAt", range.fromDate] }] : []),
          ...(range.toDate ? [{ $lte: ["$createdAt", range.toDate] }] : []),
        ] } } },
        { $limit: 1 },
      ],
      as: "matchingSales",
    } },
    { $match: { matchingSales: { $eq: [] } } },
    { $sort: { stock: 1, name: 1, _id: 1 } },
    { $limit: 10 },
    { $project: { _id: 1, name: 1, category: 1, stock: 1, price: 1 } },
  ]).then((products) => products.map((product) => ({ ...product, stock: Number(product.stock || 0), price: Number(product.price || 0) })));

  const uniqueCustomerCount = Number(customerSummary.totalUniqueCustomers || 0);
  const repeatCustomers = Number(customerSummary.repeatCustomers || 0);
  const totalCompletedSales = Number(overviewDoc?.totalSales || 0);
  const averageTransactionValue = totalCompletedSales > 0 ? Number(overviewDoc?.totalRevenue || 0) / totalCompletedSales : 0;

  return {
    salesOverview: {
      totalRevenue: Number(overviewDoc?.totalRevenue || 0),
      totalSalesCount: totalCompletedSales,
      completedSales: totalCompletedSales,
      onlineRevenue: Number(overviewDoc?.onlineRevenue || 0),
      offlineRevenue: Number(overviewDoc?.offlineRevenue || 0),
      onlineSalesCount: Number(overviewDoc?.onlineSalesCount || 0),
      offlineSalesCount: Number(overviewDoc?.offlineSalesCount || 0),
      averageOrderValue: Number(overviewDoc?.averageOrderValue || 0),
      averageTransactionValue,
      selectedFromDate: range.fromDate ? range.fromDate.toISOString() : null,
      selectedToDate: range.toDate ? range.toDate.toISOString() : null,
    },
    trends: {
      daily: dailySeries.map((entry) => ({
        date: entry.date,
        revenue: Number(entry.revenue || 0),
        salesCount: Number(entry.salesCount || 0),
        onlineRevenue: Number(entry.onlineRevenue || 0),
        offlineRevenue: Number(entry.offlineRevenue || 0),
      })),
      weekly: weeklySeries,
      monthly: monthlySeries,
      onlineVsOffline: dailySeries.map((entry) => ({
        date: entry.date,
        onlineRevenue: Number(entry.onlineRevenue || 0),
        offlineRevenue: Number(entry.offlineRevenue || 0),
      })),
    },
    productPerformance: {
      topProducts: productPerformance.map((entry) => ({
        _id: entry._id,
        name: entry.name,
        quantitySold: Number(entry.quantitySold || 0),
        revenue: Number(entry.revenue || 0),
        onlineRevenue: Number(entry.onlineRevenue || 0),
        offlineRevenue: Number(entry.offlineRevenue || 0),
        onlineQuantity: Number(entry.onlineQuantity || 0),
        offlineQuantity: Number(entry.offlineQuantity || 0),
      })),
      noRecentSales: productsWithoutRecentSales,
    },
    paymentBreakdown: paymentBreakdown.map((entry) => ({
      method: entry.method,
      revenue: Number(entry.revenue || 0),
      salesCount: Number(entry.salesCount || 0),
    })),
    customerInsights: {
      totalUniqueCustomers: uniqueCustomerCount,
      repeatCustomers,
      topCustomers: customerBreakdown.map((customer) => ({
        name: customer.customerName || customer.email || customer.phone || "Walk-in customer",
        email: customer.email || "",
        phone: customer.phone || "",
        totalValue: Number(customer.totalValue || 0),
        orderCount: Number(customer.orderCount || 0),
        lastOrderAt: customer.lastOrderAt || null,
      })),
      recentActivity: customerBreakdown.slice(0, 5).map((customer) => ({
        name: customer.customerName || customer.email || customer.phone || "Walk-in customer",
        email: customer.email || "",
        phone: customer.phone || "",
        lastOrderAt: customer.lastOrderAt || null,
      })),
    },
    stats: {
      totalRevenue: Number(overviewDoc?.totalRevenue || 0),
      totalCompletedSales: totalCompletedSales,
      totalOrders: Number(overviewDoc?.totalSales || 0),
      onlineRevenue: Number(overviewDoc?.onlineRevenue || 0),
      offlineRevenue: Number(overviewDoc?.offlineRevenue || 0),
      avgTransactionValue: averageTransactionValue,
    },
  };
};

export const getSellerProfile = async (req, res) => {
  try {
    const seller = await Seller.findOne({ userId: req.user.userId }).lean();

    if (!seller) {
      return res.status(200).json({
        success: true,
        seller: null,
      });
    }

    return res.status(200).json({
      success: true,
      seller: serializeSeller(seller),
    });
  } catch (error) {
    console.error("Get seller profile error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to retrieve seller profile",
    });
  }
};

export const onboardSeller = async (req, res) => {
  let uploadedQr;
  let sellerCreated = false;
  try {
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const businessName = String(req.body.businessName || "").trim() || "My Store";
    const rawPhone = String(req.body.phone || "").trim();
    const rawWhatsapp = String(req.body.whatsapp || "").trim();
    const phone = normalizeE164(rawPhone);
    const whatsapp = normalizeE164(rawWhatsapp);
    const description = String(req.body.description || "").trim();
    const category = String(req.body.category || "General").trim();
    const faqs = normalizeFaqs(req.body.faqs);
    const storeSlug = normalizeStoreSlug(req.body.storeSlug || businessName || user.name || user.email);
    const shouldPublish = typeof req.body.isPublished === "boolean" ? req.body.isPublished : false;
    const businessSettings = normalizeBusinessSettings(req.body);

    if (!businessName || businessName.length > 120 || !phone || !whatsapp) {
      return res.status(400).json({ success: false, message: "Enter a business name and phone and WhatsApp numbers in international format." });
    }

    const qrContentType = String(req.body.paymentQr?.contentType || "");
    const qrBase64 = String(req.body.paymentQr?.base64 || "");
    if (qrBase64 && (!/^[A-Za-z0-9+/]+={0,2}$/.test(qrBase64) || qrBase64.length > 2_900_000)) {
      return res.status(400).json({ success: false, message: "The payment QR image data is invalid. Choose the image again." });
    }

    const existingSeller = await Seller.findOne({ userId: user._id });
    if (existingSeller) {
      return res.status(200).json({
        success: true,
        alreadyExists: true,
        message: "This account already has a store. Open your dashboard to manage it.",
        seller: serializeSeller(existingSeller),
      });
    }

    const duplicateSlug = await Seller.findOne({
      storeSlug,
      userId: { $ne: user._id },
    });

    if (duplicateSlug) {
      return res.status(409).json({
        success: false,
        message: "This store slug is already in use",
      });
    }

    let qrBuffer = null;
    if (qrBase64) {
      qrBuffer = Buffer.from(qrBase64, "base64");
      if (!qrBuffer.length || qrBuffer.toString("base64") !== qrBase64) {
        return res.status(400).json({ success: false, message: "The payment QR image data is invalid. Choose the image again." });
      }
      inspectUploadedImage(qrBuffer, qrContentType, "payment-qr");
      uploadedQr = await uploadImageToCloudinary({
        buffer: qrBuffer,
        contentType: qrContentType,
        folder: "supplylink/payment-qrs",
        publicId: `${user._id}-${crypto.randomUUID()}`,
        deliveryType: "upload",
      });
    }

    const payload = {
      userId: user._id,
      email: user.email,
      businessName,
      storeSlug,
      description,
      ...businessSettings,
      phone: phone || "",
      whatsapp: whatsapp || "",
      paymentQrUrl: uploadedQr?.secureUrl || "",
      paymentQrPublicId: uploadedQr?.publicId || "",
      category: category || "General",
      faqs,
      plan: "free",
      subscriptionStatus: "inactive",
      status: "active",
      isPublished: shouldPublish,
    };

    const seller = await Seller.create(payload);
    sellerCreated = true;

    return res.status(201).json({
      success: true,
      message: "Seller onboarding complete",
      seller: serializeSeller(seller),
    });
  } catch (error) {
    if (uploadedQr?.publicId && !sellerCreated) {
      await destroyCloudinaryImage(uploadedQr.publicId).catch((cleanupError) => console.error("Orphan onboarding QR cleanup failed:", cleanupError.message));
    }
    console.error("Seller onboarding error:", error.message);
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A store with that slug already exists",
      });
    }

    return res.status(error.status || 500).json({
      success: false,
      message: error.status ? error.message : "Unable to complete seller onboarding",
    });
  }
};

export const updateSellerStoreSettings = async (req, res) => {
  try {
    const businessName = String(req.body.businessName || "").trim();
    const storeSlug = normalizeStoreSlug(req.body.storeSlug);
    const description = String(req.body.description || "").trim();
    const isPublished = typeof req.body.isPublished === "boolean" ? req.body.isPublished : undefined;
    const businessSettings = normalizeBusinessSettings(req.body);
    const rawWhatsapp = String(req.body.whatsapp || "").trim();
    const whatsapp = normalizeE164(rawWhatsapp);

    if (!businessName || businessName.length > 120 || !storeSlug || description.length > 1200 || (rawWhatsapp && !whatsapp)) {
      return res.status(400).json({ success: false, message: "Enter a valid store name, slug, and description." });
    }

    const seller = await Seller.findOne({ userId: req.user.userId });
    if (!seller) {
      return res.status(404).json({ success: false, message: "Complete seller setup before updating store settings." });
    }

    const duplicateSlug = await Seller.exists({ storeSlug, userId: { $ne: req.user.userId } });
    if (duplicateSlug) {
      return res.status(409).json({ success: false, message: "This store link is already in use. Choose another slug." });
    }

    const oldSlug = seller.storeSlug;
    seller.businessName = businessName;
    seller.storeSlug = storeSlug;
    seller.description = description;
    if (req.body.whatsapp !== undefined) seller.whatsapp = whatsapp || "";
    Object.assign(seller, businessSettings);
    if (isPublished !== undefined) {
      seller.isPublished = isPublished;
    }
    await seller.save();

    if (seller.isPublished && seller.status === "active") {
      storeEvents.emit(`store:${storeSlug}`, { type: "catalog.updated", occurredAt: new Date().toISOString() });
      if (oldSlug !== storeSlug) {
        storeEvents.emit(`store:${oldSlug}`, { type: "catalog.updated", occurredAt: new Date().toISOString() });
      }
    }

    return res.status(200).json({ success: true, seller: serializeSeller(seller) });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "This store link is already in use. Choose another slug." });
    }
    console.error("Update store settings error:", error.message);
    return res.status(error.status || 500).json({ success: false, message: error.status ? error.message : "Unable to save store settings." });
  }
};

export const uploadSellerPaymentQr = async (req, res) => {
  let uploaded;
  try {
    const inspected = inspectUploadedImage(req.body, req.headers["content-type"], "payment-qr");
    const seller = await Seller.findOne({ userId: req.user.userId }).select("+paymentQrPublicId");
    if (!seller) return res.status(404).json({ success: false, message: "Complete seller setup before uploading a payment QR." });

    uploaded = await uploadImageToCloudinary({
      buffer: req.body,
      contentType: req.headers["content-type"],
      folder: "supplylink/payment-qrs",
      publicId: `${seller._id}-${crypto.randomUUID()}`,
      deliveryType: "upload",
    });
    const oldPublicId = seller.paymentQrPublicId;
    seller.paymentQrUrl = uploaded.secureUrl;
    seller.paymentQrPublicId = uploaded.publicId;
    seller.isPublished = true;
    await seller.save();
    if (oldPublicId) destroyCloudinaryImage(oldPublicId).catch((error) => console.error("Old seller QR cleanup failed:", error.message));

    return res.status(200).json({ success: true, seller: serializeSeller(seller), image: { width: inspected.width, height: inspected.height } });
  } catch (error) {
    console.error("Seller QR upload failed:", error.message);
    return res.status(error.status || 502).json({ success: false, message: error.message || "Unable to save the payment QR." });
  }
};

export const getSellerDashboard = async (req, res) => {
  try {
    const fromDate = req.query?.fromDate ? new Date(req.query.fromDate) : null;
    const toDate = req.query?.toDate ? new Date(req.query.toDate) : null;
    const sellerId = req.user.userId;

    const [seller, inventorySummary, productCount, orders, businessMetrics, totalOrderCount] = await Promise.all([
      Seller.findOne({ userId: sellerId }).lean(),
      Product.aggregate([
        { $match: { sellerId: mongoose.isValidObjectId(sellerId) ? new mongoose.Types.ObjectId(sellerId) : sellerId } },
        { $group: { _id: null, lowStockCount: { $sum: { $cond: [{ $and: [{ $gt: [{ $ifNull: ["$stock", 0] }, 0] }, { $lte: [{ $ifNull: ["$stock", 0] }, { $ifNull: ["$lowStockThreshold", 5] }] }] }, 1, 0] } }, outOfStockCount: { $sum: { $cond: [{ $eq: [{ $ifNull: ["$stock", 0] }, 0] }, 1, 0] } } } },
      ]),
      Product.countDocuments({ sellerId }),
      Order.find({ sellerId, ...(fromDate || toDate) ? { createdAt: {
        ...(fromDate ? { $gte: fromDate } : {}),
        ...(toDate ? { $lte: toDate } : {}),
      } } : {} }).sort({ createdAt: -1 }).limit(10).lean(),
      calculateSellerBusinessMetrics({ sellerId, fromDate: req.query?.fromDate, toDate: req.query?.toDate }),
      Order.countDocuments({ sellerId, ...(fromDate || toDate) ? { createdAt: { ...(fromDate ? { $gte: fromDate } : {}), ...(toDate ? { $lte: toDate } : {}) } } : {} }),
    ]);

    const revenueOrders = orders.filter(isRecognizedRevenueOrder);
    const orderValues = summarizeOrderValues(orders);
    const totalSales = orderValues.recognizedSales;
    const totalOrders = orders.length;
    const averageOrderValue = revenueOrders.length > 0 ? totalSales / revenueOrders.length : 0;
    const lowStockCount = Number(inventorySummary[0]?.lowStockCount || 0);
    const outOfStockCount = Number(inventorySummary[0]?.outOfStockCount || 0);

    const now = new Date();
    const salesSeries = (businessMetrics?.trends?.daily || []).slice(-7).map((entry) => ({ day: entry.date, revenue: Number(entry.revenue || 0), orders: Number(entry.salesCount || 0) }));

    const customers = aggregateCustomers(orders);

    const recentOrders = orders.slice(0, 5).map((order) => ({
      id: order.orderReference || order._id,
      customer: order.customer?.name || "Guest customer",
      email: order.customer?.email || "",
      date: new Date(order.createdAt).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
      }),
      items: Array.isArray(order.items) ? order.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0) : 0,
      total: Number(order.totalAmount || 0),
      status: order.orderStatus || "PENDING",
      method: order.paymentMethod || "UPI",
    }));

    const analytics = {
      businessName: seller?.businessName || "Your Store",
      totalSales: Number(businessMetrics?.salesOverview?.totalRevenue ?? orderValues.recognizedSales ?? 0),
      totalRevenue: Number(businessMetrics?.salesOverview?.totalRevenue ?? orderValues.recognizedSales ?? 0),
      totalSalesCount: Number(businessMetrics?.salesOverview?.totalSalesCount ?? revenueOrders.length ?? 0),
      onlineRevenue: Number(businessMetrics?.salesOverview?.onlineRevenue || 0),
      offlineRevenue: Number(businessMetrics?.salesOverview?.offlineRevenue || 0),
      onlineSalesCount: Number(businessMetrics?.salesOverview?.onlineSalesCount || 0),
      offlineSalesCount: Number(businessMetrics?.salesOverview?.offlineSalesCount || 0),
      averageOrderValue: Number(businessMetrics?.salesOverview?.averageOrderValue ?? averageOrderValue ?? 0),
      averageTransactionValue: Number(businessMetrics?.salesOverview?.averageTransactionValue ?? averageOrderValue ?? 0),
      orderValues,
      totalOrders: Number(totalOrderCount || 0),
      totalProducts: Number(productCount || 0),
      lowStockCount,
      outOfStockCount,
      customerCount: Number(businessMetrics?.customerInsights?.totalUniqueCustomers || 0),
      salesSeries,
      recentOrders,
      salesOverview: businessMetrics?.salesOverview || {
        totalRevenue: Number(orderValues.recognizedSales || 0),
        totalSalesCount: revenueOrders.length,
        completedSales: revenueOrders.length,
        onlineRevenue: 0,
        offlineRevenue: 0,
        onlineSalesCount: 0,
        offlineSalesCount: 0,
        averageOrderValue: averageOrderValue || 0,
        averageTransactionValue: averageOrderValue || 0,
      },
      trends: businessMetrics?.trends || { daily: salesSeries, weekly: [], monthly: [] },
      productPerformance: businessMetrics?.productPerformance || { topProducts: [], noRecentSales: [] },
      paymentBreakdown: businessMetrics?.paymentBreakdown || [],
      customerInsights: businessMetrics?.customerInsights || { totalUniqueCustomers: 0, repeatCustomers: 0, topCustomers: [] },
      dateRange: {
        fromDate: fromDate ? fromDate.toISOString() : null,
        toDate: toDate ? toDate.toISOString() : null,
      },
    };

    return res.status(200).json({
      success: true,
      analytics,
    });
  } catch (error) {
    console.error("Get seller dashboard error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to retrieve dashboard analytics",
    });
  }
};

export const getSellerInsights = async (req, res) => {
  try {
    const toDate = new Date();
    const fromDate = new Date(toDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    const comparisonStart = new Date(toDate.getTime() - 28 * 24 * 60 * 60 * 1000);
    const comparisonMidpoint = new Date(toDate.getTime() - 14 * 24 * 60 * 60 * 1000);
    const sellerId = mongoose.isValidObjectId(req.user.userId) ? new mongoose.Types.ObjectId(req.user.userId) : req.user.userId;
    const [metrics, inventory, comparison, restockProducts, slowMovingProducts] = await Promise.all([
      calculateSellerBusinessMetrics({ sellerId, fromDate, toDate }),
      Product.aggregate([
        { $match: { sellerId } },
        { $group: { _id: null, totalProducts: { $sum: 1 }, lowStock: { $sum: { $cond: [{ $and: [{ $gt: [{ $ifNull: ["$stock", 0] }, 0] }, { $lte: [{ $ifNull: ["$stock", 0] }, { $ifNull: ["$lowStockThreshold", 5] }] }] }, 1, 0] } }, outOfStock: { $sum: { $cond: [{ $eq: [{ $ifNull: ["$stock", 0] }, 0] }, 1, 0] } } } },
      ]),
      Order.aggregate([
        { $match: { sellerId, createdAt: { $gte: comparisonStart, $lt: toDate } } },
        { $match: { $expr: buildCompletedRevenueCondition() } },
        { $facet: {
          periods: [{ $group: { _id: { $cond: [{ $gte: ["$createdAt", comparisonMidpoint] }, "current", "previous"] }, revenue: { $sum: "$totalAmount" }, orderCount: { $sum: 1 } } }],
          decliningProducts: [
            { $unwind: "$items" },
            { $group: { _id: "$items.productId", name: { $first: "$items.name" }, previousUnits: { $sum: { $cond: [{ $lt: ["$createdAt", comparisonMidpoint] }, "$items.quantity", 0] } }, currentUnits: { $sum: { $cond: [{ $gte: ["$createdAt", comparisonMidpoint] }, "$items.quantity", 0] } } } },
            { $match: { $expr: { $and: [{ $gte: ["$previousUnits", 3] }, { $lt: ["$currentUnits", "$previousUnits"] }] } } },
            { $sort: { currentUnits: 1, previousUnits: -1, name: 1 } }, { $limit: 5 },
          ],
        } },
      ]),
      Product.aggregate([
        { $match: { sellerId, status: { $ne: "archived" } } },
        { $match: { $expr: { $lte: [{ $ifNull: ["$stock", 0] }, { $ifNull: ["$lowStockThreshold", 5] }] } } },
        { $sort: { stock: 1, name: 1, _id: 1 } }, { $limit: 5 },
        { $project: { _id: 1, name: 1, stock: 1, lowStockThreshold: 1 } },
      ]),
      Product.aggregate([
        { $match: { sellerId, status: { $ne: "archived" }, stock: { $gt: 0 } } },
        { $lookup: {
          from: Order.collection.name,
          let: { productId: "$_id" },
          pipeline: [
            { $match: { sellerId, createdAt: { $gte: fromDate, $lt: toDate }, $expr: { $and: [{ $in: ["$$productId", "$items.productId"] }, buildCompletedRevenueCondition()] } } },
            { $limit: 1 },
          ],
          as: "recentCompletedSales",
        } },
        { $match: { recentCompletedSales: { $eq: [] } } },
        { $sort: { stock: -1, name: 1 } }, { $limit: 5 },
        { $project: { _id: 1, name: 1, stock: 1 } },
      ]),
    ]);
    const inventoryStats = inventory[0] || { totalProducts: 0, lowStock: 0, outOfStock: 0 };
    const modules = [];
    const periods = new Map((comparison?.[0]?.periods || []).map((period) => [period._id, period]));
    const currentPeriod = periods.get("current");
    const previousPeriod = periods.get("previous");
    if (currentPeriod?.orderCount >= 2 && previousPeriod?.orderCount >= 2) {
      const change = Number(currentPeriod.revenue || 0) - Number(previousPeriod.revenue || 0);
      modules.push({ title: "Comparable sales periods", insight: `Recognized revenue across ${currentPeriod.orderCount} completed orders in the latest 14 days was ₹${Number(currentPeriod.revenue).toFixed(2)}; the preceding 14 days had ${previousPeriod.orderCount} completed orders and ₹${Number(previousPeriod.revenue).toFixed(2)}.`, trend: change > 0 ? "Revenue increased" : change < 0 ? "Revenue decreased" : "Revenue unchanged" });
    }
    if (restockProducts.length) {
      modules.push({ title: "Restock attention", insight: restockProducts.map((product) => `${product.name}: ${Number(product.stock || 0)} on hand (threshold ${Number(product.lowStockThreshold ?? 5)}).`).join(" "), trend: "Current inventory" });
    }
    const bestSeller = metrics.productPerformance.topProducts[0];
    if (bestSeller) modules.push({ title: "Top seller in range", insight: `${bestSeller.name} recorded ${bestSeller.quantitySold} units sold and ₹${bestSeller.revenue.toFixed(2)} in recognized revenue during this range.`, trend: "Recorded orders" });
    for (const product of comparison?.[0]?.decliningProducts || []) {
      modules.push({ title: "Sales declined", insight: `${product.name} sold ${product.previousUnits} units in the preceding 14 days and ${product.currentUnits} in the latest 14 days.`, trend: "Recorded units sold" });
    }
    if (slowMovingProducts.length) {
      modules.push({ title: "Slow-moving stock", insight: slowMovingProducts.map((product) => `${product.name}: ${product.stock} units on hand and no recognized completed sale in the last 30 days.`).join(" "), trend: "30-day order history" });
    }
    return res.status(200).json({
      success: true,
      connected: true,
      generatedAt: toDate.toISOString(),
      range: { fromDate: fromDate.toISOString(), toDate: toDate.toISOString() },
      summary: {
        forecast: "No forecast is provided; recommendations describe recorded activity only.",
        inventoryHealth: `${inventoryStats.lowStock} low-stock and ${inventoryStats.outOfStock} out-of-stock products out of ${inventoryStats.totalProducts}.`,
        customerPulse: `${metrics.customerInsights.totalUniqueCustomers} identified customers; ${metrics.customerInsights.repeatCustomers} placed more than one order in this range.`,
      },
      modules,
      source: "seller_orders_and_inventory",
    });
  } catch (error) {
    console.error("Seller insights aggregation failed:", error.message);
    return res.status(500).json({ success: false, message: "Unable to build insights from seller data." });
  }
};

export const getSellerCustomers = async (req, res) => {
  try {
    const pageValue = Number.parseInt(req.query.page || "1", 10);
    const limitValue = Number.parseInt(req.query.limit || "25", 10);
    const page = Number.isInteger(pageValue) && pageValue > 0 ? pageValue : 1;
    const limit = Number.isInteger(limitValue) && limitValue > 0 ? Math.min(limitValue, 100) : 25;
    const match = { sellerId: mongoose.isValidObjectId(req.user.userId) ? new mongoose.Types.ObjectId(req.user.userId) : req.user.userId };
    const fromDate = req.query.fromDate ? new Date(req.query.fromDate) : null;
    const toDate = req.query.toDate ? new Date(req.query.toDate) : null;
    if ((req.query.fromDate && Number.isNaN(fromDate?.getTime())) || (req.query.toDate && Number.isNaN(toDate?.getTime()))) {
      return res.status(400).json({ success: false, message: "Enter valid customer date filters." });
    }
    if (fromDate || toDate) match.createdAt = { ...(fromDate ? { $gte: fromDate } : {}), ...(toDate ? { $lte: toDate } : {}) };
    const search = String(req.query.search || "").trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pipeline = [
      { $match: match },
      { $addFields: {
        _customerEmail: { $toLower: { $trim: { input: { $ifNull: ["$customer.email", ""] } } } },
        _customerPhoneRaw: { $trim: { input: { $ifNull: ["$customer.phone", ""] } } },
      } },
      { $addFields: {
        _customerPhoneDigits: { $regexReplace: { input: "$_customerPhoneRaw", regex: "[^0-9]", replacement: "" } },
        _customerInternational: { $regexMatch: { input: "$_customerPhoneRaw", regex: "^\\s*(\\+|00)" } },
      } },
      { $addFields: { _customerPhone: { $cond: [{ $and: [{ $gte: [{ $strLenCP: "$_customerPhoneDigits" }, 7] }, { $lte: [{ $strLenCP: "$_customerPhoneDigits" }, 15] }] }, { $cond: ["$_customerInternational", { $concat: ["+", "$_customerPhoneDigits"] }, "$_customerPhoneDigits"] }, ""] } } },
      { $addFields: { _customerKey: { $switch: {
        branches: [
          { case: { $and: [{ $ne: ["$_customerEmail", ""] }, { $ne: ["$_customerPhone", ""] }] }, then: { $concat: ["pair:", "$_customerEmail", "|", "$_customerPhone"] } },
          { case: { $ne: ["$_customerEmail", ""] }, then: { $concat: ["email:", "$_customerEmail"] } },
          { case: { $ne: ["$_customerPhone", ""] }, then: { $concat: ["phone:", "$_customerPhone"] } },
        ],
        default: { $concat: ["guest-order:", { $toString: "$_id" }] },
      } } } },
      { $sort: { createdAt: -1, _id: -1 } },
      { $group: {
        _id: "$_customerKey",
        name: { $first: { $cond: [{ $ne: [{ $trim: { input: { $ifNull: ["$customer.name", ""] } } }, ""] }, "$customer.name", "Guest customer"] } },
        email: { $first: "$customer.email" }, phone: { $first: "$customer.phone" },
        address: { $first: "$customer.address" }, city: { $first: "$customer.city" }, postalCode: { $first: "$customer.postalCode" },
        lastOrderAt: { $first: "$createdAt" }, orderCount: { $sum: 1 },
        recognizedSpend: { $sum: { $cond: [buildCompletedRevenueCondition(), "$totalAmount", 0] } },
        latestOrder: { $first: { reference: { $ifNull: ["$orderReference", { $toString: "$_id" }] }, status: "$orderStatus", createdAt: "$createdAt", total: "$totalAmount", paymentMethod: "$paymentMethod", paymentStatus: "$paymentStatus" } },
      } },
      ...(search ? [{ $match: { $or: ["name", "email", "phone", "city"].map((field) => ({ [field]: { $regex: search, $options: "i" } })) } }] : []),
      { $facet: {
        customers: [{ $sort: { lastOrderAt: -1, _id: 1 } }, { $skip: (page - 1) * limit }, { $limit: limit }],
        count: [{ $count: "total" }],
        summary: [{ $group: { _id: null, customerCount: { $sum: 1 }, repeatCustomers: { $sum: { $cond: [{ $gt: ["$orderCount", 1] }, 1, 0] } }, recognizedSpend: { $sum: "$recognizedSpend" } } }],
      } },
    ];
    const [result] = await Order.aggregate(pipeline);
    const rows = result?.customers || [];
    const total = Number(result?.count?.[0]?.total || 0);
    const customers = rows.map((customer) => ({
      key: crypto.createHash("sha256").update(String(customer._id)).digest("hex"),
      historyIdentity: String(customer._id).startsWith("pair:")
        ? { mode: "pair", email: normalizeCustomerEmail(customer.email), phone: normalizeCustomerPhone(customer.phone) }
        : String(customer._id).startsWith("email:")
          ? { mode: "email", email: normalizeCustomerEmail(customer.email) }
          : String(customer._id).startsWith("phone:")
            ? { mode: "phone", phone: normalizeCustomerPhone(customer.phone) }
            : { mode: "order", orderId: String(customer._id).replace(/^guest-order:/, "") },
      name: customer.name || "Guest customer",
      email: customer.email || "",
      phone: customer.phone || "",
      address: customer.address || "",
      city: customer.city || "",
      postalCode: customer.postalCode || "",
      orderCount: Number(customer.orderCount || 0),
      recognizedSpend: Number(customer.recognizedSpend || 0),
      lastOrderAt: customer.lastOrderAt || "",
      initials: String(customer.name || "CU").split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toUpperCase() || "CU",
      orders: customer.latestOrder ? [customer.latestOrder] : [],
    }));
    return res.status(200).json({ success: true, customers, summary: result?.summary?.[0] || { customerCount: 0, repeatCustomers: 0, recognizedSpend: 0 }, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } });
  } catch (error) {
    console.error("Get seller customers error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to retrieve customer records" });
  }
};

export const getSellerCustomerOrderHistory = async (req, res) => {
  try {
    const mode = String(req.body?.identity?.mode || "");
    const identity = req.body?.identity || {};
    const pageValue = Number.parseInt(req.body?.page || "1", 10);
    const limitValue = Number.parseInt(req.body?.limit || "25", 10);
    const page = Number.isInteger(pageValue) && pageValue > 0 ? pageValue : 1;
    const limit = Number.isInteger(limitValue) && limitValue > 0 ? Math.min(limitValue, 50) : 25;
    if (!new Set(["pair", "email", "phone", "order"]).has(mode)) return res.status(400).json({ success: false, message: "Customer history identity is invalid." });
    const email = normalizeCustomerEmail(String(identity.email || ""));
    const phone = normalizeCustomerPhone(String(identity.phone || ""));
    if ((mode === "pair" && (!email || !phone)) || (mode === "email" && !email) || (mode === "phone" && !phone) || (mode === "order" && !mongoose.isValidObjectId(identity.orderId))) {
      return res.status(400).json({ success: false, message: "Customer history identity is incomplete." });
    }
    const contactPipeline = [
      { $match: { sellerId: mongoose.isValidObjectId(req.user.userId) ? new mongoose.Types.ObjectId(req.user.userId) : req.user.userId } },
      { $addFields: { _customerEmail: { $toLower: { $trim: { input: { $ifNull: ["$customer.email", ""] } } } }, _customerPhoneRaw: { $trim: { input: { $ifNull: ["$customer.phone", ""] } } } } },
      { $addFields: { _customerPhoneDigits: { $regexReplace: { input: "$_customerPhoneRaw", regex: "[^0-9]", replacement: "" } }, _customerInternational: { $regexMatch: { input: "$_customerPhoneRaw", regex: "^\\s*(\\+|00)" } } } },
      { $addFields: { _customerPhone: { $cond: [{ $and: [{ $gte: [{ $strLenCP: "$_customerPhoneDigits" }, 7] }, { $lte: [{ $strLenCP: "$_customerPhoneDigits" }, 15] }] }, { $cond: ["$_customerInternational", { $concat: ["+", "$_customerPhoneDigits"] }, "$_customerPhoneDigits"] }, ""] } } },
    ];
    if (mode === "order") contactPipeline[0].$match._id = new mongoose.Types.ObjectId(identity.orderId);
    else if (mode === "pair") contactPipeline.push({ $match: { _customerEmail: email, _customerPhone: phone } });
    else if (mode === "email") contactPipeline.push({ $match: { _customerEmail: email, _customerPhone: "" } });
    else contactPipeline.push({ $match: { _customerPhone: phone, _customerEmail: "" } });
    contactPipeline.push(
      { $sort: { createdAt: -1, _id: -1 } },
      { $facet: {
        orders: [{ $skip: (page - 1) * limit }, { $limit: limit }, { $project: { orderReference: 1, orderStatus: 1, createdAt: 1, totalAmount: 1, paymentMethod: 1, paymentStatus: 1, items: { $map: { input: "$items", as: "item", in: { name: "$$item.name", quantity: "$$item.quantity", unitPrice: "$$item.unitPrice", lineTotal: "$$item.lineTotal" } } } } }],
        count: [{ $count: "total" }],
      } },
    );
    const [result] = await Order.aggregate(contactPipeline);
    const total = Number(result?.count?.[0]?.total || 0);
    return res.status(200).json({ success: true, orders: result?.orders || [], pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } });
  } catch (error) {
    console.error("Customer order history failed:", error.message);
    return res.status(500).json({ success: false, message: "Unable to retrieve customer order history." });
  }
};

export const getPublicStore = async (req, res) => {
  try {
    const slug = normalizeStoreSlug(req.params.slug);
    const seller = await Seller.findOne({
      storeSlug: slug,
      isPublished: true,
      status: "active",
    }).lean();

    if (!seller) {
      return res.status(404).json({
        success: false,
        message: "Store not found",
      });
    }

    const productLimit = getProductLimitForSeller(seller);
    let productQuery = Product.find({
      sellerId: seller.userId,
      isPublished: true,
      status: "published",
    }).select("_id name slug description category price compareAtPrice stock images createdAt")
      .sort({ createdAt: -1 });
    if (productLimit !== null) productQuery = productQuery.limit(productLimit);
    const products = (await productQuery.lean()).map((product) => ({
      _id: product._id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      category: product.category,
      price: product.price,
      compareAtPrice: product.compareAtPrice,
      images: Array.isArray(product.images) ? product.images : [],
      createdAt: product.createdAt,
      availability: product.stock !== null && product.stock !== undefined && Number.isFinite(Number(product.stock))
        ? (Number(product.stock) > 0 ? "in_stock" : "out_of_stock")
        : "seller_confirmation_required",
    }));

    return res.status(200).json({
      success: true,
      store: {
        businessName: seller.businessName,
        storeSlug: seller.storeSlug,
        description: seller.description,
        businessAddress: seller.businessAddress || "",
        category: seller.category,
        country: seller.country || "",
        state: seller.state || "",
        city: seller.city || "",
        locality: seller.locality || "",
        area: seller.area || "",
        pickupAvailable: Boolean(seller.pickupAvailable),
        sellerDeliveryAvailable: Boolean(seller.sellerDeliveryAvailable),
        deliveryTerms: seller.deliveryTerms || "",
        deliveryFeeType: seller.deliveryFeeType || "",
        deliveryAreas: Array.isArray(seller.deliveryAreas)
          ? seller.deliveryAreas.map((item) => ({
            area: item.area || "",
            fee: Number(item.fee || 0),
            minimumOrder: Number(item.minimumOrder || 0),
          }))
          : [],
        openingHours: Array.isArray(seller.openingHours)
          ? seller.openingHours.map((hours) => ({
            day: hours.day || "",
            isClosed: Boolean(hours.isClosed),
            intervals: Array.isArray(hours.intervals)
              ? hours.intervals.map((interval) => ({ open: interval.open || "", close: interval.close || "" }))
              : [],
          }))
          : [],
        contactUrl: `/api/store/${encodeURIComponent(seller.storeSlug)}/contact`,
        contactAvailable: Boolean(normalizeE164(seller.whatsapp)),
        paymentQrUrl: seller.paymentQrUrl || "",
        paymentProofAvailable: Boolean(process.env.API_PUBLIC_URL && process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET),
        faqs: Array.isArray(seller.faqs)
          ? seller.faqs.map((item) => ({ question: item.question || "", answer: item.answer || "" }))
          : [],
      },
      products,
    });
  } catch (error) {
    console.error("Get public store error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to load store",
    });
  }
};

export const redirectToSellerWhatsApp = async (req, res) => {
  try {
    const slug = normalizeStoreSlug(req.params.slug);
    const seller = await Seller.findOne({
      storeSlug: slug,
      isPublished: true,
      status: "active",
    }).select("businessName whatsapp userId").lean();

    if (!seller) return res.status(404).send("Store not found");

    const product = String(req.query.product || "").slice(0, 160);
    const orderReference = String(req.query.orderReference || "").slice(0, 80);
    const proofToken = String(req.query.proofToken || "");
    let paymentProofUrl = "";
    if (orderReference && proofToken) {
      if (!/^[A-Za-z0-9_-]{40,50}$/.test(proofToken)) return res.status(400).send("Invalid payment proof token");
      const proofHash = crypto.createHash("sha256").update(proofToken).digest("hex");
      const order = await Order.findOne({
        sellerId: seller.userId,
        orderReference,
        paymentProofTokenHash: proofHash,
        paymentProofTokenExpiresAt: { $gt: new Date() },
        paymentProofUploadedAt: { $ne: null },
      }).select("_id").lean();
      if (!order) return res.status(404).send("Payment screenshot is not available");
      if (!process.env.API_PUBLIC_URL) return res.status(503).send("Public API URL is not configured");
      const proofLink = new URL(`/api/store/${encodeURIComponent(slug)}/payment-proof`, process.env.API_PUBLIC_URL);
      proofLink.searchParams.set("reference", orderReference);
      proofLink.searchParams.set("token", proofToken);
      paymentProofUrl = proofLink.toString();
    }
    let items = [];
    if (req.query.items) {
      if (String(req.query.items).length > 4000) return res.status(400).send("Product list is too long");
      let requested;
      try {
        requested = JSON.parse(String(req.query.items));
      } catch {
        return res.status(400).send("Invalid product list");
      }
      if (!Array.isArray(requested) || requested.length > 20) return res.status(400).send("Invalid product list");
      const normalized = requested.map((item) => ({
        productId: String(item?.productId || ""),
        quantity: Number(item?.quantity),
      }));
      if (normalized.some((item) => !/^[a-f\d]{24}$/i.test(item.productId) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99)) {
        return res.status(400).send("Invalid product list");
      }

      const products = await Product.find({
        _id: { $in: normalized.map((item) => item.productId) },
        sellerId: seller.userId,
        status: "published",
        isPublished: true,
      }).select("name price").lean();
      if (products.length !== new Set(normalized.map((item) => item.productId)).size) {
        return res.status(400).send("One or more selected products are unavailable");
      }
      const productById = new Map(products.map((item) => [String(item._id), item]));
      items = normalized.map((item) => {
        const productData = productById.get(item.productId);
        return { name: productData.name, price: Number(productData.price || 0), quantity: item.quantity };
      });
    }

    const destination = buildWhatsAppUrl({ businessName: seller.businessName, whatsapp: seller.whatsapp, product, items, orderReference, paymentProofUrl });
    if (!destination) return res.status(404).send("This seller has not configured a valid WhatsApp contact.");
    return res.redirect(302, destination);
  } catch (error) {
    console.error("WhatsApp contact redirect error:", error.message);
    return res.status(500).send("Unable to start seller contact");
  }
};

export const streamPublicStoreEvents = async (req, res) => {
  try {
    const slug = normalizeStoreSlug(req.params.slug);
    const seller = await Seller.findOne({
      storeSlug: slug,
      isPublished: true,
      status: { $ne: "suspended" },
    }).select("storeSlug").lean();
    if (!seller) return res.status(404).json({ success: false, message: "Store not found" });

    const topic = `store:${seller.storeSlug}`;
    res.set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders?.();
    res.write("retry: 3000\n\n");

    const sendUpdate = (event) => res.write(`event: update\ndata: ${JSON.stringify(event)}\n\n`);
    const heartbeat = setInterval(() => res.write(": keep-alive\n\n"), 25000);
    storeEvents.on(topic, sendUpdate);

    req.on("close", () => {
      clearInterval(heartbeat);
      storeEvents.off(topic, sendUpdate);
    });
  } catch (error) {
    console.error("Store event stream error:", error.message);
    if (!res.headersSent) res.status(500).json({ success: false, message: "Unable to open store updates" });
    else res.end();
  }
};
