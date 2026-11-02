import { beforeEach, describe, expect, it, vi } from "vitest";
import Product from "../src/models/Product.js";
import Order from "../src/models/Order.js";
import InventoryMovement from "../src/models/InventoryMovement.js";
import * as inventoryService from "../src/services/inventoryService.js";
import { createOfflinePosSale, getSellerPosSales } from "../src/controllers/orderController.js";
import {
  adjustStock,
  deductStock,
  restoreStock,
  manualStockCorrection,
  validateAvailableQuantity,
} from "../src/services/inventoryService.js";

const mongoose = Product.db.base;

describe("inventory service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("deducts stock and records a movement", async () => {
    const product = { _id: "product-1", sellerId: "seller-1", stock: 10, name: "Desk Lamp" };
    vi.spyOn(Product, "findOne")
      .mockResolvedValueOnce(product)
      .mockResolvedValueOnce({ ...product, stock: 8 });
    vi.spyOn(Product, "updateOne").mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });
    vi.spyOn(InventoryMovement, "findOne").mockResolvedValue(null);
    vi.spyOn(InventoryMovement, "create").mockResolvedValue([
      {
        _id: "move-1",
        sellerId: "seller-1",
        productId: "product-1",
        quantity: 2,
        movementType: "SALE",
        reason: "Order",
        referenceId: "order-1",
        previousStock: 10,
        newStock: 8,
        idempotencyKey: "order-1-product-1",
      },
    ]);

    const result = await deductStock({
      sellerId: "seller-1",
      productId: "product-1",
      quantity: 2,
      reason: "Order",
      referenceId: "order-1",
      movementType: "SALE",
      idempotencyKey: "order-1-product-1",
    });

    expect(result.duplicate).toBe(false);
    expect(result.product.stock).toBe(8);
    expect(result.movement.movementType).toBe("SALE");
    expect(Product.updateOne).toHaveBeenCalledWith(
      { _id: "product-1", sellerId: "seller-1", stock: 10 },
      { $inc: { stock: -2 } },
      { session: undefined }
    );
  });

  it("blocks stock deduction when stock is insufficient", async () => {
    const product = { _id: "product-2", sellerId: "seller-1", stock: 1, name: "Notebook" };
    vi.spyOn(Product, "findOne").mockResolvedValue(product);

    await expect(deductStock({
      sellerId: "seller-1",
      productId: "product-2",
      quantity: 2,
      reason: "Order",
      referenceId: "order-2",
      movementType: "SALE",
      idempotencyKey: "order-2-product-2",
    })).rejects.toThrow("Insufficient stock");
  });

  it("restores stock after cancellation and records a compensating movement", async () => {
    const product = { _id: "product-3", sellerId: "seller-1", stock: 5, name: "Bottle" };
    vi.spyOn(Product, "findOne")
      .mockResolvedValueOnce(product)
      .mockResolvedValueOnce({ ...product, stock: 7 });
    vi.spyOn(Product, "updateOne").mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });
    vi.spyOn(InventoryMovement, "findOne").mockResolvedValue(null);
    vi.spyOn(InventoryMovement, "create").mockResolvedValue([
      { _id: "move-3", sellerId: "seller-1", productId: "product-3", quantity: 2, movementType: "ORDER_CANCELLED", previousStock: 5, newStock: 7 },
    ]);

    const result = await restoreStock({
      sellerId: "seller-1",
      productId: "product-3",
      quantity: 2,
      reason: "Order cancelled",
      referenceId: "order-3",
      movementType: "ORDER_CANCELLED",
      idempotencyKey: "cancel-order-3-product-3",
    });

    expect(result.product.stock).toBe(7);
    expect(result.movement.movementType).toBe("ORDER_CANCELLED");
  });

  it("rejects duplicate idempotency requests without reapplying stock changes", async () => {
    const secondResult = { duplicate: true, product: { stock: 8 }, movement: { movementType: "SALE" } };
    vi.spyOn(InventoryMovement, "findOne").mockResolvedValue({
      _id: "existing-move",
      sellerId: "seller-1",
      productId: "product-1",
      idempotencyKey: "dup-key",
    });

    const result = await adjustStock({
      sellerId: "seller-1",
      productId: "product-1",
      delta: -2,
      reason: "Duplicate retry",
      referenceId: "order-dup",
      movementType: "SALE",
      idempotencyKey: "dup-key",
    });

    expect(result).toMatchObject(secondResult);
  });

  it("supports manual stock adjustment and validates available quantity", async () => {
    const product = { _id: "product-4", sellerId: "seller-1", stock: 4, name: "Jar" };
    vi.spyOn(Product, "findOne")
      .mockResolvedValueOnce(product)
      .mockResolvedValueOnce({ ...product, stock: 9 });
    vi.spyOn(Product, "updateOne").mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });
    vi.spyOn(InventoryMovement, "findOne").mockResolvedValue(null);
    vi.spyOn(InventoryMovement, "create").mockResolvedValue([
      { _id: "move-4", sellerId: "seller-1", productId: "product-4", quantity: 5, movementType: "MANUAL_ADJUSTMENT", previousStock: 4, newStock: 9 },
    ]);

    const adjusted = await manualStockCorrection({
      sellerId: "seller-1",
      productId: "product-4",
      targetStock: 9,
      reason: "Manual stock correction",
      referenceId: "adjust-4",
      movementType: "MANUAL_ADJUSTMENT",
      idempotencyKey: "adjust-4-product-4",
    });

    expect(adjusted.product.stock).toBe(9);
    expect(adjusted.movement.movementType).toBe("MANUAL_ADJUSTMENT");

    await expect(validateAvailableQuantity({ sellerId: "seller-1", productId: "product-4", quantity: 10 })).resolves.toMatchObject({ available: 9 });
  });

  it("keeps manual stock adjustments atomic when the ledger write fails", async () => {
    const session = { id: "session-5" };
    vi.spyOn(Product, "findOne").mockReturnValue({
      session: vi.fn().mockResolvedValue({ _id: "product-5", sellerId: "seller-1", stock: 4, name: "Jar" }),
    });
    vi.spyOn(Product, "updateOne").mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });
    vi.spyOn(InventoryMovement, "findOne").mockResolvedValue(null);
    vi.spyOn(InventoryMovement, "create").mockRejectedValueOnce(new Error("ledger write failed"));

    await expect(manualStockCorrection({
      sellerId: "seller-1",
      productId: "product-5",
      targetStock: 9,
      reason: "Manual stock correction",
      referenceId: "adjust-5",
      movementType: "MANUAL_ADJUSTMENT",
      idempotencyKey: "manual-adjust-5",
      session,
    })).rejects.toThrow("ledger write failed");

    expect(Product.updateOne).toHaveBeenCalledWith(
      { _id: "product-5", sellerId: "seller-1", stock: 4 },
      { $set: { stock: 9 } },
      { session }
    );
  });

  it("rejects invalid manual stock values before changing stock or writing a movement", async () => {
    vi.spyOn(Product, "findOne").mockResolvedValue({ _id: "product-6", sellerId: "seller-1", stock: 4 });
    vi.spyOn(InventoryMovement, "findOne").mockResolvedValue(null);
    const updateStock = vi.spyOn(Product, "updateOne");
    const createMovement = vi.spyOn(InventoryMovement, "create");

    await expect(manualStockCorrection({
      sellerId: "seller-1",
      productId: "product-6",
      targetStock: 1.5,
      referenceId: "invalid-adjustment",
    })).rejects.toMatchObject({ status: 400 });

    expect(updateStock).not.toHaveBeenCalled();
    expect(createMovement).not.toHaveBeenCalled();
  });

  it("rejects a stale concurrent stock correction without writing a ledger movement", async () => {
    vi.spyOn(Product, "findOne").mockResolvedValue({ _id: "product-7", sellerId: "seller-1", stock: 4 });
    vi.spyOn(InventoryMovement, "findOne").mockResolvedValue(null);
    vi.spyOn(Product, "updateOne").mockResolvedValue({ matchedCount: 0, modifiedCount: 0 });
    const createMovement = vi.spyOn(InventoryMovement, "create");

    await expect(manualStockCorrection({
      sellerId: "seller-1",
      productId: "product-7",
      targetStock: 8,
      referenceId: "concurrent-adjustment",
    })).rejects.toMatchObject({ status: 409, message: "Stock changed concurrently. Refresh and retry." });

    expect(Product.updateOne).toHaveBeenCalledWith(
      { _id: "product-7", sellerId: "seller-1", stock: 4 },
      { $set: { stock: 8 } },
      { session: undefined }
    );
    expect(createMovement).not.toHaveBeenCalled();
  });

  it("rejects duplicate POS requests before stock is deducted", async () => {
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    vi.spyOn(Order, "findOne").mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: "sale-pos-duplicate",
        orderReference: "SL-2001",
        orderStatus: "CONFIRMED",
        totalAmount: 290,
        paymentMethod: "CASH",
        createdAt: new Date(),
      }),
    });

    await createOfflinePosSale({
      body: {
        requestId: "123e4567-e89b-42d3-a456-426614174000",
        paymentMethod: "CASH",
        items: [{ productId: "product-pos-1", quantity: 2 }],
      },
      user: { userId: "seller-1" },
    }, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, message: "This POS sale was already recorded." }));
  });

  it("rejects offline POS sales that exceed available stock", async () => {
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    vi.spyOn(Order, "findOne").mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });
    vi.spyOn(Product, "find").mockReturnValue({
      lean: vi.fn().mockResolvedValue([
        { _id: "product-pos-3", sellerId: "seller-1", name: "Marker", category: "Office", price: 40, stock: 1 },
      ]),
    });

    await createOfflinePosSale({
      body: {
        requestId: "123e4567-e89b-42d3-a456-426614174001",
        paymentMethod: "CARD",
        items: [{ productId: "product-pos-3", quantity: 2 }],
      },
      user: { userId: "seller-1" },
    }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, message: "Insufficient stock for Marker." }));
  });

  it("records offline POS payment and order snapshots while delegating stock deduction to the inventory service", async () => {
    const session = { withTransaction: vi.fn(async (callback) => callback()), endSession: vi.fn() };
    vi.spyOn(mongoose, "startSession").mockResolvedValue(session);
    vi.spyOn(Order, "findOne").mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });
    vi.spyOn(Product, "find").mockReturnValue({ lean: vi.fn().mockResolvedValue([{ _id: "product-pos-sale", sellerId: "seller-1", name: "Notebook", category: "Stationery", price: 12.5, stock: 4 }]) });
    const deduct = vi.spyOn(inventoryService, "deductStock").mockResolvedValue({ duplicate: false, product: { stock: 2 } });
    vi.spyOn(Order, "create").mockResolvedValue([{ _id: "sale-pos-1", orderReference: "SL-POS-1", orderStatus: "CONFIRMED", totalAmount: 25, paymentMethod: "UPI", createdAt: new Date() }]);
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await createOfflinePosSale({
      body: { requestId: "123e4567-e89b-42d3-a456-426614174002", paymentMethod: "UPI", items: [{ productId: "product-pos-sale", quantity: 2 }] },
      user: { userId: "seller-1" },
    }, res);

    expect(deduct).toHaveBeenCalledWith(expect.objectContaining({ sellerId: "seller-1", productId: "product-pos-sale", quantity: 2, movementType: "SALE", session, idempotencyKey: "123e4567-e89b-42d3-a456-426614174002:product-pos-sale:offline" }));
    expect(Order.create).toHaveBeenCalledWith([expect.objectContaining({ orderType: "OFFLINE_POS", totalAmount: 25, subtotal: 25, discountAmount: 0, paymentMethod: "UPI", paymentStatus: "VERIFIED", paymentVerificationMethod: "SELLER_MANUAL", orderStatus: "CONFIRMED" })], { session });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, sale: expect.objectContaining({ orderReference: "SL-POS-1", totalAmount: 25, paymentMethod: "UPI" }) }));
    expect(session.endSession).toHaveBeenCalledOnce();
  });

  it("lists only seller-scoped POS sales history", async () => {
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    vi.spyOn(Order, "find").mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
    });
    vi.spyOn(Order, "countDocuments").mockResolvedValue(1);
    const leanQuery = vi.fn().mockResolvedValue([
      { _id: "sale-1", orderReference: "SL-2001", orderType: "OFFLINE_POS", paymentMethod: "CASH", totalAmount: 300, orderStatus: "CONFIRMED" },
    ]);
    vi.mocked(Order.find).mockReturnValue({
      sort: vi.fn().mockReturnValue({
        skip: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({ lean: leanQuery }),
        }),
      }),
    });

    await getSellerPosSales({
      user: { userId: "seller-1" },
      query: { page: "1", limit: "20" },
    }, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, total: 1 }));
  });

  it("isolates stock updates to the matching seller", async () => {
    vi.spyOn(Product, "findOne").mockResolvedValue(null);

    await expect(deductStock({
      sellerId: "seller-1",
      productId: "product-other",
      quantity: 1,
      reason: "Seller isolation",
      referenceId: "isolated",
      movementType: "SALE",
      idempotencyKey: "isolated-key",
    })).rejects.toThrow("Product not found");
  });
});
