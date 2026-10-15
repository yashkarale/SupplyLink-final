import { describe, expect, it } from "vitest";
import {
  createEmailVerificationToken,
  hashEmailVerificationToken,
  isEmailVerificationToken,
} from "../src/utils/emailVerification.js";

describe("email verification tokens", () => {
  it("creates a high-entropy token and stores only its one-way hash", () => {
    const token = createEmailVerificationToken();

    expect(isEmailVerificationToken(token)).toBe(true);
    expect(hashEmailVerificationToken(token)).not.toBe(token);
    expect(hashEmailVerificationToken(token)).toHaveLength(64);
  });

  it("rejects malformed tokens", () => {
    expect(isEmailVerificationToken("short")).toBe(false);
    expect(isEmailVerificationToken("g".repeat(64))).toBe(false);
    expect(isEmailVerificationToken(null)).toBe(false);
  });
});
