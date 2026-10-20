import express from "express";
import { createPublicOrder, getPublicPaymentProof, uploadPublicPaymentProof } from "../controllers/orderController.js";
import { getPublicStore, redirectToSellerWhatsApp, streamPublicStoreEvents } from "../controllers/sellerController.js";
import rateLimit from "express-rate-limit";

const router = express.Router();
const proofUploadLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false });
const publicOrderLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });
const proofLinkLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });

router.post("/:slug/orders", publicOrderLimiter, createPublicOrder);
router.post("/:slug/orders/:reference/payment-proof", proofUploadLimiter, express.raw({ type: ["image/png", "image/jpeg"], limit: "4mb" }), uploadPublicPaymentProof);
router.get("/:slug/payment-proof", proofLinkLimiter, getPublicPaymentProof);
router.get("/:slug/contact", redirectToSellerWhatsApp);
router.get("/:slug/events", streamPublicStoreEvents);
router.get("/:slug", getPublicStore);

export default router;
