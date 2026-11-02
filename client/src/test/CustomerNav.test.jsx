import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import CustomerNav from "../components/marketplace/CustomerNav";
import useMarketplaceLocation from "../hooks/useMarketplaceLocation";

const { fetchMarketplaceLocalities } = vi.hoisted(() => ({ fetchMarketplaceLocalities: vi.fn() }));
vi.mock("../services/api", () => ({ fetchMarketplaceLocalities }));

function RouteAndLocation() {
  const route = useLocation();
  const [location] = useMarketplaceLocation();
  return <output aria-label="Buyer route and location">{`${route.pathname}${route.search}${route.hash}|${location?.locality || "all locations"}`}</output>;
}

describe("buyer navigation", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    fetchMarketplaceLocalities.mockResolvedValue({ data: [{ country: "India", state: "Maharashtra", city: "Pune", locality: "Baner" }] });
  });

  it("provides buyer-only mobile navigation and searches into product discovery", async () => {
    render(<MemoryRouter initialEntries={["/shops"]}><CustomerNav /><RouteAndLocation /></MemoryRouter>);

    expect(screen.getByRole("navigation", { name: "Buyer navigation" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open buyer navigation" }));
    expect(screen.getByRole("navigation", { name: "Mobile buyer navigation" })).toBeInTheDocument();
    expect(within(screen.getByRole("navigation", { name: "Mobile buyer navigation" })).getByRole("link", { name: "For sellers" })).toHaveAttribute("href", "/sell");

    fireEvent.change(screen.getByRole("textbox", { name: "Search products" }), { target: { value: "linen" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(screen.getByLabelText("Buyer route and location")).toHaveTextContent("/marketplace?search=linen#products");
  });

  it("shares selected locality with buyer pages and persists it for later visits", async () => {
    render(<MemoryRouter><CustomerNav /><RouteAndLocation /></MemoryRouter>);

    fireEvent.focus(screen.getByRole("combobox", { name: "Choose a city or locality" }));
    fireEvent.click(await screen.findByRole("option", { name: /Baner, Pune/ }));

    await waitFor(() => expect(screen.getByLabelText("Buyer route and location")).toHaveTextContent("|Baner"));
    expect(JSON.parse(localStorage.getItem("supplylink-marketplace-location"))).toMatchObject({ city: "Pune", locality: "Baner" });
  });
});
