import { describe, expect, it, beforeAll, beforeEach, afterEach, afterAll } from "vitest";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import app from "../src/app.js";
import Seller from "../src/models/Seller.js";
import Product from "../src/models/Product.js";
import Order from "../src/models/Order.js";
import AuthSession from "../src/models/AuthSession.js";
import Notification from "../src/models/Notification.js";

// Share the exact Mongoose singleton used to compile the application models.
const mongoose = Seller.db.base;

const makeSeller = (overrides = {}) => {
  const userId = overrides.userId || new mongoose.Types.ObjectId();
  const slug = overrides.storeSlug || `test-store-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return Seller.create({
    userId,
    businessName: overrides.businessName || "Test Seller",
    storeSlug: slug,
    email: overrides.email || `${slug}@example.com`,
    password: "password123",
    phone: "+919999999999",
    whatsapp: "+919999999999",
    status: "active",
    isPublished: true,
    ...overrides,
  });
};

const makeToken = async (userId, secret = "test-only-security-secret-at-least-32-characters") => {
  const sessionId = crypto.randomUUID();
  await AuthSession.create({ sessionId, userId, expiresAt: new Date(Date.now() + 60 * 60 * 1000) });
  return jwt.sign({ userId, role: "seller", emailVerified: true, jti: sessionId }, secret, { expiresIn: "1h" });
};

const makeProduct = (sellerId, overrides = {}) => {
  const suffix = Math.random().toString(36).slice(2, 8);
  return Product.create({
    sellerId,
    name: "Test Product",
    slug: `test-product-${suffix}`,
    sku: `SKU-${suffix}`.toUpperCase(),
    category: "Test",
    price: 1000,
    stock: 10,
    status: "published",
    isPublished: true,
    ...overrides,
  });
};

const hasDb = process.env.RUN_SECURITY_INTEGRATION === "1";
let securityConnectionOpened = false;

const assertDisposableSecurityDatabase = async () => {
  const uri = process.env.STAGING_MONGODB_URI;
  let target;
  try { target = new URL(uri); } catch { throw new Error("Set STAGING_MONGODB_URI to run security integration tests."); }
  if (!["mongodb:", "mongodb+srv:"].includes(target.protocol)) {
    throw new Error("Refusing security integration tests: STAGING_MONGODB_URI must use mongodb:// or mongodb+srv://.");
  }
  const databaseName = decodeURIComponent(target.pathname.replace(/^\//, ""));
  const host = target.host.toLowerCase();
  if (!/(^|[_-])(staging|test)([_-]|$)/i.test(databaseName)) {
    throw new Error("Refusing security integration tests: connected database name must explicitly contain staging or test.");
  }
  if (process.env.SECURITY_DATABASE_CONFIRM !== databaseName) {
    throw new Error("Refusing security integration tests: SECURITY_DATABASE_CONFIRM must exactly match the URI database name.");
  }
  if (!process.env.SECURITY_HOST_CONFIRM || process.env.SECURITY_HOST_CONFIRM.toLowerCase() !== host) {
    throw new Error("Refusing security integration tests: SECURITY_HOST_CONFIRM must exactly match the URI host, including port.");
  }
  const localUnauthenticated = ["localhost", "127.0.0.1", "::1"].includes(target.hostname.toLowerCase())
    && (target.port || "27017") === "27017"
    && !target.username
    && !target.password;
  if (!localUnauthenticated && !/[\w-]*(staging|test)[\w-]*/i.test(decodeURIComponent(target.username))) {
    throw new Error("Refusing security integration tests: remote MongoDB requires a dedicated staging/test username.");
  }

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
    securityConnectionOpened = true;
  } else if (!securityConnectionOpened || mongoose.connection.name !== databaseName) {
    throw new Error("Refusing security integration tests: do not reuse an unrelated preconnected MongoDB session.");
  }
  if (mongoose.connection.name !== databaseName) {
    throw new Error("Refusing security integration tests: connected database does not match the confirmed URI database.");
  }
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  if (!hello.isWritablePrimary || !hello.setName) {
    throw new Error("Refusing security integration tests: target must be a writable replica set or sharded deployment.");
  }
  const marker = await mongoose.connection.db
    .collection("_supplylink_staging_test_guard")
    .findOne({ _id: "staging-integration-target" });
  if (!marker || marker.environment !== "staging" || marker.database !== databaseName || marker.host !== host || marker.allowTestWrites !== true) {
    throw new Error("Refusing security integration tests: matching staging test-write marker is missing.");
  }
};

const cleanupFixtures = async (...sellers) => {
  const userIds = sellers.filter(Boolean).map((seller) => seller.userId);
  if (!userIds.length) return;
  await Promise.all([
    Order.deleteMany({ sellerId: { $in: userIds } }),
    Notification.deleteMany({ sellerId: { $in: userIds } }),
    Product.deleteMany({ sellerId: { $in: userIds } }),
    AuthSession.deleteMany({ userId: { $in: userIds } }),
    Seller.deleteMany({ userId: { $in: userIds } }),
  ]);
};

afterAll(async () => {
  if (securityConnectionOpened) {
    await mongoose.disconnect();
    securityConnectionOpened = false;
  }
});

describe.skipIf(!hasDb)("Cross-tenant security", () => {
  let sellerA;
  let sellerB;
  let productA;
  let productB;
  let tokenA;
  let tokenB;
  let originalSecret;

  beforeAll(assertDisposableSecurityDatabase);

  beforeEach(async () => {
    originalSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = "test-only-security-secret-at-least-32-characters";

    sellerA = await makeSeller({ email: "seller-a@example.com" });
    sellerB = await makeSeller({ email: "seller-b@example.com" });
    productA = await makeProduct(sellerA.userId);
    productB = await makeProduct(sellerB.userId);
    tokenA = await makeToken(sellerA.userId);
    tokenB = await makeToken(sellerB.userId);
  });

  afterEach(async () => {
    process.env.JWT_SECRET = originalSecret;
    await cleanupFixtures(sellerA, sellerB);
  });

  it("prevents seller A from reading seller B's products", async () => {
    const { server, port } = await new Promise((resolve) => {
      const srv = app.listen(0, () => resolve({ server: srv, port: srv.address().port }));
    });

    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/products/${productB._id}`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      expect(response.status).toBe(404);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it("prevents seller A from updating seller B's products", async () => {
    const { server, port } = await new Promise((resolve) => {
      const srv = app.listen(0, () => resolve({ server: srv, port: srv.address().port }));
    });

    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/products/${productB._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({ name: "Hacked by A" }),
      });
      expect(response.status).toBe(404);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it("prevents seller A from changing seller B's inventory", async () => {
    const { server, port } = await new Promise((resolve) => {
      const srv = app.listen(0, () => resolve({ server: srv, port: srv.address().port }));
    });

    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/products/${productB._id}/stock`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${tokenA}`, "Content-Type": "application/json" },
        body: JSON.stringify({ delta: -1 }),
      });
      expect(response.status).toBe(404);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});

