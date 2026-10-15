import { afterEach, describe, expect, it } from "vitest";
import { isValidEmailAddress, sendOrderEmail, sendVerificationEmail } from "../src/services/emailService.js";

const originalApiKey = process.env.RESEND_API_KEY;
const originalFrom = process.env.EMAIL_FROM;
const originalAppBaseUrl = process.env.APP_BASE_URL;

afterEach(() => {
  if (originalApiKey === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = originalApiKey;
  if (originalFrom === undefined) delete process.env.EMAIL_FROM;
  else process.env.EMAIL_FROM = originalFrom;
  if (originalAppBaseUrl === undefined) delete process.env.APP_BASE_URL;
  else process.env.APP_BASE_URL = originalAppBaseUrl;
});

describe("transactional email configuration", () => {
  it("validates recipients and does not claim success without provider configuration", async () => {
    expect(isValidEmailAddress("buyer@example.com")).toBe(true);
    expect(isValidEmailAddress("not-an-email")).toBe(false);
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    await expect(sendOrderEmail({ to: "buyer@example.com" })).resolves.toEqual({ status: "not_configured" });
  });

  it("requires the email provider and public app URL to send a verification link", async () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    delete process.env.APP_BASE_URL;
    await expect(sendVerificationEmail({ to: "seller@example.com", token: "a".repeat(64) }))
      .resolves.toEqual({ status: "not_configured" });
  });

});
