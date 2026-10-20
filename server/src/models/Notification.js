import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        "order_created",
        "order_status_changed",
        "payment_verified",
        "payment_failed",
        "stock_low",
        "stock_out",
        "subscription_activated",
        "subscription_expired",
        "subscription_cancelled",
        "product_published",
        "system",
      ],
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    link: {
      type: String,
      default: "",
      maxlength: 500,
    },
  },
  { timestamps: true }
);

// Index for seller-scoped, unread-first queries
notificationSchema.index({ sellerId: 1, read: 1, createdAt: -1 });
notificationSchema.index({ sellerId: 1, type: 1, createdAt: -1 });

export default mongoose.model("Notification", notificationSchema);