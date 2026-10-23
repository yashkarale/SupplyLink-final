import Seller from "../models/Seller.js";
import Product from "../models/Product.js";
import User from "../models/User.js";
import Order from "../models/Order.js";
import { normalizeStoreSlug } from "../utils/storeSlug.js";
import { storeEvents } from "../utils/storeEvents.js";
import { buildWhatsAppUrl, normalizeE164 } from "../utils/whatsapp.js";
import { getProductLimitForSeller } from "../utils/planEntitlements.js";
import { aggregateCustomers, isRecognizedRevenueOrder, summarizeOrderValues } from "../utils/customerMetrics.js";
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

const serializeSeller = (seller) => ({
  id: seller._id,
  userId: seller.userId,
  email: seller.email,
  businessName: seller.businessName,
  storeSlug: seller.storeSlug,
  description: seller.description,
  phone: seller.phone,
  whatsapp: seller.whatsapp,
  paymentQrUrl: seller.paymentQrUrl || "",
  category: seller.category,
  faqs: Array.isArray(seller.faqs) ? seller.faqs : [],
  plan: seller.plan,
  subscriptionStatus: seller.subscriptionStatus,
  isPublished: seller.isPublished,
  status: seller.status,
  planUpdatedAt: seller.planUpdatedAt,
  createdAt: seller.createdAt,
  updatedAt: seller.updatedAt,
});

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

    const businessName = String(req.body.businessName || "").trim();
    const phone = normalizeE164(req.body.phone);
    const whatsapp = normalizeE164(req.body.whatsapp);
    const description = String(req.body.description || "").trim();
    const category = String(req.body.category || "General").trim();
    const faqs = normalizeFaqs(req.body.faqs);
    const storeSlug = normalizeStoreSlug(req.body.storeSlug || businessName || user.name || user.email);

    if (!businessName || !phone || !whatsapp) {
      return res.status(400).json({
        success: false,
        message: "Business name, phone, and WhatsApp number are required. Use international phone formats, for example +919876543210 for an Indian mobile.",
      });
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

    const qrContentType = String(req.body.paymentQr?.contentType || "");
    const qrBase64 = String(req.body.paymentQr?.base64 || "");
    if (!qrBase64 || qrBase64.length > 2_900_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(qrBase64)) {
      return res.status(400).json({ success: false, message: "Upload your payment QR to create a store." });
    }
    const qrBuffer = Buffer.from(qrBase64, "base64");
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

    const payload = {
      userId: user._id,
      email: user.email,
      businessName,
      storeSlug,
      description,
      phone,
      whatsapp,
      paymentQrUrl: uploadedQr.secureUrl,
      paymentQrPublicId: uploadedQr.publicId,
      category: category || "General",
      faqs,
      plan: "free",
      subscriptionStatus: "inactive",
      status: "active",
      isPublished: true,
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
    const whatsapp = normalizeE164(req.body.whatsapp);

    if (!businessName || businessName.length > 120 || !storeSlug || description.length > 1200 || !whatsapp) {
      return res.status(400).json({ success: false, message: "Enter a valid store name, slug, description, and WhatsApp number in international format (for example +919876543210)." });
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
    seller.whatsapp = whatsapp;
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
    return res.status(500).json({ success: false, message: "Unable to save store settings." });
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
    const [seller, products, orders] = await Promise.all([
      Seller.findOne({ userId: req.user.userId }).lean(),
      Product.find({ sellerId: req.user.userId }).sort({ createdAt: -1 }).lean(),
      Order.find({ sellerId: req.user.userId }).sort({ createdAt: -1 }).lean(),
    ]);

    const revenueOrders = orders.filter(isRecognizedRevenueOrder);
    const orderValues = summarizeOrderValues(orders);
    const totalSales = orderValues.recognizedSales;
    const totalOrders = orders.length;
    const averageOrderValue = revenueOrders.length > 0 ? totalSales / revenueOrders.length : 0;
    const lowStockCount = products.filter((product) => Number(product.stock || 0) > 0 && Number(product.stock || 0) <= Number(product.lowStockThreshold || 5)).length;
    const outOfStockCount = products.filter((product) => Number(product.stock || 0) === 0).length;

    const now = new Date();
    const salesSeries = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(now);
      date.setDate(now.getDate() - (6 - index));

      const dayOrders = revenueOrders.filter((order) => {
        const createdAt = new Date(order.createdAt);
        return createdAt.toDateString() === date.toDateString();
      });

      const revenue = dayOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);

      return {
        day: formatDayLabel(date),
        revenue,
        orders: dayOrders.length,
      };
    });

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

    return res.status(200).json({
      success: true,
      analytics: {
        businessName: seller?.businessName || "Your Store",
        totalSales,
        orderValues,
        totalOrders,
        totalProducts: products.length,
        averageOrderValue,
        lowStockCount,
        outOfStockCount,
        customerCount: customers.length,
        salesSeries,
        recentOrders,
      },
    });
  } catch (error) {
    console.error("Get seller dashboard error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to retrieve dashboard analytics",
    });
  }
};

export const getSellerCustomers = async (req, res) => {
  try {
    const orders = await Order.find({ sellerId: req.user.userId }).sort({ createdAt: -1 }).lean();
    const customers = aggregateCustomers(orders);
    return res.status(200).json({ success: true, customers });
  } catch (error) {
    console.error("Get seller customers error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to retrieve customer records" });
  }
};

export const getPublicStore = async (req, res) => {
  try {
    const slug = normalizeStoreSlug(req.params.slug);
    const seller = await Seller.findOne({
      storeSlug: slug,
      isPublished: true,
      status: { $ne: "suspended" },
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
    }).select("name slug description sku category price compareAtPrice stock images variants status createdAt updatedAt")
      .sort({ createdAt: -1 });
    if (productLimit !== null) productQuery = productQuery.limit(productLimit);
    const products = await productQuery.lean();

    return res.status(200).json({
      success: true,
      store: {
        businessName: seller.businessName,
        storeSlug: seller.storeSlug,
        description: seller.description,
        category: seller.category,
        contactUrl: `/api/store/${encodeURIComponent(seller.storeSlug)}/contact`,
        contactAvailable: Boolean(normalizeE164(seller.whatsapp)),
        paymentQrUrl: seller.paymentQrUrl || "",
        paymentProofAvailable: Boolean(process.env.API_PUBLIC_URL && process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET),
        faqs: Array.isArray(seller.faqs) ? seller.faqs : [],
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
      status: { $ne: "suspended" },
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
