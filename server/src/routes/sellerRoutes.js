import express, { Router } from "express";
import {
  getSellerDashboard,
  getSellerCustomers,
  getSellerProfile,
  onboardSeller,
  updateSellerStoreSettings,
  uploadSellerPaymentQr,
  getPublicStore,
} from "../controllers/sellerController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = Router();

router.get("/me", protect, getSellerProfile);
router.get("/dashboard", protect, getSellerDashboard);
router.get("/customers", protect, getSellerCustomers);
router.post("/onboarding", protect, onboardSeller);
router.put("/store-settings", protect, updateSellerStoreSettings);
router.post("/payment-qr", protect, express.raw({ type: ["image/png", "image/jpeg"], limit: "2mb" }), uploadSellerPaymentQr);
router.get("/store/:slug", getPublicStore);

export default router;
