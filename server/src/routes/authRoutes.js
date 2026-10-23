
import { Router } from "express";
import {
  register,
  login,
  getMe,
  verifyEmail,
  resendVerificationEmail,
  logout,
} from "../controllers/authController.js";
import rateLimit from "express-rate-limit";
import { protect } from "../middleware/authMiddleware.js";

const router = Router();
const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many registration attempts. Please try again later." },
});
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many login attempts. Please try again later." },
});

router.post("/register", registrationLimiter, register);
router.post("/verify-email", verifyEmail);
router.post("/resend-verification", rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false }), resendVerificationEmail);
router.post("/login", loginLimiter, login);
router.get("/me", protect, getMe);
router.post("/logout", protect, logout);

export default router;
