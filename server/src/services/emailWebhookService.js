import EmailWebhookEvent from "../models/EmailWebhookEvent.js";
import Order from "../models/Order.js";

const eventStatus = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.delivery_delayed": "delayed",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.failed": "failed",
};
const terminalStatuses = ["delivered", "bounced", "complained", "failed"];

export const emailStatusForProviderEvent = (type) => eventStatus[type] || "";

export const applyEmailWebhookStatus = async (providerMessageId) => {
  const events = await EmailWebhookEvent.find({ providerMessageId }).sort({ eventAt: 1 }).lean();
  if (!events.length) return;

  const terminalEvent = [...events].reverse().find((event) => terminalStatuses.includes(eventStatus[event.type]));
  const latestEvent = terminalEvent || events.at(-1);
  const status = eventStatus[latestEvent.type];
  if (!status) return;

  const criteria = {
    emailDelivery: {
      $elemMatch: {
        providerMessageId,
        status: { $nin: terminalStatuses },
      },
    },
  };
  await Order.updateOne(criteria, {
    $set: { "emailDelivery.$.status": status, "emailDelivery.$.updatedAt": new Date(latestEvent.eventAt) },
  });
};

export const recordEmailWebhookEvent = async ({ providerEventId, providerMessageId, type, eventAt }) => {
  try {
    await EmailWebhookEvent.create({ providerEventId, providerMessageId, type, eventAt });
  } catch (error) {
    if (error.code === 11000) {
      await applyEmailWebhookStatus(providerMessageId);
      return { duplicate: true };
    }
    throw error;
  }
  await applyEmailWebhookStatus(providerMessageId);
  return { duplicate: false };
};
