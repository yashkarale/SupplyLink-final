import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 120,
    },
    description: {
      type: String,
      default: "",
      maxlength: 2000,
    },
    sku: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    compareAtPrice: {
      type: Number,
      min: 0,
      default: 0,
    },
    stock: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    lowStockThreshold: {
      type: Number,
      min: 0,
      default: 5,
    },
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "published",
    },
    images: [{ type: String }],
    variants: [
      {
        size: String,
        color: String,
        stock: Number,
      },
    ],
    isPublished: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

productSchema.index({ sellerId: 1, slug: 1 }, { unique: true });
productSchema.index({ isPublished: 1, status: 1, sellerId: 1, createdAt: -1 });
productSchema.index({ isPublished: 1, status: 1, category: 1, price: 1 });
productSchema.index({ name: "text", description: "text" }, {
  weights: { name: 4, description: 1 },
  default_language: "none",
});

export default mongoose.model("Product", productSchema);