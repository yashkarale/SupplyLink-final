import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import Products from "../pages/Products";

const { fetchProducts, updateProduct } = vi.hoisted(() => ({
  fetchProducts: vi.fn(),
  updateProduct: vi.fn(),
}));

vi.mock("../services/api", () => ({
  fetchProducts,
  updateProduct,
  createProduct: vi.fn(),
  updateInventory: vi.fn(),
  uploadProductImage: vi.fn(),
}));

const product = { _id: "product-1", name: "Linen Shirt", category: "Apparel", price: 1200, stock: 4, status: "published", images: [] };

function renderProducts() {
  return render(<MemoryRouter initialEntries={["/"]}><Routes><Route element={<Outlet context={{ theme: "light" }} />}><Route path="/" element={<Products />} /></Route></Routes></MemoryRouter>);
}

describe("Products archive workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchProducts.mockResolvedValue({ products: [product], productLimit: 10, activeProductCount: 1 });
    updateProduct.mockImplementation(async (id, changes) => ({
      product: { ...product, _id: id, status: changes.status, isPublished: changes.status === "published" },
    }));
  });

  it("archives a listing and restores it without deleting its product record", async () => {
    renderProducts();
    expect(await screen.findAllByText("Linen Shirt")).not.toHaveLength(0);

    fireEvent.click(screen.getAllByRole("button", { name: "Archive" })[0]);
    await waitFor(() => expect(updateProduct).toHaveBeenLastCalledWith("product-1", { status: "archived" }));
    expect(await screen.findByRole("status")).toHaveTextContent(/archived and removed from the public storefront/i);
    expect(await screen.findAllByRole("button", { name: "Restore" })).toHaveLength(2);

    fireEvent.click(screen.getAllByRole("button", { name: "Restore" })[0]);
    await waitFor(() => expect(updateProduct).toHaveBeenLastCalledWith("product-1", { status: "published" }));
    expect(await screen.findByRole("status")).toHaveTextContent(/restored to the public storefront/i);
    expect(screen.getAllByText("Linen Shirt")).not.toHaveLength(0);
  });

  it("publishes a draft without changing its already-counted active product slot", async () => {
    fetchProducts.mockResolvedValue({ products: [{ ...product, status: "draft" }], productLimit: 10, activeProductCount: 1 });
    renderProducts();

    fireEvent.click((await screen.findAllByRole("button", { name: "Publish" }))[0]);
    await waitFor(() => expect(updateProduct).toHaveBeenCalledWith("product-1", { status: "published" }));
    expect(screen.getByText(/active products used/).parentElement).toHaveTextContent("1 of 10");
  });
});
