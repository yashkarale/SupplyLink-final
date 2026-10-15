const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}[character]));

export const isValidEmailAddress = (value) =>
  typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

export const sendVerificationEmail = async ({ to, token }) => {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM || !process.env.APP_BASE_URL) {
    return { status: "not_configured" };
  }
  if (!isValidEmailAddress(to) || typeof token !== "string") return { status: "failed" };

  let verificationUrl;
  try {
    verificationUrl = new URL("/verify-email", process.env.APP_BASE_URL);
    verificationUrl.searchParams.set("token", token);
    if (!(["https:", "http:"].includes(verificationUrl.protocol))) return { status: "failed" };
    if (process.env.NODE_ENV === "production" && verificationUrl.protocol !== "https:") return { status: "failed" };
  } catch {
    return { status: "failed" };
  }

  const html = `<main><h1>Verify your Supply Link email</h1><p>Confirm that you own this email address to activate your seller account.</p><p><a href="${escapeHtml(verificationUrl.toString())}">Verify email address</a></p><p>This link expires in 24 hours. If you did not create this account, you can ignore this email.</p></main>`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [to.trim()],
        subject: "Verify your Supply Link account",
        html,
      }),
    });
    if (!response.ok) return { status: "failed" };
    return { status: "accepted" };
  } catch {
    return { status: "failed" };
  } finally {
    clearTimeout(timeout);
  }
};

export const sendOrderEmail = async ({ to, subject, order, storeName, trackingToken, idempotencyKey }) => {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) return { status: "not_configured" };
  if (!isValidEmailAddress(to)) return { status: "skipped" };

  const lines = order.items.map((item) =>
    `<li>${escapeHtml(item.name)} × ${Number(item.quantity)} — ₹${Number(item.lineTotal).toFixed(2)}</li>`
  ).join("");
  const trackingBase = process.env.APP_BASE_URL || "";
  let trackingLink = "";
  try {
    if (trackingBase && trackingToken) {
      trackingLink = `<p><a href="${escapeHtml(new URL(`/track/${encodeURIComponent(trackingToken)}`, trackingBase).toString())}">View order status</a></p>`;
    }
  } catch {
    return { status: "failed" };
  }
  const html = `<main><h1>${escapeHtml(subject)}</h1><p>Store: ${escapeHtml(storeName)}</p><p>Reference: <strong>${escapeHtml(order.orderReference)}</strong></p><p>Status: Pending seller confirmation</p><ul>${lines}</ul><p>Total: ₹${Number(order.totalAmount).toFixed(2)}</p>${trackingLink}</main>`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to.trim()], subject, html }),
    });
    if (!response.ok) return { status: "failed" };
    const payload = await response.json();
    return { status: "accepted", providerMessageId: String(payload.id || "") };
  } catch {
    return { status: "failed" };
  } finally {
    clearTimeout(timeout);
  }
};
