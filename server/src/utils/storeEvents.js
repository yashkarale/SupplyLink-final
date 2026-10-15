import { EventEmitter } from "node:events";

export const storeEvents = new EventEmitter();
storeEvents.setMaxListeners(0);

export const publishStoreEvent = (storeSlug, type) => {
  if (!storeSlug) return;
  storeEvents.emit(`store:${storeSlug}`, {
    type,
    occurredAt: new Date().toISOString(),
  });
};
