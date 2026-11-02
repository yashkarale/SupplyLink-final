import { Router } from "express";
import { getAdminDashboard, listAdminAuditLogs, listAdminSellers, listAdminSubscriptions, setAdminSellerStatus } from "../controllers/adminController.js";
import { protect } from "../middleware/authMiddleware.js";
import { requireAdmin } from "../middleware/roleMiddleware.js";

const router = Router();
router.use(protect, requireAdmin);
router.get("/dashboard", getAdminDashboard);
router.get("/sellers", listAdminSellers);
router.patch("/sellers/:id/status", setAdminSellerStatus);
router.get("/subscriptions", listAdminSubscriptions);
router.get("/audit-logs", listAdminAuditLogs);

export default router;
