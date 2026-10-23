import { describe, expect, it, vi } from "vitest";

const mockCreate = vi.hoisted(() => vi.fn());
vi.mock("../src/models/Notification.js", () => ({ default: { create: mockCreate } }));

import { createNotification } from "../src/controllers/notificationController.js";

describe("transactional notifications", () => {
  const notification = {
    sellerId: "seller-id",
    type: "order_created",
    title: "New order",
    message: "A new order was received",
  };

  it("inserts notification data using the caller's MongoDB session", async () => {
    const session = { id: "active-transaction" };
    mockCreate.mockResolvedValueOnce([]);

    await createNotification({ ...notification, session });

    expect(mockCreate).toHaveBeenCalledWith([expect.objectContaining(notification)], { session });
  });

  it("propagates insert failures so the parent transaction can roll back", async () => {
    const session = { id: "active-transaction" };
    mockCreate.mockRejectedValueOnce(new Error("write failed"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(createNotification({ ...notification, session })).rejects.toThrow("write failed");

    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
