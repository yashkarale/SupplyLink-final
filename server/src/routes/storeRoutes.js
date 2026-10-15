import { Router } from "express";
import { createPublicOrder } from "../controllers/orderController.js";
import { getPublicStore, redirectToSellerWhatsApp, streamPublicStoreEvents } from "../controllers/sellerController.js";

const router = Router();

router.post("/:slug/orders", createPublicOrder);
router.get("/:slug/contact", redirectToSellerWhatsApp);
router.get("/:slug/events", streamPublicStoreEvents);
router.get("/:slug", getPublicStore);

export default router;
