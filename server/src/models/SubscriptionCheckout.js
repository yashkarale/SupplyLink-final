import mongoose from "mongoose";

const subscriptionCheckoutSchema = new mongoose.Schema({
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  razorpayOrderId: { type: String, required: true, unique: true },
  plan: { type: String, enum: ["launch", "scale"], required: true },
  amount: { type: Number, required: true },
  currency: { type: String, required: true },
  status: { type: String, enum: ["pending", "failed", "paid"], default: "pending", index: true },
  razorpayPaymentId: { type: String, default: "" },
}, { timestamps: true });

export default mongoose.model("SubscriptionCheckout", subscriptionCheckoutSchema);
