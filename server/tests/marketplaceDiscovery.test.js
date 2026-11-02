import { beforeEach, describe, expect, it, vi } from "vitest";
import Product from "../src/models/Product.js";
import Seller from "../src/models/Seller.js";
import {
  listMarketplaceCategories,
  listMarketplaceLocalities,
  listMarketplaceProducts,
} from "../src/controllers/marketplaceController.js";

describe("marketplace discovery", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("lists public categories for the selected locality", async () => {
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    vi.spyOn(Seller, "find").mockReturnValue({
      select: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([
        { userId: "seller-1", businessName: "Fresh Basket", storeSlug: "fresh-basket", category: "Groceries", city: "Pune", locality: "Baner", isPublished: true, status: "active" },
        { userId: "seller-2", businessName: "Baker Street", storeSlug: "baker-street", category: "Bakery", city: "Pune", locality: "Baner", isPublished: true, status: "active" },
        { userId: "seller-3", businessName: "Urban Pantry", storeSlug: "urban-pantry", category: "Groceries", city: "Pune", locality: "Kharadi", isPublished: true, status: "active" },
      ]),
    });

    vi.spyOn(Product, "aggregate").mockResolvedValue([
      { _id: "Groceries", count: 2 },
      { _id: "Bakery", count: 1 },
    ]);

    await listMarketplaceCategories({ query: { city: "Pune", locality: "Baner" } }, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.arrayContaining([
        expect.objectContaining({ category: "Groceries", count: 2 }),
        expect.objectContaining({ category: "Bakery", count: 1 }),
      ]),
    }));
  });

  it("lists public localities for nearby shop discovery", async () => {
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    vi.spyOn(Seller, "aggregate").mockResolvedValue([{
      rows: [
        { _id: { country: "India", state: "Maharashtra", city: "Pune", locality: "Baner" }, shopCount: 2 },
        { _id: { country: "India", state: "Maharashtra", city: "Pune", locality: "Kharadi" }, shopCount: 1 },
      ],
      metadata: [{ total: 2 }],
    }]);

    await listMarketplaceLocalities({ query: { city: "Pune" } }, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.arrayContaining([
        expect.objectContaining({ country: "India", state: "Maharashtra", city: "Pune", locality: "Baner", shopCount: 2 }),
        expect.objectContaining({ country: "India", state: "Maharashtra", city: "Pune", locality: "Kharadi", shopCount: 1 }),
      ]),
    }));
  });

  it("keeps seller-scoped products separate for duplicate product names", async () => {
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    vi.spyOn(Seller, "find").mockReturnValue({
      select: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([
        { userId: "seller-1", businessName: "Fresh Basket", storeSlug: "fresh-basket", category: "Groceries", city: "Pune", locality: "Baner", isPublished: true, status: "active" },
        { userId: "seller-2", businessName: "Fresh Basket East", storeSlug: "fresh-basket-east", category: "Groceries", city: "Pune", locality: "Kharadi", isPublished: true, status: "active" },
      ]),
    });

    vi.spyOn(Product, "countDocuments").mockResolvedValue(2);
    vi.spyOn(Product, "find").mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([
        { _id: "prod-1", sellerId: "seller-1", name: "Rice", slug: "rice", category: "Groceries", price: 100, stock: 5, isPublished: true, status: "published" },
        { _id: "prod-2", sellerId: "seller-2", name: "Rice", slug: "rice", category: "Groceries", price: 120, stock: 4, isPublished: true, status: "published" },
      ]),
    });

    await listMarketplaceProducts({ query: { q: "rice", city: "Pune", sort: "relevance" } }, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      products: expect.arrayContaining([
        expect.objectContaining({ seller: expect.objectContaining({ businessName: "Fresh Basket" }) }),
        expect.objectContaining({ seller: expect.objectContaining({ businessName: "Fresh Basket East" }) }),
      ]),
    }));
  });
});