describe.skipIf(!hasDb)("Order security", () => {
  let sellerA;
  let sellerB;
  let productB;
  let tokenA;
  let originalSecret;

  beforeAll(assertDisposableSecurityDatabase);

  beforeEach(async () => {
    originalSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = "test-only-security-secret-at-least-32-characters";

    sellerA = await makeSeller({ email: "order-sec-a@example.com" });
    sellerB = await makeSeller({ email: "order-sec-b@example.com" });
    productB = await makeProduct(sellerB.userId);
    tokenA = await makeToken(sellerA.userId);
  });

  afterEach(async () => {
    process.env.JWT_SECRET = originalSecret;
    await cleanupFixtures(sellerA, sellerB);
  });

  it("prevents seller A from updating seller B's order status", async () => {
    const orderB = await Order.create({
      sellerId: sellerB.userId,
      orderReference: "SL-SECURITY-ORDER",
      items: [{ productId: productB._id, name: "Test", quantity: 1, unitPrice: 1000, lineTotal: 1000 }],
      customer: { name: "Buyer", phone: "+919999999999", address: "Test", postalCode: "110001" },
      totalAmount: 1000,
      paymentMethod: "COD",
      paymentStatus: "PENDING",
      orderStatus: "PENDING",
    });

    const { server, port } = await new Promise((resolve) => {
      const srv = app.listen(0, () => resolve({ server: srv, port: srv.address().port }));
    });

    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/orders/${orderB._id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({ orderStatus: "DELIVERED" }),
      });
      expect(response.status).toBe(404);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it("prevents seller A from reading seller B's orders list", async () => {
    await Order.create({
      sellerId: sellerB.userId,
      orderReference: "SL-SECURITY-LIST",
      items: [{ productId: productB._id, name: "Test", quantity: 1, unitPrice: 1000, lineTotal: 1000 }],
      customer: { name: "Buyer", phone: "+919999999999", address: "Test", postalCode: "110001" },
      totalAmount: 1000,
      paymentMethod: "COD",
      paymentStatus: "PENDING",
      orderStatus: "PENDING",
    });

    const { server, port } = await new Promise((resolve) => {
      const srv = app.listen(0, () => resolve({ server: srv, port: srv.address().port }));
    });

    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/orders`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      expect(response.status).toBe(200);
      const body = await response.json();
      for (const order of body.orders || []) {
        expect(String(order.sellerId || order.seller)).not.toBe(String(sellerB.userId));
      }
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});

describe.skipIf(!hasDb)("Price manipulation protection", () => {
  let seller;
  let product;
  let token;
  let originalSecret;

  beforeAll(assertDisposableSecurityDatabase);

  beforeEach(async () => {
    originalSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = "test-only-security-secret-at-least-32-characters";

    seller = await makeSeller({ email: "price-manip@example.com", storeSlug: "test-store" });
    product = await makeProduct(seller.userId, { price: 1000, stock: 10 });
    token = await makeToken(seller.userId);
  });

  afterEach(async () => {
    process.env.JWT_SECRET = originalSecret;
    await cleanupFixtures(seller);
  });

  it("uses the persisted server price when a shopper submits a lower price", async () => {
    const { server, port } = await new Promise((resolve) => {
      const srv = app.listen(0, () => resolve({ server: srv, port: srv.address().port }));
    });

    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/store/test-store/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          items: [{ productId: product._id, quantity: 1, price: 100 }],
          customer: { name: "Buyer", phone: "+919999999999", address: "Test Address", postalCode: "110001" },
          paymentMethod: "COD",
          requestId: crypto.randomUUID(),
        }),
      });
      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.order.totalAmount).toBe(1000);
      const persistedOrder = await Order.findOne({ sellerId: seller.userId, orderReference: body.order.orderReference });
      expect(persistedOrder.items[0].unitPrice).toBe(1000);
      expect(persistedOrder.items[0].lineTotal).toBe(1000);
      expect((await Product.findById(product._id)).stock).toBe(9);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});

describe.skipIf(!hasDb)("Duplicate order prevention", () => {
  let seller;
  let product;
  let token;
  let originalSecret;

  beforeAll(assertDisposableSecurityDatabase);

  beforeEach(async () => {
    originalSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = "test-only-security-secret-at-least-32-characters";

    seller = await makeSeller({ email: "dup-order@example.com", storeSlug: "test-store" });
    product = await makeProduct(seller.userId, { price: 1000, stock: 10 });
    token = await makeToken(seller.userId);
  });

  afterEach(async () => {
    process.env.JWT_SECRET = originalSecret;
    await cleanupFixtures(seller);
  });

  it("rejects duplicate order submissions with same clientRequestId", async () => {
    const { server, port } = await new Promise((resolve) => {
      const srv = app.listen(0, () => resolve({ server: srv, port: srv.address().port }));
    });

    try {
      const requestId = crypto.randomUUID();
      const orderPayload = {
        items: [{ productId: product._id, quantity: 1, price: 1000 }],
        customer: { name: "Buyer", phone: "+919999999999", address: "Test Address", postalCode: "110001" },
        paymentMethod: "COD",
        requestId,
      };

      const firstResponse = await fetch(`http://127.0.0.1:${port}/api/store/test-store/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(orderPayload),
      });

      const secondResponse = await fetch(`http://127.0.0.1:${port}/api/store/test-store/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(orderPayload),
      });

      expect(firstResponse.status).toBe(201);
      expect(secondResponse.status).toBe(200);
      const secondBody = await secondResponse.json();
      expect(secondBody.message).toMatch(/already received/i);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});

