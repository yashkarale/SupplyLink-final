import mongoose from "mongoose";

const inventoryMovementSchema = new mongoose.Schema(
  {
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
    },
    movementType: {
      type: String,
      enum: [
        "SALE",
        "RESTOCK",
        "ORDER_CANCELLED",
        "MANUAL_ADJUSTMENT",
        "STOCK_CORRECTION",
        "RETURN",
      ],
      required: true,
      index: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 250,
    },
    referenceId: {
      type: String,
      default: "",
      index: true,
    },
    previousStock: {
      type: Number,
      required: true,
    },
    newStock: {
      type: Number,
      required: true,
    },
    idempotencyKey: {
      type: String,
      default: "",
      index: true,
      sparse: true,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

inventoryMovementSchema.index(
  { sellerId: 1, productId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } }
);
inventoryMovementSchema.index({ sellerId: 1, productId: 1, createdAt: -1 });
inventoryMovementSchema.index({ sellerId: 1, referenceId: 1 });

export default mongoose.model("InventoryMovement", inventoryMovementSchema);
