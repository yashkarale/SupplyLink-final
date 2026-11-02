import User from "../models/User.js";
import Seller from "../models/Seller.js";

export const requireAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.user?.userId).select("_id role").lean();
    if (!user || user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Platform administrator access required." });
    }
    req.admin = { userId: String(user._id) };
    return next();
  } catch (error) {
    console.error("Admin authorization lookup failed:", error.message);
    return res.status(503).json({ success: false, message: "Unable to validate administrator access." });
  }
};

export const requireSellerAccess = async (req, res, next) => {
  try {
    const user = await User.findById(req.user?.userId).select("_id role").lean();
    if (!user || user.role !== "seller") {
      return res.status(403).json({ success: false, message: "Seller account access required." });
    }
    const seller = await Seller.findOne({ userId: user._id }).select("status").lean();
    if (seller?.status === "suspended") {
      return res.status(403).json({ success: false, code: "SELLER_SUSPENDED", message: "Seller access is suspended. Contact Supply Link support for assistance." });
    }
    req.user.role = "seller";
    return next();
  } catch (error) {
    console.error("Seller authorization lookup failed:", error.message);
    return res.status(503).json({ success: false, message: "Unable to validate seller access." });
  }
};
