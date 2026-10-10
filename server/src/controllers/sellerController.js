import Seller from "../models/Seller.js";
import Product from "../models/Product.js";
import User from "../models/User.js";
import Order from "../models/Order.js";

const slugify = (value) => {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "store";
};

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
  category: seller.category,
  faqs: Array.isArray(seller.faqs) ? seller.faqs : [],
  plan: seller.plan,
  isPublished: seller.isPublished,
  status: seller.status,
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
  try {
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const businessName = String(req.body.businessName || "").trim();
    const phone = String(req.body.phone || "").trim();
    const whatsapp = String(req.body.whatsapp || "").trim();
    const description = String(req.body.description || "").trim();
    const category = String(req.body.category || "General").trim();
    const faqs = normalizeFaqs(req.body.faqs);
    const plan = String(req.body.plan || "free").trim().toLowerCase();
    const storeSlug = slugify(req.body.storeSlug || businessName || user.name || user.email);

    if (!businessName || !phone) {
      return res.status(400).json({
        success: false,
        message: "Business name and phone are required",
      });
    }

    if (!['free', 'starter', 'pro'].includes(plan)) {
      return res.status(400).json({
        success: false,
        message: "Invalid plan selection",
      });
    }

    const existingSeller = await Seller.findOne({ userId: user._id });
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

    const payload = {
      userId: user._id,
      email: user.email,
      businessName,
      storeSlug,
      description,
      phone,
      whatsapp,
      category: category || "General",
      faqs,
      plan,
      status: "active",
      isPublished: true,
    };

    const seller = existingSeller
      ? await Seller.findByIdAndUpdate(existingSeller._id, payload, { new: true })
      : await Seller.create(payload);

    return res.status(existingSeller ? 200 : 201).json({
      success: true,
      message: existingSeller ? "Seller profile updated" : "Seller onboarding complete",
      seller: serializeSeller(seller),
    });
  } catch (error) {
    console.error("Seller onboarding error:", error.message);
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A store with that slug already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Unable to complete seller onboarding",
    });
  }
};

export const getSellerDashboard = async (req, res) => {
  try {
    const [seller, products, orders] = await Promise.all([
      Seller.findOne({ userId: req.user.userId }).lean(),
      Product.find({ sellerId: req.user.userId }).sort({ createdAt: -1 }).lean(),
      Order.find({ sellerId: req.user.userId }).sort({ createdAt: -1 }).lean(),
    ]);

    const totalSales = orders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
    const totalOrders = orders.length;
    const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;
    const lowStockCount = products.filter((product) => Number(product.stock || 0) > 0 && Number(product.stock || 0) <= Number(product.lowStockThreshold || 5)).length;
    const outOfStockCount = products.filter((product) => Number(product.stock || 0) === 0).length;

    const now = new Date();
    const salesSeries = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(now);
      date.setDate(now.getDate() - (6 - index));

      const dayOrders = orders.filter((order) => {
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

    const customerEmails = new Set(
      orders.flatMap((order) => {
        const email = order?.customer?.email;
        return email ? [String(email).toLowerCase()] : [];
      })
    );

    const recentOrders = orders.slice(0, 5).map((order) => ({
      id: order.orderReference || order._id,
      customer: order.customer?.name || "Guest customer",
      email: order.customer?.email || "customer@unknown.com",
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
        totalOrders,
        totalProducts: products.length,
        averageOrderValue,
        lowStockCount,
        outOfStockCount,
        customerCount: customerEmails.size,
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

export const getPublicStore = async (req, res) => {
  try {
    const slug = slugify(req.params.slug);
    const seller = await Seller.findOne({ storeSlug: slug }).lean();

    if (!seller) {
      return res.status(404).json({
        success: false,
        message: "Store not found",
      });
    }

    const products = await Product.find({
      sellerId: seller.userId,
      isPublished: true,
    }).sort({ createdAt: -1 }).lean();

    const rawSellerNumber = String(seller.whatsapp || seller.phone || "").trim();
    const digits = rawSellerNumber.replace(/\D/g, "");
    const chatUrl = digits
      ? `https://wa.me/${digits}?text=${encodeURIComponent(`Hi ${seller.businessName || "this store"}, I want to place an order or ask a question about your products.`)}`
      : `https://wa.me/?text=${encodeURIComponent(`Hi ${seller.businessName || "this store"}, I want to place an order or ask a question about your products.`)}`;

    return res.status(200).json({
      success: true,
      store: {
        businessName: seller.businessName,
        storeSlug: seller.storeSlug,
        description: seller.description,
        category: seller.category,
        chatUrl,
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
