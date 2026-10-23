import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import app from "../src/app.js";
import User from "../src/models/User.js";
import Seller from "../src/models/Seller.js";
import Product from "../src/models/Product.js";
import Order from "../src/models/Order.js";
import Notification from "../src/models/Notification.js";
import AuthSession from "../src/models/AuthSession.js";
import { summarizeOrderValues } from "../src/utils/customerMetrics.js";

// Use the Mongoose instance already bound to the application models. A nested
// server/src/node_modules install otherwise gives the test a separate default connection.
const mongoose = User.db.base;

const stagingUri = process.env.STAGING_MONGODB_URI;
const enabled = process.env.RUN_STAGING_INTEGRATION === "1";
const stagingTarget = (uri) => {
  let parsed;
  try { parsed = new URL(uri); } catch { throw new Error("STAGING_MONGODB_URI must be a valid MongoDB URI."); }
  if (!["mongodb:", "mongodb+srv:"].includes(parsed.protocol)) throw new Error("STAGING_MONGODB_URI must use mongodb:// or mongodb+srv://.");
  return {
    host: parsed.host.toLowerCase(),
    database: decodeURIComponent(parsed.pathname.replace(/^\//, "")),
    username: decodeURIComponent(parsed.username),
  };
};
const ids = { users: [], sellers: [], products: [], productSkus: [], orders: [], orderKeys: [] };
const testSecret = "local-staging-integration-only-secret-32-chars";
const sessionTokens = new Map();

const assertStagingDatabase = (uri) => {
  if (!uri) throw new Error("Set STAGING_MONGODB_URI to run staging integration tests.");
  const { host, database } = stagingTarget(uri);
  if (!/(^|[_-])(staging|test)([_-]|$)/i.test(database)) {
    throw new Error("Refusing integration tests: database name must explicitly contain staging or test.");
  }
  if (!process.env.STAGING_DATABASE_CONFIRM || process.env.STAGING_DATABASE_CONFIRM !== database) {
    throw new Error("Refusing integration tests: set STAGING_DATABASE_CONFIRM to the exact staging database name.");
  }
  if (!process.env.STAGING_HOST_CONFIRM || process.env.STAGING_HOST_CONFIRM.toLowerCase() !== host) {
    throw new Error("Refusing integration tests: set STAGING_HOST_CONFIRM to the exact host in STAGING_MONGODB_URI.");
  }
 const parsedUri = new URL(uri);

const isLocalUnauthenticatedStaging =
  ["localhost", "127.0.0.1", "::1"].includes(parsedUri.hostname.toLowerCase()) &&
  (parsedUri.port || "27017") === "27017" &&
  !parsedUri.username &&
  !parsedUri.password;

if (
  !isLocalUnauthenticatedStaging &&
  !/[\w-]*(staging|test)[\w-]*/i.test(parsedUri.username)
) {
  throw new Error(
    "Refusing integration tests: remote staging databases require a dedicated staging/test username."
  );
}
};

const assertStagingTargetMarker = async () => {
  const database = mongoose.connection.db;
  const marker = await database.collection("_supplylink_staging_test_guard").findOne({ _id: "staging-integration-target" });
  const target = stagingTarget(stagingUri);
  if (!marker || marker.environment !== "staging" || marker.database !== target.database || marker.host !== target.host || marker.allowTestWrites !== true) {
    throw new Error("Refusing integration tests: staging target marker is missing or does not match this URI. Create it only in the dedicated staging database.");
  }
};

const runWithServer = async (callback) => {
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await callback(base);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
};

const authHeaders = (userId) => ({
  Authorization: `Bearer ${sessionTokens.get(String(userId))}`,
  "Content-Type": "application/json",
});

const submitOrder = (base, slug, productId, requestId, quantity = 1, overrides = {}) => fetch(`${base}/api/store/${slug}/orders`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    requestId,
    paymentMethod: "COD",
    sellerId: overrides.sellerId,
    items: [{ productId: String(productId), quantity, ...(overrides.price === undefined ? {} : { price: overrides.price }) }],
    customer: { name: "Staging Buyer", phone: "+919876543210", address: "10 Test Road", postalCode: "560001" },
  }),
});

