import express, { Router } from "express";
import {
  getSellerDashboard,
  getSellerInsights,
  getSellerCustomers,
  getSellerCustomerOrderHistory,
  getSellerProfile,
  onboardSeller,
  updateSellerStoreSettings,
  uploadSellerPaymentQr,
  getPublicStore,
} from "../controllers/sellerController.js";
import { protect } from "../middleware/authMiddleware.js";
import { requireSellerAccess } from "../middleware/roleMiddleware.js";

const router = Router();

router.get("/me", protect, requireSellerAccess, getSellerProfile);
router.get("/dashboard", protect, requireSellerAccess, getSellerDashboard);
router.get("/insights", protect, requireSellerAccess, getSellerInsights);
router.get("/customers", protect, requireSellerAccess, getSellerCustomers);
router.post("/customers/history", protect, requireSellerAccess, getSellerCustomerOrderHistory);
router.post("/onboarding", protect, requireSellerAccess, onboardSeller);
router.put("/store-settings", protect, requireSellerAccess, updateSellerStoreSettings);
router.post("/payment-qr", protect, requireSellerAccess, express.raw({ type: ["image/png", "image/jpeg"], limit: "2mb" }), uploadSellerPaymentQr);
router.get("/store/:slug", getPublicStore);

export default router;
