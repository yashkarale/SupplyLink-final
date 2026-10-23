import { describe, expect, it } from "vitest";
import { aggregateCustomers, isRecognizedRevenueOrder, normalizeCustomerPhone, summarizeOrderValues } from "../src/utils/customerMetrics.js";

describe("dashboard recognized revenue", () => {
  it("counts verified payments and delivered COD, but excludes unpaid and cancelled orders", () => {
    expect(isRecognizedRevenueOrder({ paymentStatus: "VERIFIED", paymentMethod: "WHATSAPP", orderStatus: "CONFIRMED" })).toBe(true);
    expect(isRecognizedRevenueOrder({ paymentStatus: "PENDING", paymentMethod: "COD", orderStatus: "DELIVERED" })).toBe(true);
    expect(isRecognizedRevenueOrder({ paymentStatus: "FAILED", paymentMethod: "COD", orderStatus: "DELIVERED" })).toBe(false);
    expect(isRecognizedRevenueOrder({ paymentStatus: "PENDING", paymentMethod: "COD", orderStatus: "PENDING" })).toBe(false);
    expect(isRecognizedRevenueOrder({ paymentStatus: "VERIFIED", paymentMethod: "WHATSAPP", orderStatus: "RETURNED" })).toBe(false);
    expect(isRecognizedRevenueOrder({ paymentStatus: "FAILED", paymentMethod: "COD", orderStatus: "CANCELLED" })).toBe(false);
  });

  it("uses exact normalized contact combinations and never merges by name", () => {
    const customers = aggregateCustomers([
      { _id: "1", customer: { name: "Same Name", email: " Buyer@Example.com ", phone: "+91 98765-43210" } },
      { _id: "2", customer: { name: "Different Name", email: "buyer@example.com", phone: "+919876543210" } },
      { _id: "3", customer: { name: "Same Name", email: "buyer@example.com", phone: "+919999999999" } },
      { _id: "4", customer: { name: "Same Name", phone: "+919876543210" } },
      { _id: "5", customer: { name: "Same Name", phone: "+919876543210" } },
    ]);

    expect(customers).toHaveLength(3);
    expect(customers.map(({ orderCount }) => orderCount).sort()).toEqual([1, 2, 2]);
  });

  it("keeps contactless guest orders separate and tolerates malformed optional fields", () => {
    const customers = aggregateCustomers([
      { _id: "guest-1", customer: { name: "Guest" } },
      { _id: "guest-2", customer: { name: "Guest" } },
      null,
      { _id: "bad", customer: null, totalAmount: "not-a-number" },
    ]);
    expect(customers).toHaveLength(3);
    expect(customers.every((customer) => customer.orderCount === 1)).toBe(true);
    expect(customers.find((customer) => customer.name === "Guest")?.recognizedSpend).toBe(0);
  });

  it("counts repeat orders once and only includes recognized payment states in spend", () => {
    const orders = [
      { _id: "paid", totalAmount: 100, paymentStatus: "VERIFIED", orderStatus: "CONFIRMED", customer: { email: "a@example.com" } },
      { _id: "paid", totalAmount: 100, paymentStatus: "VERIFIED", orderStatus: "CONFIRMED", customer: { email: "a@example.com" } },
      { _id: "pending", totalAmount: 200, paymentStatus: "PENDING", paymentMethod: "UPI", orderStatus: "PENDING", customer: { email: "a@example.com" } },
      { _id: "failed", totalAmount: 300, paymentStatus: "FAILED", orderStatus: "CANCELLED", customer: { email: "a@example.com" } },
      { _id: "cod", totalAmount: 50, paymentStatus: "PENDING", paymentMethod: "COD", orderStatus: "DELIVERED", customer: { email: "a@example.com" } },
      { _id: "returned", totalAmount: 400, paymentStatus: "VERIFIED", orderStatus: "RETURNED", customer: { email: "a@example.com" } },
    ];
    const [customer] = aggregateCustomers(orders);
    expect(customer.orderCount).toBe(5);
    expect(customer.recognizedSpend).toBe(150);
  });

  it("normalizes punctuation but does not infer country codes for local phone numbers", () => {
    expect(normalizeCustomerPhone("+91 (98765) 43210")).toBe("+919876543210");
    expect(normalizeCustomerPhone("0091-98765-43210")).toBe("+919876543210");
    expect(normalizeCustomerPhone("9876543210")).toBe("9876543210");
    expect(normalizeCustomerPhone("not a phone")).toBe("");
  });

  it("separates gross, recognized, pending, failed, and cancelled order values", () => {
    const values = summarizeOrderValues([
      { totalAmount: 100, paymentStatus: "VERIFIED", orderStatus: "CONFIRMED" },
      { totalAmount: 40, paymentStatus: "PENDING", paymentMethod: "COD", orderStatus: "DELIVERED" },
      { totalAmount: 60, paymentStatus: "PENDING", paymentMethod: "UPI", orderStatus: "PENDING" },
      { totalAmount: 70, paymentStatus: "FAILED", orderStatus: "CANCELLED" },
      { totalAmount: 30, paymentStatus: "VERIFIED", orderStatus: "RETURNED" },
    ]);
    expect(values).toEqual({
      grossOrderValue: 300,
      recognizedSales: 140,
      pendingPaymentValue: 60,
      failedPaymentValue: 70,
      cancelledOrderValue: 70,
      refundTrackingSupported: false,
    });
  });
});
