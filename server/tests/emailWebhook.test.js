import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyResendWebhook } from "../src/utils/resendWebhook.js";

describe("Resend webhook signature verification", () => {
  it("accepts an authentic recent signature and rejects altered or stale requests", () => {
    const now = Date.now();
    const timestamp = String(Math.floor(now / 1000));
    const rawBody = Buffer.from('{"type":"email.delivered","data":{"email_id":"email-1"}}');
    const secretBytes = crypto.randomBytes(32);
    const secret = `whsec_${secretBytes.toString("base64")}`;
    const id = "event-1";
    const digest = crypto.createHmac("sha256", secretBytes).update(`${id}.${timestamp}.${rawBody.toString("utf8")}`).digest("base64");
    const signature = `v1,${digest}`;

    expect(verifyResendWebhook({ secret, rawBody, id, timestamp, signature, now })).toBe(true);
    expect(verifyResendWebhook({ secret, rawBody: Buffer.from("altered"), id, timestamp, signature, now })).toBe(false);
    expect(verifyResendWebhook({ secret, rawBody, id, timestamp: String(Number(timestamp) - 600), signature, now })).toBe(false);
  });
});
