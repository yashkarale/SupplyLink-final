import { Router } from "express";
import {
  createSubscriptionOrder,
  getBillingStatus,
  verifySubscription,
} from "../controllers/billingController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = Router();

router.get("/status", protect, getBillingStatus);
router.post("/create-order", protect, createSubscriptionOrder);
router.post("/verify", protect, verifySubscription);

export default router;
