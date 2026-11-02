import { afterEach, describe, expect, it, vi } from "vitest";
import InventoryMovement from "../src/models/InventoryMovement.js";
import Order from "../src/models/Order.js";
import Product from "../src/models/Product.js";
import { listInventoryMovements } from "../src/controllers/productController.js";
import { getSellerCustomerOrderHistory, getSellerCustomers, getSellerInsights } from "../src/controllers/sellerController.js";
import { getSellerOrders, getSellerPosSales } from "../src/controllers/orderController.js";

const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
const pagedQuery = (value) => ({ sort: vi.fn().mockReturnThis(), skip: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValue(value) });

describe("seller operations APIs are scoped and bounded", () => {
  afterEach(() => vi.restoreAllMocks());

  it("paginates online orders, filters server-side, and excludes offline POS records", async () => {
    const query = pagedQuery([{ _id: "order-1" }]);
    vi.spyOn(Order, "find").mockReturnValue(query);
    vi.spyOn(Order, "countDocuments").mockResolvedValue(135);
    const res = response();
    await getSellerOrders({ user: { userId: "seller-1" }, query: { page: "2", limit: "500", search: ".*", status: "pending", fromDate: "2026-01-01" } }, res);
    const filter = Order.find.mock.calls[0][0];
    expect(filter).toMatchObject({ sellerId: "seller-1", orderType: { $ne: "OFFLINE_POS" }, orderStatus: "PENDING" });
    expect(filter.$or[0].orderReference.$regex).toBe("\\.\\*");
    expect(query.skip).toHaveBeenCalledWith(100);
    expect(query.limit).toHaveBeenCalledWith(100);
    expect(res.body.pagination).toMatchObject({ page: 2, limit: 100, total: 135, totalPages: 2 });
  });

  it("returns only seller-owned inventory movement fields in bounded pages", async () => {
    const query = pagedQuery([{ _id: "movement-1", sellerId: "seller-1", productId: "product-1", quantity: 3, movementType: "RESTOCK", reason: "Count", previousStock: 2, newStock: 5, createdAt: new Date() }]);
    vi.spyOn(InventoryMovement, "find").mockReturnValue(query);
    vi.spyOn(InventoryMovement, "countDocuments").mockResolvedValue(1);
    const productQuery = { select: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValue([{ _id: "product-1", name: "Mug", category: "Home", sku: "INTERNAL" }]) };
    vi.spyOn(Product, "find").mockReturnValue(productQuery);
    const res = response();
    await listInventoryMovements({ user: { userId: "seller-1" }, query: { page: "1", limit: "999", type: "restock" } }, res);
    expect(InventoryMovement.find.mock.calls[0][0]).toMatchObject({ sellerId: "seller-1", movementType: "RESTOCK" });
    expect(query.limit).toHaveBeenCalledWith(100);
    expect(res.body.movements[0]).toMatchObject({ movementType: "RESTOCK", product: { name: "Mug", category: "Home", sku: "INTERNAL" } });
    expect(res.body.movements[0]).not.toHaveProperty("sellerId");
  });

  it("groups and paginates customer data in MongoDB instead of loading every order into application memory", async () => {
    const aggregate = vi.spyOn(Order, "aggregate").mockResolvedValue([{
      customers: [{ _id: "pair:email|phone", name: "A Customer", orderCount: 3, recognizedSpend: 400, latestOrder: { reference: "SL-1", status: "DELIVERED" } }],
      count: [{ total: 31 }], summary: [{ customerCount: 31, repeatCustomers: 4, recognizedSpend: 1900 }],
    }]);
    const res = response();
    await getSellerCustomers({ user: { userId: "seller-1" }, query: { page: "2", limit: "20", search: "customer", fromDate: "2026-01-01" } }, res);
    const pipeline = aggregate.mock.calls[0][0];
    expect(pipeline[0].$match).toMatchObject({ sellerId: "seller-1", createdAt: { $gte: new Date("2026-01-01") } });
    expect(pipeline.some((stage) => stage.$group?.orderCount?.$sum === 1)).toBe(true);
    expect(pipeline.at(-1).$facet.customers).toContainEqual({ $skip: 20 });
    expect(res.body.pagination).toMatchObject({ page: 2, limit: 20, total: 31, totalPages: 2 });
    expect(res.body.summary).toMatchObject({ customerCount: 31, repeatCustomers: 4, recognizedSpend: 1900 });
    expect(res.body.customers[0].orders).toHaveLength(1);
  });

  it("keeps POS records separate and paginates their search results", async () => {
    const query = pagedQuery([{ _id: "pos-1", orderType: "OFFLINE_POS" }]);
    vi.spyOn(Order, "find").mockReturnValue(query);
    vi.spyOn(Order, "countDocuments").mockResolvedValue(1);
    const res = response();
    await getSellerPosSales({ user: { userId: "seller-1" }, query: { page: "1", limit: "20", search: "cashier", paymentMethod: "CASH" } }, res);
    expect(Order.find.mock.calls[0][0]).toMatchObject({ sellerId: "seller-1", orderType: "OFFLINE_POS", paymentMethod: "CASH" });
    expect(query.limit).toHaveBeenCalledWith(20);
    expect(res.body.sales).toHaveLength(1);
  });

  it("returns bounded customer order history only for the authenticated seller and normalized identity", async () => {
    const aggregate = vi.spyOn(Order, "aggregate").mockResolvedValue([{ orders: [{ _id: "order-1", orderStatus: "DELIVERED", totalAmount: 100 }], count: [{ total: 24 }] }]);
    const res = response();
    await getSellerCustomerOrderHistory({ user: { userId: "seller-1" }, body: { identity: { mode: "email", email: " BUYER@EXAMPLE.COM " }, page: 2, limit: 10 } }, res);
    const pipeline = aggregate.mock.calls[0][0];
    expect(pipeline[0].$match).toMatchObject({ sellerId: "seller-1" });
    expect(pipeline.find((stage) => stage.$match?._customerEmail)?.$match).toEqual({ _customerEmail: "buyer@example.com", _customerPhone: "" });
    expect(pipeline.at(-1).$facet.orders).toContainEqual({ $skip: 10 });
    expect(pipeline.at(-1).$facet.orders).toContainEqual({ $limit: 10 });
    expect(res.body.pagination).toMatchObject({ page: 2, total: 24, totalPages: 3 });
  });

  it("builds seller insights from bounded-range recorded sales and inventory aggregates", async () => {
    const orderAggregates = [
      [{ totalRevenue: 120, totalSales: 2, onlineRevenue: 80, offlineRevenue: 40, onlineSalesCount: 1, offlineSalesCount: 1, averageOrderValue: 60 }],
      [{ date: "2026-10-20", revenue: 80, salesCount: 1, onlineRevenue: 80, offlineRevenue: 0 }],
      [], [],
      [{ _id: "product-1", name: "Mug", quantitySold: 2, revenue: 120, onlineRevenue: 80, offlineRevenue: 40 }],
      [],
      [{ customers: [], summary: [{ totalUniqueCustomers: 3, repeatCustomers: 1 }] }],
      [{ periods: [{ _id: "previous", revenue: 200, orderCount: 3 }, { _id: "current", revenue: 120, orderCount: 2 }], decliningProducts: [{ name: "Mug", previousUnits: 4, currentUnits: 2 }] }],
    ];
    const aggregateOrders = vi.spyOn(Order, "aggregate").mockImplementation(async () => orderAggregates.shift() || []);
    const aggregateProducts = vi.spyOn(Product, "aggregate")
      .mockResolvedValueOnce([{ totalProducts: 4, lowStock: 1, outOfStock: 1 }])
      .mockResolvedValueOnce([{ name: "Mug", stock: 1, lowStockThreshold: 3 }])
      .mockResolvedValueOnce([{ name: "Lamp", stock: 8 }])
      .mockResolvedValue([]);
    const res = response();

    await getSellerInsights({ user: { userId: "seller-1" } }, res);

    expect(res.body).toMatchObject({ success: true, connected: true, source: "seller_orders_and_inventory", summary: { inventoryHealth: "1 low-stock and 1 out-of-stock products out of 4.", customerPulse: "3 identified customers; 1 placed more than one order in this range." } });
    expect(res.body.modules).toEqual(expect.arrayContaining([expect.objectContaining({ title: "Top seller in range", insight: expect.stringContaining("Mug recorded 2 units") })]));
    expect(res.body.modules).toEqual(expect.arrayContaining([expect.objectContaining({ title: "Restock attention", insight: expect.stringContaining("Mug: 1 on hand (threshold 3).") }), expect.objectContaining({ title: "Sales declined", insight: expect.stringContaining("sold 4 units") }), expect.objectContaining({ title: "Slow-moving stock", insight: expect.stringContaining("Lamp: 8 units on hand") })]));
    expect(aggregateOrders.mock.calls[0][0][0].$match.sellerId).toBe("seller-1");
    expect(aggregateProducts.mock.calls[0][0][0].$match.sellerId).toBe("seller-1");
  });
});
