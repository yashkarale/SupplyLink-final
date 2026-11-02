import { afterEach, describe, expect, it, vi } from "vitest";
import Seller from "../src/models/Seller.js";
import SubscriptionCheckout from "../src/models/SubscriptionCheckout.js";
import SubscriptionPayment from "../src/models/SubscriptionPayment.js";
import { listAdminSubscriptions } from "../src/controllers/adminController.js";

const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
const query = (value) => ({ select: vi.fn().mockReturnThis(), sort: vi.fn().mockReturnThis(), skip: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValue(value) });

describe("admin subscription visibility", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows verified payment history and pending/failed checkout attempts", async () => {
    const paymentQuery = query([{ _id: "pay-1", sellerId: "seller-1", plan: "launch", amount: 9900, currency: "INR", paidAt: new Date(), refundedAmount: 0 }]);
    const checkoutQuery = query([{ _id: "checkout-1", sellerId: "seller-2", plan: "scale", amount: 29900, currency: "INR", status: "failed", razorpayOrderId: "order-1", updatedAt: new Date() }]);
    const sellerQuery = { select: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValue([{ userId: "seller-1", businessName: "One" }, { userId: "seller-2", businessName: "Two" }]) };
    vi.spyOn(SubscriptionPayment, "countDocuments").mockResolvedValue(1);
    vi.spyOn(SubscriptionPayment, "find").mockReturnValue(paymentQuery);
    vi.spyOn(SubscriptionCheckout, "countDocuments").mockResolvedValue(1);
    vi.spyOn(SubscriptionCheckout, "find").mockReturnValue(checkoutQuery);
    vi.spyOn(Seller, "find").mockReturnValue(sellerQuery);
    const res = response();

    await listAdminSubscriptions({ query: { page: "1", limit: "8" } }, res);

    expect(SubscriptionCheckout.find.mock.calls[0][0]).toEqual({ status: { $in: ["pending", "failed"] } });
    expect(sellerQuery.lean).toHaveBeenCalledOnce();
    expect(res.body).toMatchObject({ payments: [{ seller: { businessName: "One" }, plan: "launch" }], checkouts: [{ seller: { businessName: "Two" }, plan: "scale", status: "failed", orderReference: "order-1" }], checkoutPagination: { total: 1 } });
  });
});
