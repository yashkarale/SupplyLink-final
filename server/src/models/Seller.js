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
    businessAddress: {
      type: String,
      default: "",
      trim: true,
      maxlength: 300,
    },
    phone: {
      type: String,
      default: "",
    },
    whatsapp: {
      type: String,
      default: "",
    },
    country: {
      type: String,
      default: "",
      trim: true,
    },
    state: {
      type: String,
      default: "",
      trim: true,
    },
    city: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },
    area: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },
    locality: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },
    sellerAddress: {
      type: String,
      default: "",
      trim: true,
    },
    latitude: {
      type: Number,
      default: null,
    },
    longitude: {
      type: Number,
      default: null,
    },
    timezone: {
      type: String,
      default: "Asia/Kolkata",
    },
    pickupAvailable: {
      type: Boolean,
      default: false,
    },
    pickupInstructions: {
      type: String,
      default: "",
      trim: true,
    },
    sellerDeliveryAvailable: {
      type: Boolean,
      default: false,
    },
    deliveryFeeType: {
      type: String,
      enum: ["flat", "distance", "custom", ""],
      default: "",
    },
    deliveryAreas: [{
      area: { type: String, trim: true, default: "" },
      fee: { type: Number, default: 0, min: 0 },
      minimumOrder: { type: Number, default: 0, min: 0 },
    }],
    deliveryTerms: {
      type: String,
      default: "",
      trim: true,
    },
    openingHours: [{
      day: {
        type: String,
        enum: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"],
      },
      isClosed: { type: Boolean, default: false },
      intervals: [{
        open: { type: String, default: "" },
        close: { type: String, default: "" },
      }],
    }],
    paymentQrUrl: { type: String, default: "" },
    paymentQrPublicId: { type: String, default: "", select: false },
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

sellerSchema.index({ isPublished: 1, status: 1, createdAt: -1 });
sellerSchema.index({ isPublished: 1, status: 1, category: 1, createdAt: -1 });

export default mongoose.model("Seller", sellerSchema);
