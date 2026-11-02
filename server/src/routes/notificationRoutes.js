import { Router } from "express";
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  getUnreadCount,
} from "../controllers/notificationController.js";
import { protect } from "../middleware/authMiddleware.js";
import { requireSellerAccess } from "../middleware/roleMiddleware.js";

const router = Router();

router.get("/", protect, requireSellerAccess, listNotifications);
router.get("/unread-count", protect, requireSellerAccess, getUnreadCount);
router.patch("/:id/read", protect, requireSellerAccess, markNotificationRead);
router.patch("/read-all", protect, requireSellerAccess, markAllNotificationsRead);
router.delete("/:id", protect, requireSellerAccess, deleteNotification);

export default router;
