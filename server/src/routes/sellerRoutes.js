import { Router } from "express";
import {
  getSellerDashboard,
  getSellerProfile,
  onboardSeller,
  updateSellerStoreSettings,
  getPublicStore,
} from "../controllers/sellerController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = Router();

router.get("/me", protect, getSellerProfile);
router.get("/dashboard", protect, getSellerDashboard);
router.post("/onboarding", protect, onboardSeller);
router.put("/store-settings", protect, updateSellerStoreSettings);
router.get("/store/:slug", getPublicStore);

export default router;