const createMetricsOrder = (sellerId, suffix, amount, email) => Order.create({
  sellerId,
  orderReference: `METRICS-${suffix}-${randomUUID()}`,
  customer: { name: "Metrics Buyer", email, phone: "+919876543210", address: "Test address" },
  items: [],
  subtotal: amount,
  totalAmount: amount,
  paymentMethod: "UPI",
  paymentStatus: "VERIFIED",
  orderStatus: "CONFIRMED",
});

describe.skipIf(!enabled)("staging MongoDB integration (requires explicit isolated database)", () => {
  let sellerA;
  let sellerB;
  let productA;
  let productB;
  let originalJwtSecret;

  beforeAll(async () => {
    assertStagingDatabase(stagingUri);
    originalJwtSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = testSecret;
    await mongoose.connect(stagingUri, { serverSelectionTimeoutMS: 8000 });
    await assertStagingTargetMarker();
    await Promise.all([User.init(), AuthSession.init(), Seller.init(), Product.init(), Order.init(), Notification.init()]);
    const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
    const userA = await User.create({ name: `Staging A ${suffix}`, email: `staging-a-${suffix}@example.invalid`, password: "unused-test-hash", emailVerified: true });
    ids.users.push(userA._id);
    const userB = await User.create({ name: `Staging B ${suffix}`, email: `staging-b-${suffix}@example.invalid`, password: "unused-test-hash", emailVerified: true });
    ids.users.push(userB._id);
    for (const user of [userA, userB]) {
      const sessionId = randomUUID();
      await AuthSession.create({ sessionId, userId: user._id, expiresAt: new Date(Date.now() + 60 * 60 * 1000) });
      sessionTokens.set(String(user._id), jwt.sign({ userId: String(user._id), role: "seller", emailVerified: true, jti: sessionId }, testSecret, { expiresIn: "1h" }));
    }
    sellerA = await Seller.create({ userId: userA._id, email: userA.email, businessName: "Staging A", storeSlug: `staging-a-${suffix}`, phone: "+919876543210", whatsapp: "+919876543210", plan: "launch", subscriptionStatus: "active", planExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), status: "active", isPublished: true });
    ids.sellers.push(sellerA._id);
    sellerB = await Seller.create({ userId: userB._id, email: userB.email, businessName: "Staging B", storeSlug: `staging-b-${suffix}`, phone: "+919876543211", whatsapp: "+919876543211", status: "active", isPublished: true });
    ids.sellers.push(sellerB._id);
    productA = await Product.create({ sellerId: userA._id, name: "A product", slug: `a-${suffix}`, sku: `A-${suffix}`, category: "test", price: 100, stock: 3, status: "published", isPublished: true });
    ids.products.push(productA._id);
    productB = await Product.create({ sellerId: userB._id, name: "B product", slug: `b-${suffix}`, sku: `B-${suffix}`, category: "test", price: 200, stock: 4, status: "published", isPublished: true });
    ids.products.push(productB._id);
    const inventoryProduct = await Product.create({ sellerId: userA._id, name: "Concurrent inventory", slug: `inventory-${suffix}`, sku: `I-${suffix}`, category: "test", price: 75, stock: 3, status: "published", isPublished: true });
    ids.products.push(inventoryProduct._id);
  }, 20000);

  afterAll(async () => {
    console.log(
      "[staging cleanup] Starting. Connection state:",
      mongoose.connection.readyState,
    );

    try {
      if (mongoose.connection.readyState === 1) {
        const cleanups = [
          [
            "orders",
            () =>
              Order.deleteMany({
                $or: [
                  { _id: { $in: ids.orders } },
                  ...ids.orderKeys.map(({ sellerId, requestId }) => ({
                    sellerId,
                    clientRequestId: requestId,
                  })),
                ],
              }),
          ],
          [
            "notifications",
            () =>
              Notification.deleteMany({
                sellerId: { $in: ids.users },
              }),
          ],
          [
            "sessions",
            () =>
              AuthSession.deleteMany({
                userId: { $in: ids.users },
              }),
          ],
          [
            "products",
            () =>
              Product.deleteMany({
                $or: [
                  { _id: { $in: ids.products } },
                  { sku: { $in: ids.productSkus } },
                ],
              }),
          ],
          [
            "sellers",
            () =>
              Seller.deleteMany({
                _id: { $in: ids.sellers },
              }),
          ],
          [
            "users",
            () =>
              User.deleteMany({
                _id: { $in: ids.users },
              }),
          ],
        ];

        let remainingErrors = [];

        for (let attempt = 1; attempt <= 3; attempt += 1) {
          console.log(`[staging cleanup] Attempt ${attempt} of 3`);

          const results = await Promise.allSettled(
            cleanups.map(async ([name, cleanup]) => {
              console.log(`[staging cleanup] ${name}: starting`);

              const result = await cleanup();

              console.log(
                `[staging cleanup] ${name}: completed`,
                `deleted=${result.deletedCount ?? "unknown"}`,
              );

              return result;
            }),
          );

          remainingErrors = results
            .filter((result) => result.status === "rejected")
            .map((result) => result.reason);

          if (remainingErrors.length === 0) {
            console.log("[staging cleanup] All deletions completed");
            break;
          }

          console.error(
            "[staging cleanup] Failed operations:",
            remainingErrors.map((error) => error.message),
          );

          if (attempt < 3) {
            await new Promise((resolve) =>
              setTimeout(resolve, attempt * 250),
            );
          }
        }

        if (remainingErrors.length > 0) {
          throw new AggregateError(
            remainingErrors,
            "Staging fixture cleanup failed after three attempts.",
          );
        }
      } else {
        console.warn(
          "[staging cleanup] MongoDB is not connected; skipping deletions.",
        );
      }
    } catch (error) {
      console.error(
        "[staging cleanup] Cleanup failed:",
        error.message,
      );

      throw error;
    } finally {
      console.log(
        "[staging cleanup] Disconnecting. Connection state:",
        mongoose.connection.readyState,
      );

      if (mongoose.connection.readyState !== 0) {
        try {
          await mongoose.disconnect();
          console.log("[staging cleanup] MongoDB disconnected");
        } catch (error) {
          console.error(
            "[staging cleanup] Disconnect failed:",
            error.message,
          );
          throw error;
        }
      }

      if (originalJwtSecret === undefined) {
        delete process.env.JWT_SECRET;
      } else {
        process.env.JWT_SECRET = originalJwtSecret;
      }

      console.log("[staging cleanup] Finished");
    }
  }, 60000);



  it("keeps customer metrics consistent and seller-scoped with overlapping contacts", async () => {
    const email = `overlap-${randomUUID()}@example.invalid`;
    const ownOrders = await Promise.all([
      createMetricsOrder(sellerA.userId, "A1", 125, email),
      createMetricsOrder(sellerA.userId, "A2", 50, email),
    ]);
    const foreignOrder = await createMetricsOrder(sellerB.userId, "B1", 200, email);
    ids.orders.push(...ownOrders.map((order) => order._id), foreignOrder._id);

    await runWithServer(async (base) => {
      const [customersResponse, dashboardResponse, foreignResponse] = await Promise.all([
        fetch(`${base}/api/sellers/customers?sellerId=${sellerB.userId}`, { headers: authHeaders(sellerA.userId) }),
        fetch(`${base}/api/sellers/dashboard?sellerId=${sellerB.userId}`, { headers: authHeaders(sellerA.userId) }),
        fetch(`${base}/api/sellers/customers`, { headers: authHeaders(sellerB.userId) }),
      ]);
      const customersBody = await customersResponse.json();
      const dashboardBody = await dashboardResponse.json();
      const foreignBody = await foreignResponse.json();
      const ownCustomer = customersBody.customers.find((customer) => customer.email === email);
      const foreignCustomer = foreignBody.customers.find((customer) => customer.email === email);
      expect(customersResponse.status).toBe(200);
      expect(dashboardResponse.status).toBe(200);
      expect(foreignResponse.status).toBe(200);
      expect(ownCustomer.orderCount).toBe(2);
      expect(ownCustomer.recognizedSpend).toBe(175);
      expect(foreignCustomer.orderCount).toBe(1);
      expect(foreignCustomer.recognizedSpend).toBe(200);
      expect(dashboardBody.analytics.customerCount).toBe(customersBody.customers.length);
    });
  });

  it("isolates seller records and public store data across two tenants", async () => {
    await runWithServer(async (base) => {
      const secondProductSku = `A-SECOND-${String(sellerA.userId).slice(-6)}`;
      ids.productSkus.push(secondProductSku);
      const createOwnedProduct = await fetch(`${base}/api/products`, {
        method: "POST", headers: authHeaders(sellerA.userId),
        body: JSON.stringify({ sellerId: String(sellerB.userId), name: "A second product", category: "test", sku: secondProductSku, price: 50, stock: 1, status: "published" }),
      });
      expect(createOwnedProduct.status).toBe(201);
      const createdProduct = (await createOwnedProduct.json()).product;
      ids.products.push(createdProduct._id);
      expect(String(createdProduct.sellerId)).toBe(String(sellerA.userId));

      const getForeignProduct = await fetch(`${base}/api/products/${productB._id}`, { headers: authHeaders(sellerA.userId) });
      expect(getForeignProduct.status).toBe(404);
      const ownProductList = await fetch(`${base}/api/products?sellerId=${sellerB.userId}`, { headers: authHeaders(sellerA.userId) });
      expect((await ownProductList.json()).products.map((item) => String(item.sellerId))).not.toContain(String(sellerB.userId));
      const editForeignProduct = await fetch(`${base}/api/products/${productB._id}`, {
        method: "PUT", headers: authHeaders(sellerA.userId), body: JSON.stringify({ name: "Hijacked" }),
      });
      expect(editForeignProduct.status).toBe(404);
      const foreignInventoryUpdate = await fetch(`${base}/api/products/${productB._id}/stock`, {
        method: "PATCH", headers: authHeaders(sellerA.userId), body: JSON.stringify({ delta: -1 }),
      });
      expect(foreignInventoryUpdate.status).toBe(404);
      expect((await Product.findById(productB._id)).stock).toBe(4);

      const foreignSettings = await fetch(`${base}/api/sellers/store-settings`, {
        method: "PUT", headers: authHeaders(sellerA.userId),
        body: JSON.stringify({ businessName: "Hijack", storeSlug: sellerB.storeSlug, description: "", whatsapp: "+919876543210" }),
      });
      expect(foreignSettings.status).toBe(409);
      expect((await Seller.findById(sellerB._id)).businessName).toBe("Staging B");

      const ownSettings = await fetch(`${base}/api/sellers/store-settings`, {
        method: "PUT", headers: authHeaders(sellerA.userId),
        body: JSON.stringify({ sellerId: String(sellerB.userId), businessName: "Staging A Updated", storeSlug: sellerA.storeSlug, description: "Staging store", whatsapp: "+919876543210" }),
      });
      expect(ownSettings.status).toBe(200);

      await Seller.updateOne({ _id: sellerA._id }, {
        $set: { plan: "launch", subscriptionStatus: "active", planExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
      });
      const [billingA, billingB] = await Promise.all([
        fetch(`${base}/api/billing/status`, { headers: authHeaders(sellerA.userId) }),
        fetch(`${base}/api/billing/status`, { headers: authHeaders(sellerB.userId) }),
      ]);
      expect((await billingA.json()).subscription.plan).toBe("launch");
      expect((await billingB.json()).subscription.plan).toBe("free");

      const publicStore = await fetch(`${base}/api/store/${sellerB.storeSlug}`);
      expect(publicStore.status).toBe(200);
      const publicData = await publicStore.json();
      expect(publicData.products.map((item) => item.name)).toEqual(["B product"]);
      expect(publicData.store).not.toHaveProperty("phone");
      expect(publicData.store).not.toHaveProperty("whatsapp");

      for (const path of ["/api/sellers/me", "/api/sellers/dashboard", "/api/products/", "/api/orders"]) {
        expect((await fetch(`${base}${path}`)).status).toBe(401);
      }
    });
  });

  it("scopes notification reads, updates, and deletion to the authenticated seller", async () => {
    const foreignNotification = await Notification.create({
      sellerId: sellerB.userId,
      type: "system",
      title: "Seller B notice",
      message: "Private to seller B",
    });

    await runWithServer(async (base) => {
      const sellerAList = await fetch(`${base}/api/notifications?sellerId=${sellerB.userId}`, { headers: authHeaders(sellerA.userId) });
      const sellerAItems = (await sellerAList.json()).notifications;
      expect(sellerAItems.some((item) => String(item._id) === String(foreignNotification._id))).toBe(false);
      expect((await fetch(`${base}/api/notifications/${foreignNotification._id}/read`, {
        method: "PATCH", headers: authHeaders(sellerA.userId),
      })).status).toBe(404);
      expect((await fetch(`${base}/api/notifications/${foreignNotification._id}`, {
        method: "DELETE", headers: authHeaders(sellerA.userId),
      })).status).toBe(404);
      expect((await Notification.findById(foreignNotification._id)).read).toBe(false);
    });
  });

  it("uses trusted seller and product values and rejects invalid or unavailable quantities", async () => {
    const acceptedRequestId = randomUUID();
    const invalidQuantityRequestId = randomUUID();
    const unavailableQuantityRequestId = randomUUID();
    ids.orderKeys.push(
      { sellerId: sellerA.userId, requestId: acceptedRequestId },
      { sellerId: sellerA.userId, requestId: invalidQuantityRequestId },
      { sellerId: sellerA.userId, requestId: unavailableQuantityRequestId },
    );

    await runWithServer(async (base) => {
      const initialStock = (await Product.findById(productA._id)).stock;
      const accepted = await submitOrder(base, sellerA.storeSlug, productA._id, acceptedRequestId, 1, {
        sellerId: String(sellerB.userId),
        price: 1,
      });
      expect(accepted.status).toBe(201);
      const acceptedBody = await accepted.json();
      const order = await Order.findOne({ sellerId: sellerA.userId, clientRequestId: acceptedRequestId }).select("+clientRequestId");
      ids.orders.push(order._id);
      expect(order.sellerId.toString()).toBe(String(sellerA.userId));
      expect(order.items[0].unitPrice).toBe(100);
      expect(order.items[0].lineTotal).toBe(100);
      expect(order.totalAmount).toBe(100);
      expect(acceptedBody.order.totalAmount).toBe(100);
      expect((await Product.findById(productA._id)).stock).toBe(initialStock - 1);

      const cancel = await fetch(`${base}/api/orders/${order._id}/status`, {
        method: "PATCH",
        headers: authHeaders(sellerA.userId),
        body: JSON.stringify({ orderStatus: "CANCELLED" }),
      });
      expect(cancel.status).toBe(200);
      expect((await Product.findById(productA._id)).stock).toBe(initialStock);

      const invalidQuantity = await submitOrder(base, sellerA.storeSlug, productA._id, invalidQuantityRequestId, 0);
      const unavailableQuantity = await submitOrder(base, sellerA.storeSlug, productA._id, unavailableQuantityRequestId, 4);
      expect(invalidQuantity.status).toBe(400);
      expect(unavailableQuantity.status).toBe(400);
      expect(await Order.countDocuments({ sellerId: sellerA.userId, clientRequestId: { $in: [invalidQuantityRequestId, unavailableQuantityRequestId] } })).toBe(0);
      expect((await Product.findById(productA._id)).stock).toBe(initialStock);
    });
  });

  it("revokes an authenticated session at logout", async () => {
    const sessionId = randomUUID();
    await AuthSession.create({ sessionId, userId: sellerA.userId, expiresAt: new Date(Date.now() + 60 * 60 * 1000) });
    const token = jwt.sign({ userId: String(sellerA.userId), role: "seller", emailVerified: true, jti: sessionId }, testSecret, { expiresIn: "1h" });
    const headers = { Authorization: `Bearer ${token}` };

    await runWithServer(async (base) => {
      expect((await fetch(`${base}/api/auth/logout`, { method: "POST", headers })).status).toBe(200);
      expect((await fetch(`${base}/api/orders`, { headers })).status).toBe(401);
    });
  });

  it("applies competing inventory decrements atomically without going negative", async () => {
    const product = await Product.findOne({ sellerId: sellerA.userId, sku: { $regex: /^I-/ } });
    await runWithServer(async (base) => {
      const update = () => fetch(`${base}/api/products/${product._id}/stock`, {
        method: "PATCH", headers: authHeaders(sellerA.userId), body: JSON.stringify({ delta: -2 }),
      });
      const responses = await Promise.all([update(), update()]);
      expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
      expect((await Product.findById(product._id)).stock).toBe(1);
    });
  });

  it("deduplicates repeated checkout, prevents concurrent overselling, and restores stock once on cancellation", async () => {
    const baselineSellerAOrders = await Order.find({ sellerId: sellerA.userId }).lean();
    const baselineSellerBOrders = await Order.find({ sellerId: sellerB.userId }).lean();
    const baselineSellerARevenue = summarizeOrderValues(baselineSellerAOrders).recognizedSales;
    const baselineSellerBRevenue = summarizeOrderValues(baselineSellerBOrders).recognizedSales;
    await runWithServer(async (base) => {
      const sameRequestId = randomUUID();
      ids.orderKeys.push({ sellerId: sellerA.userId, requestId: sameRequestId });
      const repeated = await Promise.all([
        submitOrder(base, sellerA.storeSlug, productA._id, sameRequestId),
        submitOrder(base, sellerA.storeSlug, productA._id, sameRequestId),
      ]);
      const repeatedBodies = await Promise.all(repeated.map((response) => response.json()));
      expect(repeated.map((response) => response.status).sort()).toEqual([200, 201]);
      expect(repeatedBodies[0].order.orderReference).toBe(repeatedBodies[1].order.orderReference);
      ids.orders.push((await Order.findOne({ sellerId: sellerA.userId, clientRequestId: sameRequestId }).select("+clientRequestId"))._id);
      expect((await Product.findById(productA._id)).stock).toBe(2);
      expect(await Notification.countDocuments({
        sellerId: sellerA.userId,
        type: "order_created",
        "data.orderReference": repeatedBodies[0].order.orderReference,
      })).toBe(1);

      const concurrentRequestIds = [randomUUID(), randomUUID()];
      ids.orderKeys.push(...concurrentRequestIds.map((requestId) => ({ sellerId: sellerA.userId, requestId })));
      const simultaneous = await Promise.all(concurrentRequestIds.map((requestId) =>
        submitOrder(base, sellerA.storeSlug, productA._id, requestId, 2)
      ));
      expect(simultaneous.filter((response) => response.status === 201)).toHaveLength(1);
      expect((await Product.findById(productA._id)).stock).toBe(0);

      const latestOrder = await Order.findOne({
        sellerId: sellerA.userId,
        items: { $elemMatch: { productId: productA._id, quantity: 2 } },
      });
      ids.orders.push(latestOrder._id);
      const cancelUrl = `${base}/api/orders/${latestOrder._id}/status`;
      const cancel = (  ) => fetch(cancelUrl, { method: "PATCH", headers: authHeaders(sellerA.userId), body: JSON.stringify({ orderStatus: "CANCELLED" }) });
      expect((await cancel()).status).toBe(200);
      expect((await Product.findById(productA._id)).stock).toBe(2);
      expect((await cancel()).status).toBe(200);
      expect((await Product.findById(productA._id)).stock).toBe(2);

      const sellerBOrders = await fetch(`${base}/api/orders`, { headers: authHeaders(sellerB.userId) });
      expect((await sellerBOrders.json()).orders).toHaveLength(baselineSellerBOrders.length);
      const sellerAOrders = await fetch(`${base}/api/orders?sellerId=${sellerB.userId}`, { headers: authHeaders(sellerA.userId) });
      const list = (await sellerAOrders.json()).orders;
      expect(list).toHaveLength(baselineSellerAOrders.length + 2);
      expect(list.map((order) => order.orderReference)).toContain(repeatedBodies[0].order.orderReference);
      expect(list.map((order) => order.orderReference)).toContain(latestOrder.orderReference);
      expect((await fetch(`${base}/api/orders/${list[0]._id}/status`, {
        method: "PATCH", headers: authHeaders(sellerB.userId), body: JSON.stringify({ orderStatus: "CANCELLED" }),
      })).status).toBe(404);
      const analytics = await fetch(`${base}/api/sellers/dashboard`, { headers: authHeaders(sellerB.userId) });
      const sellerBAnalytics = (await analytics.json()).analytics;
      expect(sellerBAnalytics.totalOrders).toBe(baselineSellerBOrders.length);
      expect(sellerBAnalytics.totalSales).toBe(baselineSellerBRevenue);
      const sellerAAnalytics = await fetch(`${base}/api/sellers/dashboard`, { headers: authHeaders(sellerA.userId) });
      const sellerAAnalyticsBody = await sellerAAnalytics.json();
      expect(sellerAAnalyticsBody.analytics.totalOrders).toBe(baselineSellerAOrders.length + 2);
      expect(sellerAAnalyticsBody.analytics.totalSales).toBe(baselineSellerARevenue);
    });
  });

  it("persists product changes, archives public listings, and preserves order snapshots", async () => {
    const sku = `FLOW-${randomUUID().replaceAll("-", "").slice(0, 10)}`;
    ids.productSkus.push(sku);
    const requestId = randomUUID();
    ids.orderKeys.push({ sellerId: sellerA.userId, requestId });

    await runWithServer(async (base) => {
      const createResponse = await fetch(`${base}/api/products`, {
        method: "POST",
        headers: authHeaders(sellerA.userId),
        body: JSON.stringify({ name: "Workflow Item", category: "test", sku, price: 75, stock: 5, status: "published" }),
      });
      expect(createResponse.status).toBe(201);
      const created = (await createResponse.json()).product;
      ids.products.push(created._id);
      expect(await Product.findById(created._id)).toMatchObject({ name: "Workflow Item", price: 75, stock: 5 });

      const orderResponse = await submitOrder(base, sellerA.storeSlug, created._id, requestId, 2);
      expect(orderResponse.status).toBe(201);
      const order = await Order.findOne({ sellerId: sellerA.userId, clientRequestId: requestId }).select("+clientRequestId");
      ids.orders.push(order._id);
      expect((await Product.findById(created._id)).stock).toBe(3);

      const editResponse = await fetch(`${base}/api/products/${created._id}`, {
        method: "PUT",
        headers: authHeaders(sellerA.userId),
        body: JSON.stringify({ name: "Workflow Item Revised", price: 90 }),
      });
      expect(editResponse.status).toBe(200);
      expect(await Product.findById(created._id)).toMatchObject({ name: "Workflow Item Revised", price: 90 });
      let publicStore = await fetch(`${base}/api/store/${sellerA.storeSlug}`).then((response) => response.json());
      expect(publicStore.products.some((product) => product._id === String(created._id) && product.price === 90)).toBe(true);

      const archiveResponse = await fetch(`${base}/api/products/${created._id}`, {
        method: "PUT",
        headers: authHeaders(sellerA.userId),
        body: JSON.stringify({ status: "archived" }),
      });
      expect(archiveResponse.status).toBe(200);
      expect(await Product.findById(created._id)).toMatchObject({ status: "archived", isPublished: false });
      publicStore = await fetch(`${base}/api/store/${sellerA.storeSlug}`).then((response) => response.json());
      expect(publicStore.products.some((product) => product._id === String(created._id))).toBe(false);

      const confirmResponse = await fetch(`${base}/api/orders/${order._id}/status`, {
        method: "PATCH", headers: authHeaders(sellerA.userId), body: JSON.stringify({ orderStatus: "CONFIRMED" }),
      });
      expect(confirmResponse.status).toBe(200);
      const invalidTransition = await fetch(`${base}/api/orders/${order._id}/status`, {
        method: "PATCH", headers: authHeaders(sellerA.userId), body: JSON.stringify({ orderStatus: "PENDING" }),
      });
      expect(invalidTransition.status).toBe(400);
      expect((await Order.findById(order._id)).orderStatus).toBe("CONFIRMED");

      const orderAfterCatalogChanges = await Order.findById(order._id).lean();
      expect(orderAfterCatalogChanges.items[0]).toMatchObject({ name: "Workflow Item", unitPrice: 75, quantity: 2 });
      const processingResponse = await fetch(`${base}/api/orders/${order._id}/status`, {
        method: "PATCH", headers: authHeaders(sellerA.userId), body: JSON.stringify({ orderStatus: "PROCESSING" }),
      });
      expect(processingResponse.status).toBe(200);
      const cancelFromProcessing = await fetch(`${base}/api/orders/${order._id}/status`, {
        method: "PATCH", headers: authHeaders(sellerA.userId), body: JSON.stringify({ orderStatus: "CANCELLED" }),
      });
      expect(cancelFromProcessing.status).toBe(200);
      expect((await Product.findById(created._id)).stock).toBe(5);
      expect((await Order.findById(order._id)).items[0].name).toBe("Workflow Item");
    });
  });

  it("rolls back stock and order writes when notification insertion fails", async () => {
    const requestId = randomUUID();
    ids.orderKeys.push({ sellerId: sellerA.userId, requestId });
    const product = await Product.findById(productA._id);
    const initialStock = product.stock;
    const initialNotifications = await Notification.countDocuments({ sellerId: sellerA.userId, type: "order_created" });

    await runWithServer(async (base) => {
      const createFailure = vi.spyOn(Notification, "create").mockRejectedValueOnce(new Error("injected staging notification failure"));
      let response;
      try {
        response = await submitOrder(base, sellerA.storeSlug, productA._id, requestId);
      } finally {
        createFailure.mockRestore();
      }
      expect(response.status).toBe(500);
      expect(await Order.countDocuments({ sellerId: sellerA.userId, clientRequestId: requestId })).toBe(0);
      expect((await Product.findById(productA._id)).stock).toBe(initialStock);
      expect(await Notification.countDocuments({ sellerId: sellerA.userId, type: "order_created" })).toBe(initialNotifications);
    });
  });
  it("restores stock exactly once under concurrent cancellation", async () => {
    const requestId = randomUUID();
    ids.orderKeys.push({ sellerId: sellerA.userId, requestId });
    await runWithServer(async (base) => {
      const create = await submitOrder(base, sellerA.storeSlug, productA._id, requestId);
      expect(create.status).toBe(201);
      const order = await Order.findOne({ sellerId: sellerA.userId, clientRequestId: requestId }).select("+clientRequestId");
      ids.orders.push(order._id);
      const stockBefore = (await Product.findById(productA._id)).stock;
      const cancelUrl = `${base}/api/orders/${order._id}/status`;
      const cancel = () => fetch(cancelUrl, { method: "PATCH", headers: authHeaders(sellerA.userId), body: JSON.stringify({ orderStatus: "CANCELLED" }) });
      const results = await Promise.all([cancel(), cancel()]);
      const statuses = results.map((r) => r.status).sort();
      expect(statuses).toContain(200);
      expect((await Product.findById(productA._id)).stock).toBe(stockBefore + 1);
      expect((await Order.findById(order._id)).orderStatus).toBe("CANCELLED");
      const sequential = await cancel();
      expect(sequential.status).toBe(200);
      expect((await Product.findById(productA._id)).stock).toBe(stockBefore + 1);
    });
  });
});

