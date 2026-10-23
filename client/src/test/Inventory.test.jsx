import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import Inventory from "../pages/Inventory";

const { fetchProducts, updateInventory } = vi.hoisted(() => ({
  fetchProducts: vi.fn(),
  updateInventory: vi.fn(),
}));

vi.mock("../services/api", () => ({ fetchProducts, updateInventory }));

const products = [
  { _id: "product-1", name: "Linen Shirt", category: "Apparel", price: 1200, stock: 4 },
  { _id: "product-2", name: "Canvas Tote", category: "Bags", price: 800, stock: 18 },
];

function renderInventory() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route element={<Outlet context={{ theme: "light" }} />}>
          <Route path="/" element={<Inventory />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("Inventory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchProducts.mockResolvedValue({ products });
  });

  it("filters inventory rows by search text", async () => {
    renderInventory();

    expect(await screen.findByText("Linen Shirt")).toBeInTheDocument();
    expect(screen.getByLabelText("Alert at")).toHaveStyle({
      backgroundColor: "rgb(255, 255, 255)",
      color: "rgb(23, 27, 36)",
      colorScheme: "light",
    });
    fireEvent.change(screen.getByPlaceholderText(/search products or sku/i), {
      target: { value: "tote" },
    });

    expect(screen.getByText("Canvas Tote")).toBeInTheDocument();
    expect(screen.queryByText("Linen Shirt")).not.toBeInTheDocument();
  });

  it("persists stock once when the adjustment form is submitted", async () => {
    updateInventory.mockResolvedValue({ product: { ...products[1], stock: 0 } });
    renderInventory();

    const adjustButtons = await screen.findAllByRole("button", { name: "Adjust stock" });
    fireEvent.click(adjustButtons[0]);
    fireEvent.change(screen.getByLabelText("New quantity"), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Save quantity" }));

    await waitFor(() => expect(updateInventory).toHaveBeenCalledTimes(1));
    expect(updateInventory).toHaveBeenCalledWith("product-2", { stock: 0 });
    expect(await screen.findByText(/updated to 0/i)).toBeInTheDocument();
  });
});
