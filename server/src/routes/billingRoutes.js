import { Router } from "express";
import {
  createSubscriptionOrder,
  getBillingStatus,
  verifySubscription,
} from "../controllers/billingController.js";
import { protect } from "../middleware/authMiddleware.js";
import { requireSellerAccess } from "../middleware/roleMiddleware.js";

const router = Router();

router.get("/status", protect, requireSellerAccess, getBillingStatus);
router.post("/create-order", protect, requireSellerAccess, createSubscriptionOrder);
router.post("/verify", protect, requireSellerAccess, verifySubscription);

export default router;
