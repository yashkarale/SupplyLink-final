import crypto from "node:crypto";

export const verifyResendWebhook = ({ secret, rawBody, id, timestamp, signature, now = Date.now() }) => {
  if (!secret || !Buffer.isBuffer(rawBody) || !id || !timestamp || !signature) return false;
  const timestampSeconds = Number(timestamp);
  if (!Number.isInteger(timestampSeconds) || Math.abs(Math.floor(now / 1000) - timestampSeconds) > 300) return false;

  try {
    const encodedSecret = String(secret).replace(/^whsec_/, "");
    const key = Buffer.from(encodedSecret, "base64");
    if (!key.length) return false;
    const signedContent = `${id}.${timestamp}.${rawBody.toString("utf8")}`;
    const expected = crypto.createHmac("sha256", key).update(signedContent).digest();
    return String(signature).split(" ").some((candidate) => {
      const [version, value] = candidate.split(",", 2);
      if (version !== "v1" || !value) return false;
      const received = Buffer.from(value, "base64");
      return received.length === expected.length && crypto.timingSafeEqual(received, expected);
    });
  } catch {
    return false;
  }
};
