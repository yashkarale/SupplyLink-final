
import { Router } from "express";
import {
  register,
  login,
  getMe,
  verifyEmail,
  resendVerificationEmail,
} from "../controllers/authController.js";
import rateLimit from "express-rate-limit";
import { protect } from "../middleware/authMiddleware.js";

const router = Router();

router.post("/register", register);
router.post("/verify-email", verifyEmail);
router.post("/resend-verification", rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false }), resendVerificationEmail);
router.post("/login", login);
router.get("/me", protect, getMe);

export default router;
