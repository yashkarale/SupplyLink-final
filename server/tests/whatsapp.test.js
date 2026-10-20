import { describe, expect, it } from "vitest";
import { buildWhatsAppUrl, normalizeE164 } from "../src/utils/whatsapp.js";

describe("seller WhatsApp destinations", () => {
  it("normalizes international input and supports valid Indian mobile numbers", () => {
    expect(normalizeE164(" +91 98765-43210 ")).toBe("+919876543210");
    expect(normalizeE164("+12025550123")).toBe("+12025550123");
    expect(normalizeE164("9876543210")).toBe("");
    expect(normalizeE164("+911234567890")).toBe("");
    expect(normalizeE164("+9109876543210")).toBe("");
  });

  it("targets only the explicitly configured WhatsApp number", () => {
    const storeA = buildWhatsAppUrl({ businessName: "Store A", whatsapp: "+919876543210" });
    const storeB = buildWhatsAppUrl({ businessName: "Store B", whatsapp: "+12025550123" });
    expect(new URL(storeA).hostname).toBe("wa.me");
    expect(new URL(storeA).pathname).toBe("/919876543210");
    expect(new URL(storeB).pathname).toBe("/12025550123");
    expect(buildWhatsAppUrl({ businessName: "Store A", whatsapp: "", product: "Product" })).toBe("");
    expect(buildWhatsAppUrl({ businessName: "Store A", whatsapp: "bad", product: "Product" })).toBe("");
  });

  it("encodes prefilled inquiry messages and uses supplied server catalog values", () => {
    const url = new URL(buildWhatsAppUrl({
      businessName: "Green & Good",
      whatsapp: "+919876543210",
      items: [{ name: "Tea & Honey", price: 120.5, quantity: 2 }],
    }));
    const message = url.searchParams.get("text");
    expect(message).toContain("Tea & Honey × 2 — ₹241.00");
    expect(message).toContain("no Supply Link order is placed");
    expect(message).toContain("Hi Green & Good");
  });

  it("adds the order reference and private screenshot link after a QR order", () => {
    const url = new URL(buildWhatsAppUrl({
      businessName: "Green & Good",
      whatsapp: "+919876543210",
      orderReference: "SL-12345",
      paymentProofUrl: "https://api.example.com/api/store/green/payment-proof?token=secret",
      items: [{ name: "Tea", price: 120, quantity: 1 }],
    }));
    const message = url.searchParams.get("text");
    expect(message).toContain("I have submitted payment");
    expect(message).toContain("Please verify it in your payment app");
    expect(message).toContain("SL-12345");
    expect(message).toContain("https://api.example.com/api/store/green/payment-proof?token=secret");
  });
});
