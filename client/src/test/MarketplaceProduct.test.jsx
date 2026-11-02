import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import MarketplaceProduct from "../pages/MarketplaceProduct";

const { fetchMarketplaceProductBySlug, fetchPublicStore, fetchRelatedMarketplaceProducts, buildStoreContactUrl } = vi.hoisted(() => ({
  fetchMarketplaceProductBySlug: vi.fn(),
  fetchPublicStore: vi.fn(),
  fetchRelatedMarketplaceProducts: vi.fn(),
  buildStoreContactUrl: vi.fn(),
}));

vi.mock("../services/api", () => ({
  fetchMarketplaceProductBySlug,
  fetchPublicStore,
  fetchRelatedMarketplaceProducts,
  buildStoreContactUrl,
}));

describe("marketplace product journey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMarketplaceProductBySlug.mockResolvedValue({ product: {
      _id: "mug-id", slug: "mug", name: "Stoneware Mug", category: "Ceramics", description: "Hand thrown.", price: 1200,
      availability: "in_stock", images: ["https://example.test/mug.jpg"],
      seller: { businessName: "Clay House", storeSlug: "clay-house", city: "Pune", locality: "Baner", storefrontUrl: "/store/clay-house" },
    } });
    fetchPublicStore.mockResolvedValue({ contactAvailable: true, contactUrl: "/api/store/clay-house/contact", pickupAvailable: true, sellerDeliveryAvailable: false });
    fetchRelatedMarketplaceProducts.mockResolvedValue({ products: [{
      _id: "related", slug: "linen-runner", name: "Linen Runner", price: 900,
      seller: { businessName: "Other Shop", storeSlug: "other-shop" },
    }] });
    buildStoreContactUrl.mockReturnValue("https://wa.me/example");
  });

  it("shows seller and location, related shops, contact, and the existing storefront order entry", async () => {
    render(<MemoryRouter initialEntries={["/marketplace/product/clay-house/mug"]}><Routes><Route path="/marketplace/product/:sellerSlug/:productSlug" element={<MarketplaceProduct />} /></Routes></MemoryRouter>);

    expect(await screen.findByRole("heading", { name: "Stoneware Mug" })).toBeInTheDocument();
    expect(screen.getByText(/Sold by Clay House/)).toBeInTheDocument();
    expect(screen.getByText("Baner, Pune")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Order from this shop" })).toHaveAttribute("href", "/store/clay-house?product=mug");
    expect(screen.getByRole("link", { name: "Contact seller on WhatsApp" })).toHaveAttribute("href", "https://wa.me/example");
    expect(await screen.findByRole("heading", { name: "Related products" })).toBeInTheDocument();
    expect(screen.getByText("Linen Runner")).toBeInTheDocument();
  });
});
