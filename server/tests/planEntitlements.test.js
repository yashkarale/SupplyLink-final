import { describe, expect, it } from "vitest";
import { getProductLimitForSeller } from "../src/utils/planEntitlements.js";

describe("product plan entitlements", () => {
  const now = new Date("2026-10-15T00:00:00.000Z");

  it("limits Free and expired paid plans to two non-archived products", () => {
    expect(getProductLimitForSeller({ plan: "free" }, now)).toBe(2);
    expect(getProductLimitForSeller({ plan: "launch", subscriptionStatus: "active", planExpiresAt: "2026-10-14T00:00:00.000Z" }, now)).toBe(2);
  });

  it("does not limit products while a paid plan is active", () => {
    expect(getProductLimitForSeller({ plan: "scale", subscriptionStatus: "active", planExpiresAt: "2026-11-15T00:00:00.000Z" }, now)).toBeNull();
  });

  it("treats legacy paid plan names without an active expiry as Free", () => {
    expect(getProductLimitForSeller({ plan: "starter", subscriptionStatus: "active" }, now)).toBe(2);
  });
});
