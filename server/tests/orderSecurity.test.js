import { describe, expect, it, vi } from "vitest";
import { updateSellerOrderStatus } from "../src/controllers/orderController.js";

describe("seller order status security", () => {
  it("does not allow sellers to mark a payment as verified", async () => {
    const response = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    await updateSellerOrderStatus({ body: { paymentStatus: "VERIFIED" } }, response);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: expect.stringContaining("verified payment provider"),
    }));
  });
});
