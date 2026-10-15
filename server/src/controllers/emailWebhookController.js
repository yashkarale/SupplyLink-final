import { emailStatusForProviderEvent, recordEmailWebhookEvent } from "../services/emailWebhookService.js";
import { verifyResendWebhook } from "../utils/resendWebhook.js";

export const handleResendWebhook = async (req, res) => {
  const id = req.get("svix-id");
  const timestamp = req.get("svix-timestamp");
  const signature = req.get("svix-signature");
  const rawBody = req.rawBody;

  if (!process.env.RESEND_WEBHOOK_SECRET) {
    return res.status(503).json({ success: false, message: "Email webhook is not configured." });
  }
  if (!verifyResendWebhook({ secret: process.env.RESEND_WEBHOOK_SECRET, rawBody, id, timestamp, signature })) {
    return res.status(400).json({ success: false, message: "Invalid webhook signature." });
  }

  try {
    const event = req.body;
    const providerMessageId = String(event?.data?.email_id || "");
    const type = String(event?.type || "");
    if (!providerMessageId || providerMessageId.length > 200 || !emailStatusForProviderEvent(type)) {
      if (providerMessageId && type.startsWith("email.")) return res.status(200).json({ success: true, ignored: true });
      return res.status(400).json({ success: false, message: "Invalid email event." });
    }

    await recordEmailWebhookEvent({
      providerEventId: id,
      providerMessageId,
      type: type.slice(0, 80),
      eventAt: Number.isFinite(Date.parse(event.created_at)) ? new Date(event.created_at) : new Date(),
    });
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Email webhook processing failed:", error.message);
    return res.status(500).json({ success: false, message: "Unable to process email event." });
  }
};
