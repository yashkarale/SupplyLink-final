import { afterEach, describe, expect, it, vi } from "vitest";
import app from "../src/app.js";
import { getPublicStore, onboardSeller } from "../src/controllers/sellerController.js";
import Product from "../src/models/Product.js";
import Order from "../src/models/Order.js";
import Seller from "../src/models/Seller.js";
import User from "../src/models/User.js";

const createQuery = (records) => ({
  select: vi.fn().mockReturnThis(),
  sort: vi.fn().mockReturnThis(),
  skip: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  lean: vi.fn().mockResolvedValue(records),
});

describe("public marketplace API", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("serializes public storefront data without private seller or internal product fields", async () => {
    const seller = {
      userId: "seller-public-store",
      businessName: "Clay House",
      storeSlug: "clay-house",
      description: "Hand-thrown ceramics",
      category: "Home",
      businessAddress: "Public shop address, Pune",
      sellerAddress: "Private residential address",
      email: "private@example.com",
      phone: "+919999999999",
      whatsapp: "+919999999999",
      city: "Pune",
      locality: "Baner",
      isPublished: true,
      status: "active",
      pickupAvailable: true,
      pickupInstructions: "Call at home",
      sellerDeliveryAvailable: true,
      deliveryTerms: "Ask us about delivery",
      deliveryFeeType: "custom",
      deliveryAreas: [{ area: "Baner", fee: 30, minimumOrder: 100 }],
      openingHours: [{ _id: "private-hours-id", day: "MONDAY", isClosed: false, intervals: [{ _id: "private-interval-id", open: "09:00", close: "17:00" }] }],
      faqs: [],
    };
    const product = {
      _id: "public-product-1",
      name: "Stoneware Mug",
      slug: "stoneware-mug",
      description: "A handmade mug",
      category: "Ceramics",
      price: 1200,
      compareAtPrice: 1500,
      stock: 8,
      sku: "PRIVATE-SKU",
      images: ["https://example.com/mug.jpg"],
      variants: [{ size: "One", stock: 8 }],
      status: "published",
      isPublished: true,
      createdAt: new Date("2025-01-01T00:00:00Z"),
    };
    vi.spyOn(Seller, "findOne").mockReturnValue({ lean: vi.fn().mockResolvedValue(seller) });
    vi.spyOn(Product, "find").mockReturnValue({
      select: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([product]),
    });
    const req = { params: { slug: "clay-house" } };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };

    await getPublicStore(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0][0];
    expect(payload.store).toMatchObject({ businessName: "Clay House", city: "Pune", locality: "Baner", businessAddress: "Public shop address, Pune", pickupAvailable: true });
    for (const field of ["sellerAddress", "email", "phone", "pickupInstructions"]) {
      expect(payload.store).not.toHaveProperty(field);
    }
    expect(payload.store.deliveryAreas).toEqual([{ area: "Baner", fee: 30, minimumOrder: 100 }]);
    expect(payload.store.openingHours).toEqual([{ day: "MONDAY", isClosed: false, intervals: [{ open: "09:00", close: "17:00" }] }]);
    expect(Seller.findOne).toHaveBeenCalledWith({ storeSlug: "clay-house", isPublished: true, status: "active" });
    expect(payload.products[0]).toMatchObject({ name: "Stoneware Mug", price: 1200, availability: "in_stock" });
    for (const field of ["stock", "sku", "variants", "status", "isPublished", "sellerId"]) {
      expect(payload.products[0]).not.toHaveProperty(field);
    }
  });

  it("ranks popular products using completed order quantities and serializes only public fields", async () => {
    const seller = { _id: "seller-record", userId: "seller-user", businessName: "Aster", storeSlug: "aster", isPublished: true, status: "active" };
    const product = { _id: "popular-product", sellerId: "seller-user", name: "Mug", slug: "mug", category: "Home", price: 500, stock: 12, sku: "PRIVATE", isPublished: true, status: "published" };
    vi.spyOn(Seller, "find").mockReturnValue(createQuery([seller]));
    vi.spyOn(Order, "aggregate").mockResolvedValue([{ _id: "popular-product", completedQuantity: 9 }]);
    vi.spyOn(Product, "find").mockReturnValue({ select: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValue([product]) });
    const server = app.listen(0);
    const { port } = server.address();
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/marketplace/products/popular`);
      const payload = await response.json();
      expect(response.status).toBe(200);
      expect(payload.products).toHaveLength(1);
      expect(payload.products[0]).toMatchObject({ name: "Mug", availability: "in_stock", seller: { businessName: "Aster" } });
      expect(payload.products[0]).not.toHaveProperty("stock");
      expect(payload.products[0]).not.toHaveProperty("sku");
      expect(Order.aggregate).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({ $match: expect.objectContaining({ orderStatus: "DELIVERED" }) }),
      ]));
    } finally {
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });

  it("returns related published products from other visible sellers", async () => {
    const currentSeller = { userId: "current-user", country: "India", state: "Maharashtra", city: "Pune" };
    const otherSeller = { _id: "other-record", userId: "other-user", businessName: "Other Shop", storeSlug: "other-shop", city: "Pune", state: "Maharashtra", status: "active", isPublished: true };
    const relatedProduct = { _id: "related-1", sellerId: "other-user", name: "Linen Runner", slug: "linen-runner", category: "Home", price: 900, stock: 3, sku: "PRIVATE", isPublished: true, status: "published" };
    vi.spyOn(Seller, "findOne").mockReturnValue({ select: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValue(currentSeller) });
    vi.spyOn(Product, "findOne").mockReturnValue({ select: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValue({ category: "Home" }) });
    vi.spyOn(Seller, "find").mockReturnValue(createQuery([otherSeller]));
    vi.spyOn(Product, "find").mockImplementation((query) => ({
      select: vi.fn().mockReturnThis(), sort: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(query.category ? [relatedProduct] : []),
    }));
    const server = app.listen(0);
    const { port } = server.address();
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/marketplace/products/aster/mug/related`);
      const payload = await response.json();
      expect(response.status).toBe(200);
      expect(payload.products).toHaveLength(1);
      expect(payload.products[0]).toMatchObject({ name: "Linen Runner", seller: { businessName: "Other Shop" } });
      expect(payload.products[0]).not.toHaveProperty("stock");
      expect(payload.products[0]).not.toHaveProperty("sku");
    } finally {
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });

  it("returns published marketplace products with seller details and storefront links", async () => {
    const sellers = [
      {
        _id: "64c9f5d2e8d0b2d5c7eb7a11",
        userId: "64c9f5d2e8d0b2d5c7eb7a12",
        businessName: "Aster Studio",
        storeSlug: "aster-studio",
        category: "Home Decor",
        description: "Handmade decor",
        sellerAddress: "PRIVATE ADDRESS",
        phone: "+919999999999",
        whatsapp: "+918888888888",
        paymentQrUrl: "https://private.example/payment-qr.png",
        isPublished: true,
        status: "active",
      },
      {
        _id: "64c9f5d2e8d0b2d5c7eb7a13",
        userId: "64c9f5d2e8d0b2d5c7eb7a14",
        businessName: "North Market",
        storeSlug: "north-market",
        category: "Kitchen",
        description: "Daily essentials",
        isPublished: true,
        status: "active",
      },
    ];

    const products = [
      {
        _id: "64c9f5d2e8d0b2d5c7eb7a15",
        sellerId: sellers[0].userId,
        name: "Scented Candle",
        slug: "scented-candle",
        category: "Home Decor",
        price: 499,
        stock: 12,
        images: ["https://example.com/candle.jpg"],
        sku: "INTERNAL-CANDLE-1",
        variants: [{ size: "One", stock: 7 }],
        isPublished: true,
        status: "published",
        createdAt: new Date().toISOString(),
      },
      {
        _id: "64c9f5d2e8d0b2d5c7eb7a16",
        sellerId: sellers[1].userId,
        name: "Storage Jar",
        slug: "storage-jar",
        category: "Kitchen",
        price: 799,
        stock: 6,
        images: ["https://example.com/jar.jpg"],
        isPublished: true,
        status: "published",
        createdAt: new Date().toISOString(),
      },
    ];

    vi.spyOn(Seller, "find").mockReturnValue(createQuery(sellers));
    vi.spyOn(Product, "countDocuments").mockResolvedValue(2);
    vi.spyOn(Product, "find").mockReturnValue(createQuery(products));

    const server = app.listen(0);
    const { port } = server.address();

    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/marketplace/products?page=1&limit=10`);
      expect(response.status).toBe(200);

      const payload = await response.json();
      expect(payload.success).toBe(true);
      expect(payload.products).toHaveLength(2);
      expect(payload.products[0].seller.businessName).toBe("Aster Studio");
      expect(payload.products[0].seller.storefrontUrl).toBe("/store/aster-studio");
      expect(payload.products[0].seller.email).toBeUndefined();
      expect(payload.products[0].seller.sellerAddress).toBeUndefined();
      expect(payload.products[0].seller.phone).toBeUndefined();
      expect(payload.products[0].seller.whatsapp).toBeUndefined();
      expect(payload.products[0].seller.paymentQrUrl).toBeUndefined();
      expect(payload.products[0].sku).toBeUndefined();
      expect(payload.products[0].stock).toBeUndefined();
      expect(payload.products[0].variants).toBeUndefined();
      expect(payload.products[0].availability).toBe("in_stock");
      expect(payload.pagination.page).toBe(1);
      expect(payload.pagination.limit).toBe(10);
    } finally {
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });

  it("keeps marketplace product lookups unique when multiple sellers share the same slug", async () => {
    const sellers = [
      {
        _id: "64c9f5d2e8d0b2d5c7eb7a11",
        userId: "64c9f5d2e8d0b2d5c7eb7a12",
        businessName: "Aster Studio",
        storeSlug: "aster-studio",
        category: "Home Decor",
        description: "Minimal home finds",
        isPublished: true,
        status: "active",
      },
      {
        _id: "64c9f5d2e8d0b2d5c7eb7a13",
        userId: "64c9f5d2e8d0b2d5c7eb7a14",
        businessName: "North Market",
        storeSlug: "north-market",
        category: "Kitchen",
        description: "Kitchen essentials",
        isPublished: true,
        status: "active",
      },
    ];

    const products = [
      {
        _id: "64c9f5d2e8d0b2d5c7eb7a15",
        sellerId: sellers[0].userId,
        name: "Linen Cushion Cover",
        slug: "linen-cushion-cover",
        category: "Home Decor",
        description: "Soft linen texture for curated living spaces.",
        price: 899,
        stock: 9,
        isPublished: true,
        status: "published",
        createdAt: new Date("2024-03-03T00:00:00Z").toISOString(),
      },
      {
        _id: "64c9f5d2e8d0b2d5c7eb7a16",
        sellerId: sellers[1].userId,
        name: "Kitchen Storage Set",
        slug: "linen-cushion-cover",
        category: "Kitchen",
        description: "Different seller, same slug.",
        price: 1299,
        stock: 0,
        isPublished: true,
        status: "published",
        createdAt: new Date("2024-02-02T00:00:00Z").toISOString(),
      },
    ];

    vi.spyOn(Seller, "find").mockReturnValue(createQuery(sellers));
    vi.spyOn(Product, "findOne").mockImplementation((query) => ({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockImplementation(async () => {
        if (query.sellerId && query.slug === "linen-cushion-cover") {
          const match = products.find((product) => String(product.sellerId) === String(query.sellerId));
          return match || null;
        }
        return null;
      }),
    }));

    const server = app.listen(0);
    const { port } = server.address();

    try {
      const sellerSpecific = await fetch(`http://127.0.0.1:${port}/api/marketplace/products/${sellers[0].storeSlug}/linen-cushion-cover`);
      expect(sellerSpecific.status).toBe(200);
      const speakerPayload = await sellerSpecific.json();
      expect(speakerPayload.product.seller.businessName).toBe("Aster Studio");

      const ambiguous = await fetch(`http://127.0.0.1:${port}/api/marketplace/products/linen-cushion-cover`);
      expect(ambiguous.status).toBe(404);
    } finally {
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });

  it("supports search, category, price and stock filters with backend sorting and pagination", async () => {
    const sellers = [
      {
        _id: "64c9f5d2e8d0b2d5c7eb7a11",
        userId: "64c9f5d2e8d0b2d5c7eb7a12",
        businessName: "Aster Studio",
        storeSlug: "aster-studio",
        category: "Home Decor",
        description: "Minimal home finds",
        isPublished: true,
        status: "active",
      },
      {
        _id: "64c9f5d2e8d0b2d5c7eb7a13",
        userId: "64c9f5d2e8d0b2d5c7eb7a14",
        businessName: "North Market",
        storeSlug: "north-market",
        category: "Kitchen",
        description: "Kitchen essentials",
        isPublished: true,
        status: "active",
      },
    ];

    const products = [
      {
        _id: "64c9f5d2e8d0b2d5c7eb7a15",
        sellerId: sellers[0].userId,
        name: "Linen Cushion Cover",
        slug: "linen-cushion-cover",
        category: "Home Decor",
        description: "Soft linen texture for curated living spaces.",
        price: 899,
        stock: 9,
        isPublished: true,
        status: "published",
        createdAt: new Date("2024-01-01T00:00:00Z").toISOString(),
      },
      {
        _id: "64c9f5d2e8d0b2d5c7eb7a16",
        sellerId: sellers[1].userId,
        name: "Kitchen Storage Set",
        slug: "kitchen-storage-set",
        category: "Kitchen",
        description: "Baskets and pantry organization.",
        price: 1299,
        stock: 0,
        isPublished: true,
        status: "published",
        createdAt: new Date("2024-02-02T00:00:00Z").toISOString(),
      },
      {
        _id: "64c9f5d2e8d0b2d5c7eb7a17",
        sellerId: sellers[0].userId,
        name: "Table Runner",
        slug: "table-runner",
        category: "Home Decor",
        description: "Neutral woven detail for dining spaces.",
        price: 699,
        stock: 12,
        isPublished: true,
        status: "published",
        createdAt: new Date("2024-03-03T00:00:00Z").toISOString(),
      },
    ];

    vi.spyOn(Seller, "find").mockReturnValue(createQuery(sellers));
    vi.spyOn(Seller, "countDocuments").mockResolvedValue(2);
    vi.spyOn(Product, "countDocuments").mockImplementation(async (query) => {
      if (query.$text) {
        return products.filter((product) => product.category === "Home Decor" && product.stock > 0 && (product.name.toLowerCase().includes("linen") || product.description.toLowerCase().includes("linen"))).length;
      }
      return products.filter((product) => product.category === "Home Decor" && product.price >= 500 && product.stock > 0).length;
    });
    vi.spyOn(Product, "find").mockImplementation((query) => createQuery(products.filter((product) => {
      const sellerAllowed = query.sellerId && query.sellerId.$in ? query.sellerId.$in.includes(product.sellerId) : true;
      const categoryMatch = !query.category || product.category === query.category;
      const minMatch = query.price?.$gte === undefined || product.price >= query.price.$gte;
      const maxMatch = query.price?.$lte === undefined || product.price <= query.price.$lte;
      const stockMatch = !query.stock || product.stock > 0;
      const searchMatch = !query.$text || product.name.toLowerCase().includes("linen") || product.description.toLowerCase().includes("linen");
      return sellerAllowed && categoryMatch && minMatch && maxMatch && stockMatch && searchMatch;
    })));

    const server = app.listen(0);
    const { port } = server.address();

    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/marketplace/products?search=linen&category=Home%20Decor&minPrice=500&maxPrice=1200&inStock=1&sort=price_asc&page=1&limit=2`);
      expect(response.status).toBe(200);

      const payload = await response.json();
      expect(payload.success).toBe(true);
      expect(payload.products).toHaveLength(1);
      expect(payload.products[0].name).toBe("Linen Cushion Cover");
      expect(payload.products[0].seller.businessName).toBe("Aster Studio");
      expect(payload.pagination.page).toBe(1);
      expect(payload.pagination.limit).toBe(2);
    } finally {
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });

  it("returns a public product detail page payload with seller storefront linkage", async () => {
    const seller = {
      _id: "64c9f5d2e8d0b2d5c7eb7a11",
      userId: "64c9f5d2e8d0b2d5c7eb7a12",
      businessName: "Aster Studio",
      storeSlug: "aster-studio",
      category: "Home Decor",
      description: "Minimal home finds",
      isPublished: true,
      status: "active",
      email: "private@example.com",
      sellerAddress: "PRIVATE ADDRESS",
      phone: "+919999999999",
      whatsapp: "+918888888888",
      paymentQrUrl: "https://private.example/payment-qr.png",
    };

    const product = {
      _id: "64c9f5d2e8d0b2d5c7eb7a15",
      sellerId: seller.userId,
      name: "Linen Cushion Cover",
      slug: "linen-cushion-cover",
      category: "Home Decor",
      description: "Soft linen texture for curated living spaces.",
      price: 899,
      stock: 9,
      sku: "INTERNAL-CUSHION-1",
      variants: [{ size: "Large", stock: 4 }],
      images: ["https://example.com/cushion.jpg"],
      isPublished: true,
      status: "published",
      createdAt: new Date("2024-03-03T00:00:00Z").toISOString(),
    };

    vi.spyOn(Seller, "find").mockReturnValue(createQuery([seller]));
    vi.spyOn(Product, "findOne").mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(product),
    });
    vi.spyOn(Seller, "findOne").mockReturnValue({
      lean: vi.fn().mockResolvedValue(seller),
    });

    const server = app.listen(0);
    const { port } = server.address();

    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/marketplace/products/${product.slug}`);
      expect(response.status).toBe(200);

      const payload = await response.json();
      expect(payload.success).toBe(true);
      expect(payload.product.name).toBe("Linen Cushion Cover");
      expect(payload.product.seller.businessName).toBe("Aster Studio");
      expect(payload.product.seller.storefrontUrl).toBe("/store/aster-studio");
      expect(payload.product.privateFields).toBeUndefined();
      expect(payload.product.seller.sellerAddress).toBeUndefined();
      expect(payload.product.seller.phone).toBeUndefined();
      expect(payload.product.seller.whatsapp).toBeUndefined();
      expect(payload.product.seller.paymentQrUrl).toBeUndefined();
      expect(payload.product.sku).toBeUndefined();
      expect(payload.product.stock).toBeUndefined();
      expect(payload.product.variants).toBeUndefined();
      expect(payload.product.availability).toBe("in_stock");
    } finally {
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });

  it("creates a store without a payment QR when the seller has not configured one yet", async () => {
    vi.spyOn(User, "findById").mockResolvedValue({
      _id: "64c9f5d2e8d0b2d5c7eb7b11",
      email: "seller@example.com",
      name: "Seller Name",
    });
    vi.spyOn(Seller, "findOne").mockResolvedValue(null);
    const createSeller = vi.spyOn(Seller, "create").mockImplementation(async (payload) => ({
      ...payload,
      _id: "64c9f5d2e8d0b2d5c7eb7b12",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    const req = {
      user: { userId: "64c9f5d2e8d0b2d5c7eb7b11" },
      body: {
        businessName: "North Market",
        storeSlug: "north-market",
        category: "Home Decor",
        phone: "+919876543210",
        whatsapp: "+919876543210",
        description: "Draft storefront",
        country: "India",
        city: "Pune",
        businessAddress: "Public shop address",
        sellerAddress: "Private home address",
        pickupAvailable: true,
        pickupInstructions: "Private pickup notes",
        sellerDeliveryAvailable: true,
        deliveryFeeType: "flat",
        deliveryAreas: [{ area: "Baner", fee: 25, minimumOrder: 100 }],
        openingHours: [{ day: "MONDAY", isClosed: false, intervals: [{ open: "09:00", close: "17:00" }] }],
        faqs: [],
      },
    };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    await onboardSeller(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      seller: expect.objectContaining({
        businessName: "North Market",
        storeSlug: "north-market",
        isPublished: false,
      }),
    }));
    expect(createSeller).toHaveBeenCalledWith(expect.objectContaining({
      businessAddress: "Public shop address",
      pickupInstructions: "Private pickup notes",
      deliveryAreas: [{ area: "Baner", fee: 25, minimumOrder: 100 }],
      openingHours: [{ day: "MONDAY", isClosed: false, intervals: [{ open: "09:00", close: "17:00" }] }],
    }));
    expect(createSeller.mock.calls[0][0]).not.toHaveProperty("sellerAddress");
  });

  it("rejects missing or malformed required seller contact numbers", async () => {
    vi.spyOn(User, "findById").mockResolvedValue({ _id: "seller-id", email: "seller@example.com" });
    const createSeller = vi.spyOn(Seller, "create");
    const req = { user: { userId: "seller-id" }, body: { businessName: "North Market", phone: "12345", whatsapp: "+919876543210" } };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await onboardSeller(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(createSeller).not.toHaveBeenCalled();
  });

  it("only returns public seller information and respects pagination limits", async () => {
    const sellers = Array.from({ length: 3 }, (_, index) => ({
      _id: `64c9f5d2e8d0b2d5c7eb7a${index + 1}`,
      userId: `64c9f5d2e8d0b2d5c7eb7a${index + 21}`,
      businessName: `Seller ${index + 1}`,
      storeSlug: `seller-${index + 1}`,
      category: "General",
      description: "A storefront",
      email: "private@example.com",
      phone: "+919876543210",
      whatsapp: "+919876543210",
      sellerAddress: "PRIVATE ADDRESS",
      paymentQrUrl: "https://private.example/payment-qr.png",
      isPublished: true,
      status: "active",
    }));

    vi.spyOn(Seller, "find").mockReturnValue(createQuery(sellers));
    vi.spyOn(Seller, "countDocuments").mockResolvedValue(3);
    vi.spyOn(Product, "countDocuments").mockResolvedValue(0);

    const server = app.listen(0);
    const { port } = server.address();

    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/marketplace/sellers?page=2&limit=2`);
      expect(response.status).toBe(200);

      const payload = await response.json();
      expect(payload.success).toBe(true);
      expect(payload.sellers).toHaveLength(3);
      expect(payload.sellers[0].email).toBeUndefined();
      expect(payload.sellers[0].phone).toBeUndefined();
      expect(payload.sellers[0].sellerAddress).toBeUndefined();
      expect(payload.sellers[0].whatsapp).toBeUndefined();
      expect(payload.sellers[0].paymentQrUrl).toBeUndefined();
      expect(payload.sellers[0].storefrontUrl).toBe("/store/seller-1");
      expect(payload.pagination.page).toBe(2);
      expect(payload.pagination.limit).toBe(2);
    } finally {
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });

  it("queries only published products from published non-suspended sellers", async () => {
    const seller = {
      _id: "64c9f5d2e8d0b2d5c7eb7a31",
      userId: "64c9f5d2e8d0b2d5c7eb7a32",
      businessName: "Visible Shop",
      storeSlug: "visible-shop",
      isPublished: true,
      status: "active",
    };
    const product = {
      _id: "64c9f5d2e8d0b2d5c7eb7a33",
      sellerId: seller.userId,
      name: "Public Item",
      slug: "public-item",
      category: "General",
      price: 50,
      stock: 1,
      isPublished: true,
      status: "published",
    };
    const sellerFind = vi.spyOn(Seller, "find").mockImplementation((query) => {
      expect(query).toMatchObject({ isPublished: true, status: "active" });
      return createQuery([seller]);
    });
    const productCount = vi.spyOn(Product, "countDocuments").mockImplementation(async (query) => {
      expect(query).toMatchObject({ isPublished: true, status: "published", sellerId: { $in: [seller.userId] } });
      return 1;
    });
    vi.spyOn(Product, "find").mockReturnValue(createQuery([product]));

    const server = app.listen(0);
    const { port } = server.address();
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/marketplace/products`);
      expect(response.status).toBe(200);
      expect((await response.json()).products).toHaveLength(1);
      expect(sellerFind).toHaveBeenCalled();
      expect(productCount).toHaveBeenCalled();
    } finally {
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });

  it("searches public shops by name within the selected location", async () => {
    const seller = {
      _id: "64c9f5d2e8d0b2d5c7eb7a41",
      userId: "64c9f5d2e8d0b2d5c7eb7a42",
      businessName: "Baner Market",
      storeSlug: "baner-market",
      category: "Groceries",
      country: "India",
      state: "Maharashtra",
      city: "Pune",
      locality: "Baner",
      isPublished: true,
      status: "active",
    };
    const sellerFind = vi.spyOn(Seller, "find").mockReturnValue(createQuery([seller]));
    vi.spyOn(Seller, "countDocuments").mockResolvedValue(1);

    const server = app.listen(0);
    const { port } = server.address();
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/marketplace/sellers?search=baner&country=India&state=Maharashtra&city=Pune&locality=Baner`);
      expect(response.status).toBe(200);
      const payload = await response.json();
      expect(payload.sellers[0]).toMatchObject({ businessName: "Baner Market", country: "India", city: "Pune", locality: "Baner" });
      const query = sellerFind.mock.calls[0][0];
      expect(query).toMatchObject({ isPublished: true, status: "active", country: "India", state: "Maharashtra", city: "Pune", locality: "Baner" });
      expect(query.$or[0].businessName).toEqual(/baner/i);
    } finally {
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });
});