describe("staging URI safety guard", () => {
  it("rejects a production-like database name", () => {
    expect(() => assertStagingDatabase("mongodb://localhost/supplylink?replicaSet=rs0")).toThrow(/Refusing integration tests/);
  });
  it("accepts an explicitly named staging database", () => {
    const previousDatabase = process.env.STAGING_DATABASE_CONFIRM;
    const previousHost = process.env.STAGING_HOST_CONFIRM;
    process.env.STAGING_DATABASE_CONFIRM = "supplylink_staging";
    process.env.STAGING_HOST_CONFIRM = "localhost";
    try {
      expect(() => assertStagingDatabase("mongodb://staging_runner:placeholder@localhost/supplylink_staging?replicaSet=rs0")).not.toThrow();
    } finally {
      if (previousDatabase === undefined) delete process.env.STAGING_DATABASE_CONFIRM;
      else process.env.STAGING_DATABASE_CONFIRM = previousDatabase;
      if (previousHost === undefined) delete process.env.STAGING_HOST_CONFIRM;
      else process.env.STAGING_HOST_CONFIRM = previousHost;
    }
  });
  it("requires exact host and database confirmations", () => {
    const previousDatabase = process.env.STAGING_DATABASE_CONFIRM;
    const previousHost = process.env.STAGING_HOST_CONFIRM;
    delete process.env.STAGING_DATABASE_CONFIRM;
    delete process.env.STAGING_HOST_CONFIRM;
    try {
      expect(() => assertStagingDatabase("mongodb://staging_runner:placeholder@localhost/supplylink_staging?replicaSet=rs0")).toThrow(/STAGING_DATABASE_CONFIRM/);
      process.env.STAGING_DATABASE_CONFIRM = "supplylink_staging";
      expect(() => assertStagingDatabase("mongodb://staging_runner:placeholder@localhost/supplylink_staging?replicaSet=rs0")).toThrow(/STAGING_HOST_CONFIRM/);
    } finally {
      if (previousDatabase === undefined) delete process.env.STAGING_DATABASE_CONFIRM;
      else process.env.STAGING_DATABASE_CONFIRM = previousDatabase;
      if (previousHost === undefined) delete process.env.STAGING_HOST_CONFIRM;
      else process.env.STAGING_HOST_CONFIRM = previousHost;
    }
  });
});
