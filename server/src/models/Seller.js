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
      enum: ["free", "starter", "pro"],
      default: "free",
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