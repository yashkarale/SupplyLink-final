
import { Router } from "express";
import {
  register,
  login,
  getMe
} from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = Router();

router.post("/register", register);
router.route("/login").get(login).post(login);
router.get("/me", protect, getMe);

export default router;
