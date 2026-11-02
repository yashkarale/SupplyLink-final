import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Marketplace from "../pages/Marketplace";

const { fetchMarketplaceCategories, fetchMarketplaceLocalities, fetchMarketplaceProducts, fetchMarketplaceSellers, fetchPopularMarketplaceProducts } = vi.hoisted(() => ({
  fetchMarketplaceCategories: vi.fn(),
  fetchMarketplaceLocalities: vi.fn(),
  fetchMarketplaceProducts: vi.fn(),
  fetchMarketplaceSellers: vi.fn(),
  fetchPopularMarketplaceProducts: vi.fn(),
}));

vi.mock("../services/api", () => ({
  fetchMarketplaceCategories,
  fetchMarketplaceLocalities,
  fetchMarketplaceProducts,
  fetchMarketplaceSellers,
  fetchPopularMarketplaceProducts,
}));

describe("customer marketplace discovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    fetchMarketplaceCategories.mockResolvedValue({ data: [{ category: "Groceries", count: 3 }] });
    fetchMarketplaceLocalities.mockResolvedValue({ data: [{ country: "India", state: "Maharashtra", city: "Pune", locality: "Baner", shopCount: 2 }] });
    fetchMarketplaceProducts.mockResolvedValue({
      products: [{
        _id: "product-1", name: "Local Rice", slug: "local-rice", category: "Groceries", price: 80,
        availability: "seller_confirmation_required", images: [],
        seller: { businessName: "Baner Grocer", storeSlug: "baner-grocer", city: "Pune", locality: "Baner", storefrontUrl: "/store/baner-grocer" },
      }],
      pagination: { page: 1, limit: 12, total: 1, totalPages: 1 },
    });
    fetchMarketplaceSellers.mockResolvedValue({ sellers: [], pagination: { page: 1, limit: 6, total: 0, totalPages: 1 } });
    fetchPopularMarketplaceProducts.mockResolvedValue({ products: [] });
  });

  it("loads real marketplace categories and filters products by the selected locality", async () => {
    render(<MemoryRouter><Marketplace /></MemoryRouter>);

    expect(await screen.findByRole("button", { name: "Groceries" })).toBeInTheDocument();
    expect((await screen.findAllByText("Local Rice")).length).toBeGreaterThan(0);

    fireEvent.focus(screen.getByRole("combobox", { name: "Choose a city or locality" }));
    fireEvent.click(await screen.findByRole("option", { name: /Baner, Pune, Maharashtra, India/ }));

    await waitFor(() => expect(fetchMarketplaceProducts).toHaveBeenLastCalledWith(1, 12, expect.objectContaining({
      country: "India",
      state: "Maharashtra",
      city: "Pune",
      locality: "Baner",
    })));
    await waitFor(() => expect(fetchMarketplaceSellers).toHaveBeenLastCalledWith(1, 6, expect.objectContaining({ city: "Pune", locality: "Baner" })));
    expect(screen.getByText(/Showing results near Baner, Pune, Maharashtra, India/)).toBeInTheDocument();
    expect(screen.getAllByText("Check with seller").length).toBeGreaterThan(0);
  });

  it("applies a buyer navigation search to the server-side product request", async () => {
    render(<MemoryRouter initialEntries={["/marketplace?search=linen#products"]}><Marketplace /></MemoryRouter>);

    await waitFor(() => expect(fetchMarketplaceProducts).toHaveBeenCalledWith(1, 12, expect.objectContaining({ search: "linen" })));
    expect(screen.getByPlaceholderText("Search products, makers, or categories")).toHaveValue("linen");
  });

  it("shows a shop loading error instead of claiming the marketplace is empty", async () => {
    fetchMarketplaceSellers.mockRejectedValueOnce(new Error("Shop service unavailable"));
    render(<MemoryRouter><Marketplace /></MemoryRouter>);

    const shopError = await screen.findByText(/Nearby shops could not be loaded\. Shop service unavailable/);
    expect(shopError.parentElement).toHaveAttribute("role", "alert");
    expect(screen.queryByText("No public sellers are available right now.")).not.toBeInTheDocument();
  });
});
