import mongoose from "mongoose";

const adminAuditLogSchema = new mongoose.Schema({
  actorUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  action: { type: String, enum: ["seller.suspend", "seller.reactivate"], required: true },
  targetSellerId: { type: mongoose.Schema.Types.ObjectId, ref: "Seller", required: true, index: true },
  targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  previousStatus: { type: String, required: true },
  nextStatus: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, immutable: true, index: true },
}, { versionKey: false });

adminAuditLogSchema.index({ targetSellerId: 1, createdAt: -1 });

export default mongoose.model("AdminAuditLog", adminAuditLogSchema);
