import mongoose from "mongoose";

const sellerSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    businessName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    storeSlug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 60,
    },
    description: {
      type: String,
      default: "",
      maxlength: 1200,
    },
    phone: {
      type: String,
      default: "",
    },
    whatsapp: {
      type: String,
      default: "",
    },
    category: {
      type: String,
      default: "General",
    },
    faqs: [
      {
        question: {
          type: String,
          trim: true,
          maxlength: 300,
        },
        answer: {
          type: String,
          trim: true,
          maxlength: 1200,
        },
      },
    ],
    plan: {
      type: String,
      enum: ["free", "launch", "scale"],
      default: "free",
    },
    subscriptionStatus: {
      type: String,
      enum: ["inactive", "active", "payment_pending"],
      default: "inactive",
    },
    lastOrderId: {
      type: String,
      default: "",
    },
    lastPaymentId: {
      type: String,
      default: "",
    },
    planUpdatedAt: {
      type: Date,
      default: null,
    },
    planExpiresAt: {
      type: Date,
      default: null,
    },
    productLimitLockVersion: {
      type: Number,
      default: 0,
      select: false,
    },
    isPublished: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["pending", "active", "suspended"],
      default: "pending",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Seller", sellerSchema);
