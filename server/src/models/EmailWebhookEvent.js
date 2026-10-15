import mongoose from "mongoose";

const emailWebhookEventSchema = new mongoose.Schema({
  providerEventId: { type: String, required: true, unique: true, maxlength: 200 },
  providerMessageId: { type: String, required: true, index: true, maxlength: 200 },
  type: { type: String, required: true, maxlength: 80 },
  eventAt: { type: Date, default: Date.now },
}, { timestamps: true });
emailWebhookEventSchema.index({ eventAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export default mongoose.model("EmailWebhookEvent", emailWebhookEventSchema);
