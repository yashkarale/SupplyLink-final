import { afterEach, describe, expect, it } from "vitest";
import { isValidEmailAddress, sendOrderEmail } from "../src/services/emailService.js";

const originalApiKey = process.env.RESEND_API_KEY;
const originalFrom = process.env.EMAIL_FROM;

afterEach(() => {
  if (originalApiKey === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = originalApiKey;
  if (originalFrom === undefined) delete process.env.EMAIL_FROM;
  else process.env.EMAIL_FROM = originalFrom;
});

describe("transactional email configuration", () => {
  it("validates recipients and does not claim success without provider configuration", async () => {
    expect(isValidEmailAddress("buyer@example.com")).toBe(true);
    expect(isValidEmailAddress("not-an-email")).toBe(false);
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    await expect(sendOrderEmail({ to: "buyer@example.com" })).resolves.toEqual({ status: "not_configured" });
  });

});
