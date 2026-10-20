export const normalizeE164 = (value) => {
  const raw = String(value || "").trim();
  const compact = raw.replace(/[\s().-]/g, "");
  if (!/^\+[1-9]\d{7,14}$/.test(compact)) return "";

  // Indian mobile numbers have ten digits after +91 and start with 6–9.
  if (compact.startsWith("+91") && !/^\+91[6-9]\d{9}$/.test(compact)) return "";
  return compact;
};

export const buildWhatsAppUrl = ({ businessName, whatsapp, product, items = [], orderReference = "", paymentProofUrl = "" }) => {
  const normalized = normalizeE164(whatsapp);
  if (!normalized) return "";

  const store = String(businessName || "the store").slice(0, 120);
  let message = `Hi ${store}, I would like to ask about your products.`;
  if (product) {
    message = `Hi ${store}, I am interested in ${String(product).slice(0, 160)}. Please share availability and how to order.`;
  } else if (Array.isArray(items) && items.length) {
    const lines = items.slice(0, 20).map((item) => {
      const name = String(item.name || "Product").slice(0, 100);
      const quantity = Math.max(1, Number(item.quantity) || 1);
      return `• ${name} × ${quantity} — ₹${(Number(item.price) * quantity).toFixed(2)}`;
    });
    const estimate = items.slice(0, 20).reduce((sum, item) => sum + Number(item.price || 0) * Math.max(1, Number(item.quantity) || 1), 0);
    message = orderReference
      ? `${paymentProofUrl ? `Hi ${store}, I have submitted payment for my Supply Link order. Please verify it in your payment app before processing.` : `Hi ${store}, I want to buy these items.`} Order reference: ${String(orderReference).slice(0, 80)}:\n${lines.join("\n")}\nEstimated total: ₹${estimate.toFixed(2)}.${paymentProofUrl ? `\nPayment screenshot (private link): ${paymentProofUrl}` : " Please confirm availability, delivery, and payment."}`
      : `Hi ${store}, I want to buy these items:\n${lines.join("\n")}\nEstimated listed total: ₹${estimate.toFixed(2)}. This is an inquiry only; no Supply Link order is placed and stock is not reserved. Please confirm availability, delivery, and payment.`;
  }

  const url = new URL(`https://wa.me/${normalized.slice(1)}`);
  url.searchParams.set("text", message);
  return url.toString();
};
