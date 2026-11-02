import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ShopDiscovery from "../pages/ShopDiscovery";

const { fetchMarketplaceCategories, fetchMarketplaceSellers, fetchMarketplaceLocalities } = vi.hoisted(() => ({
  fetchMarketplaceCategories: vi.fn(),
  fetchMarketplaceSellers: vi.fn(),
  fetchMarketplaceLocalities: vi.fn(),
}));

vi.mock("../services/api", () => ({ fetchMarketplaceCategories, fetchMarketplaceSellers, fetchMarketplaceLocalities }));

describe("shop discovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    fetchMarketplaceCategories.mockResolvedValue({ data: [{ category: "Bakery" }] });
    fetchMarketplaceLocalities.mockResolvedValue({ data: [] });
    fetchMarketplaceSellers.mockResolvedValue({
      sellers: [{ id: "shop-1", storeSlug: "bread-house", businessName: "Bread House", category: "Bakery", city: "Pune", locality: "Baner", pickupAvailable: true, openingHours: [{ day: "MONDAY", intervals: [{ open: "09:00", close: "17:00" }] }], storefrontUrl: "/store/bread-house" }],
      pagination: { page: 1, limit: 12, total: 1, totalPages: 1 },
    });
  });

  it("supports search, category, and sort while showing seller-configured public details", async () => {
    render(<MemoryRouter initialEntries={["/shops?search=bread"]}><ShopDiscovery /></MemoryRouter>);

    expect(await screen.findByRole("link", { name: /Bread House/ })).toHaveAttribute("href", "/store/bread-house");
    expect(screen.getByText("Pickup available")).toBeInTheDocument();
    expect(screen.getByText(/MONDAY: 09:00–17:00/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Sort shops" }), { target: { value: "name" } });
    await waitFor(() => expect(fetchMarketplaceSellers).toHaveBeenLastCalledWith(1, 12, expect.objectContaining({ search: "bread", sort: "name" })));
  });
});
