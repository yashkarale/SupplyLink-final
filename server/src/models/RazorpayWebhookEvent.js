import mongoose from "mongoose";

const razorpayWebhookEventSchema = new mongoose.Schema({
  eventId: { type: String, required: true, unique: true },
  event: { type: String, required: true },
  resourceId: { type: String, default: "" },
  processedAt: { type: Date, required: true },
}, { timestamps: true });

export default mongoose.model("RazorpayWebhookEvent", razorpayWebhookEventSchema);
