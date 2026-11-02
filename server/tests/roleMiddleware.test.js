import { afterEach, describe, expect, it, vi } from "vitest";
import User from "../src/models/User.js";
import Seller from "../src/models/Seller.js";
import { requireAdmin, requireSellerAccess } from "../src/middleware/roleMiddleware.js";

const response = () => ({
  statusCode: 200,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

describe("persisted account role enforcement", () => {
  afterEach(() => vi.restoreAllMocks());

  it("does not trust a JWT role when the database account is a seller", async () => {
    vi.spyOn(User, "findById").mockReturnValue({ select: () => ({ lean: async () => ({ _id: "seller-id", role: "seller" }) }) });
    const res = response();
    const next = vi.fn();
    await requireAdmin({ user: { userId: "seller-id", role: "admin" } }, res, next);
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("allows only a persisted administrator", async () => {
    vi.spyOn(User, "findById").mockReturnValue({ select: () => ({ lean: async () => ({ _id: "admin-id", role: "admin" }) }) });
    const req = { user: { userId: "admin-id", role: "seller" } };
    const next = vi.fn();
    await requireAdmin(req, response(), next);
    expect(req.admin.userId).toBe("admin-id");
    expect(next).toHaveBeenCalledOnce();
  });

  it("blocks suspended sellers from seller operations", async () => {
    vi.spyOn(User, "findById").mockReturnValue({ select: () => ({ lean: async () => ({ _id: "seller-id", role: "seller" }) }) });
    vi.spyOn(Seller, "findOne").mockReturnValue({ select: () => ({ lean: async () => ({ status: "suspended" }) }) });
    const res = response();
    const next = vi.fn();
    await requireSellerAccess({ user: { userId: "seller-id" } }, res, next);
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe("SELLER_SUSPENDED");
    expect(next).not.toHaveBeenCalled();
  });
});
