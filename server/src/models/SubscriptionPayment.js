import mongoose from "mongoose";

const subscriptionPaymentSchema = new mongoose.Schema({
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  razorpayOrderId: { type: String, required: true, unique: true },
  razorpayPaymentId: { type: String, required: true, unique: true },
  plan: { type: String, enum: ["launch", "scale"], required: true },
  amount: { type: Number, required: true },
  currency: { type: String, required: true },
  paidAt: { type: Date, required: true },
  entitlementStartedAt: { type: Date, default: null },
  entitlementExpiresAt: { type: Date, default: null },
  refundedAt: { type: Date, default: null },
  refundedAmount: { type: Number, default: 0 },
}, { timestamps: true });

export default mongoose.model("SubscriptionPayment", subscriptionPaymentSchema);
