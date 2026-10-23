import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Storefront from "../pages/Storefront";

const { fetchPublicStore, createPublicOrder, subscribeToPublicStore, uploadPublicPaymentProof, buildStoreContactUrl } = vi.hoisted(() => ({
  fetchPublicStore: vi.fn(),
  createPublicOrder: vi.fn(),
  subscribeToPublicStore: vi.fn(),
  uploadPublicPaymentProof: vi.fn(),
  buildStoreContactUrl: vi.fn(),
}));

vi.mock("../services/api", () => ({
  fetchPublicStore,
  createPublicOrder,
  subscribeToPublicStore,
  uploadPublicPaymentProof,
  buildStoreContactUrl,
}));

describe("Storefront", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    subscribeToPublicStore.mockReturnValue({ addEventListener: vi.fn(), close: vi.fn() });
    fetchPublicStore.mockResolvedValue({
      store: {
        businessName: "Clay House",
        storeSlug: "clay-house",
        description: "Hand-thrown home pieces",
        category: "Home",
        contactAvailable: false,
        contactUrl: "",
        paymentQrUrl: "",
        paymentProofAvailable: false,
        faqs: [],
      },
      products: [
        {
          _id: "product-1",
          name: "Stoneware Mug",
          category: "Ceramics",
          description: "A handmade ceramic mug.",
          price: 1200,
          stock: 2,
          images: [],
        },
      ],
    });
  });

  it("loads the slug-specific catalog and lets a shopper choose an available quantity", async () => {
    render(
      <MemoryRouter initialEntries={["/store/clay-house"]}>
        <Routes>
          <Route path="/store/:slug" element={<Storefront />} />
        </Routes>
      </MemoryRouter>,
    );

    expect((await screen.findAllByText("Hand-thrown home pieces")).length).toBeGreaterThan(0);
    expect(fetchPublicStore).toHaveBeenCalledWith("clay-house");
    expect(screen.getAllByText("Stoneware Mug").length).toBeGreaterThan(0);
    expect(screen.getByText("2 available")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "View details for Stoneware Mug" }));
    const details = screen.getByRole("dialog", { name: "Stoneware Mug" });
    fireEvent.click(within(details).getByRole("button", { name: "Increase quantity" }));
    expect(within(details).getByText("2")).toBeInTheDocument();
    fireEvent.click(within(details).getByRole("button", { name: "Add to cart" }));

    const statusMessages = await screen.findAllByRole("status");
    expect(statusMessages.some((message) => message.textContent.includes("Stoneware Mug × 2 added to your bag"))).toBe(true);
  });
});
