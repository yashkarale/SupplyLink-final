import Notification from "../models/Notification.js";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export const listNotifications = async (req, res) => {
  try {
    const sellerId = req.user.userId;
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10));
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, parseInt(String(req.query.limit || String(DEFAULT_LIMIT)), 10))
    );
    const skip = (page - 1) * limit;
    const unreadOnly = req.query.unread === "true";

    const filter = { sellerId };
    if (unreadOnly) filter.read = false;

    const [notifications, total] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + notifications.length < total,
      },
      unreadCount: await Notification.countDocuments({ sellerId, read: false }),
    });
  } catch (error) {
    console.error("List notifications error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to load notifications" });
  }
};

export const markNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !/^[a-f\d]{24}$/i.test(id)) {
      return res.status(400).json({ success: false, message: "Invalid notification ID" });
    }

    const notification = await Notification.findOneAndUpdate(
      { _id: id, sellerId: req.user.userId },
      { read: true, readAt: new Date() },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }

    return res.status(200).json({ success: true, notification });
  } catch (error) {
    console.error("Mark notification read error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to mark notification as read" });
  }
};

export const markAllNotificationsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { sellerId: req.user.userId, read: false },
      { read: true, readAt: new Date() }
    );
    return res.status(200).json({ success: true, message: "All notifications marked as read" });
  } catch (error) {
    console.error("Mark all notifications read error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to mark notifications as read" });
  }
};

export const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !/^[a-f\d]{24}$/i.test(id)) {
      return res.status(400).json({ success: false, message: "Invalid notification ID" });
    }

    const notification = await Notification.findOneAndDelete({
      _id: id,
      sellerId: req.user.userId,
    });

    if (!notification) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }

    return res.status(200).json({ success: true, message: "Notification deleted" });
  } catch (error) {
    console.error("Delete notification error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to delete notification" });
  }
};

export const getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      sellerId: req.user.userId,
      read: false,
    });
    return res.status(200).json({ success: true, unreadCount: count });
  } catch (error) {
    console.error("Get unread count error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to get unread count" });
  }
};

// Utility: create a notification (used by other controllers)
export const createNotification = async ({
  sellerId,
  type,
  title,
  message,
  data = null,
  link = "",
  session,
}) => {
  try {
    const notification = {
      sellerId,
      type,
      title,
      message,
      data,
      link,
    };
    if (session) {
      return await Notification.create([notification], { session });
    }
    return await Notification.create(notification);
  } catch (error) {
    console.error("Create notification error:", error.message);
    if (session) throw error;
  }
};
