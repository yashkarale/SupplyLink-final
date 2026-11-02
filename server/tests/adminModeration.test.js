import { afterEach, describe, expect, it, vi } from "vitest";
import Seller from "../src/models/Seller.js";
import AdminAuditLog from "../src/models/AdminAuditLog.js";
import { setAdminSellerStatus } from "../src/controllers/adminController.js";

const mongoose = Seller.db.base;
const response = () => ({
  statusCode: 200,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

describe("admin seller moderation", () => {
  afterEach(() => vi.restoreAllMocks());

  it.each([
    ["pending", "suspended", "seller.suspend"],
    ["suspended", "active", "seller.reactivate"],
  ])("records %s → %s with an audit entry", async (previousStatus, status, action) => {
    const seller = { _id: "64c9f5d2e8d0b2d5c7eb7a31", userId: "64c9f5d2e8d0b2d5c7eb7a32", businessName: "Shop", status, isPublished: true };
    seller.status = previousStatus;
    const session = { withTransaction: vi.fn(async (callback) => callback()), endSession: vi.fn() };
    vi.spyOn(mongoose, "startSession").mockResolvedValue(session);
    vi.spyOn(Seller, "findById").mockReturnValue({ session: vi.fn().mockResolvedValue(seller) });
    vi.spyOn(Seller, "updateOne").mockResolvedValue({ modifiedCount: 1 });
    const auditCreate = vi.spyOn(AdminAuditLog, "create").mockResolvedValue([]);
    const res = response();

    await setAdminSellerStatus({ params: { id: seller._id }, body: { status }, admin: { userId: "64c9f5d2e8d0b2d5c7eb7a40" } }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ success: true, changed: true, seller: { status } });
    expect(Seller.updateOne).toHaveBeenCalledWith({ _id: seller._id, status: previousStatus }, { $set: { status } }, { session });
    expect(auditCreate).toHaveBeenCalledWith([expect.objectContaining({ action, previousStatus, nextStatus: status })], { session });
    expect(session.endSession).toHaveBeenCalledOnce();
  });

  it("does not report success if the audit write rejects the transaction callback", async () => {
    const seller = { _id: "64c9f5d2e8d0b2d5c7eb7a31", userId: "64c9f5d2e8d0b2d5c7eb7a32", businessName: "Shop", status: "active", isPublished: true };
    const session = { withTransaction: vi.fn(async (callback) => callback()), endSession: vi.fn() };
    vi.spyOn(mongoose, "startSession").mockResolvedValue(session);
    vi.spyOn(Seller, "findById").mockReturnValue({ session: vi.fn().mockResolvedValue(seller) });
    vi.spyOn(Seller, "updateOne").mockResolvedValue({ modifiedCount: 1 });
    vi.spyOn(AdminAuditLog, "create").mockRejectedValue(new Error("audit storage unavailable"));
    const res = response();

    await setAdminSellerStatus({ params: { id: seller._id }, body: { status: "suspended" }, admin: { userId: "64c9f5d2e8d0b2d5c7eb7a40" } }, res);

    expect(res.statusCode).toBe(500);
    expect(res.body.success).toBe(false);
    expect(session.endSession).toHaveBeenCalledOnce();
  });
});
