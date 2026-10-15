import { describe, expect, it } from "vitest";
import { addOneMonth, isCapturedSubscriptionPayment } from "../src/controllers/billingController.js";
import { getPlanConfig, PLAN_ORDER } from "../src/config/subscriptionPlans.js";

describe("subscription plans", () => {
  it("returns the launch plan pricing in INR", () => {
    expect(getPlanConfig("launch")).toMatchObject({
      name: "launch",
      displayName: "Launch",
      amount: 9900,
      currency: "INR",
      interval: "month",
    });
  });

  it("keeps the supported plan order consistent", () => {
    expect(PLAN_ORDER).toEqual(["free", "launch", "scale"]);
  });

  it("rejects unsupported plans", () => {
    expect(() => getPlanConfig("enterprise")).toThrow("Unsupported subscription plan");
  });

  it("requires a captured payment matching the seller, plan, amount, and order", () => {
    const plan = getPlanConfig("launch");
    const order = {
      id: "order_123",
      amount: plan.amount,
      currency: plan.currency,
      notes: { userId: "seller_1", plan: plan.name },
    };
    const payment = {
      order_id: order.id,
      amount: plan.amount,
      currency: plan.currency,
      status: "captured",
      captured: true,
    };

    expect(isCapturedSubscriptionPayment({ payment, order, plan, userId: "seller_1" })).toBe(true);
    expect(isCapturedSubscriptionPayment({ payment: { ...payment, captured: false }, order, plan, userId: "seller_1" })).toBe(false);
    expect(isCapturedSubscriptionPayment({ payment, order, plan, userId: "seller_2" })).toBe(false);
    expect(isCapturedSubscriptionPayment({ payment: { ...payment, amount: 1 }, order, plan, userId: "seller_1" })).toBe(false);
  });

  it("expires monthly entitlements at the end of the next calendar month", () => {
    expect(addOneMonth(new Date("2026-01-31T12:00:00.000Z")).toISOString()).toBe("2026-02-28T12:00:00.000Z");
    expect(addOneMonth(new Date("2026-03-15T12:00:00.000Z")).toISOString()).toBe("2026-04-15T12:00:00.000Z");
  });
});
