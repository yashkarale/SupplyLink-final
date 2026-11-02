import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import POS from "../pages/POS.jsx";

const { fetchProducts, createOfflinePosSale } = vi.hoisted(() => ({ fetchProducts: vi.fn(), createOfflinePosSale: vi.fn() }));
vi.mock("../services/api", () => ({ fetchProducts, createOfflinePosSale }));

const products = [{ _id: "product-1", name: "Canvas Tote", category: "Bags", sku: "TOTE-1", price: 125.5, stock: 2 }];
const renderPOS = () => render(<MemoryRouter initialEntries={["/"]}><Routes><Route element={<Outlet context={{ theme: "light" }}/>}><Route path="/" element={<POS/>}/></Route></Routes></MemoryRouter>);

describe("POS checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("crypto", { randomUUID: vi.fn(() => "123e4567-e89b-42d3-a456-426614174000") });
    fetchProducts.mockResolvedValue({ products });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("searches products, caps quantities at stock, calculates totals, and records an offline sale", async () => {
    createOfflinePosSale.mockResolvedValue({ sale: { orderReference: "SL-POS-1" } });
    renderPOS();
    fireEvent.change(screen.getByRole("textbox", { name: "Search products for POS" }), { target: { value: "tote-1" } });
    const product = await screen.findByRole("button", { name: /canvas tote/i });
    fireEvent.click(product);
    fireEvent.click(screen.getByRole("button", { name: "Increase quantity for Canvas Tote" }));
    expect(screen.getAllByText("₹251.00")).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "UPI" }));
    fireEvent.click(screen.getByRole("button", { name: "Complete sale" }));

    await waitFor(() => expect(createOfflinePosSale).toHaveBeenCalledOnce());
    expect(createOfflinePosSale).toHaveBeenCalledWith(expect.objectContaining({ requestId: "123e4567-e89b-42d3-a456-426614174000", paymentMethod: "UPI", items: [{ productId: "product-1", quantity: 2 }] }));
    expect(await screen.findByText(/SL-POS-1 completed successfully/i)).toBeInTheDocument();
  });

  it("reuses an idempotency key after a retryable request failure", async () => {
    createOfflinePosSale.mockRejectedValueOnce(new Error("Connection interrupted")).mockResolvedValueOnce({ sale: { orderReference: "SL-POS-2" } });
    renderPOS();
    fireEvent.click(await screen.findByRole("button", { name: /canvas tote/i }));
    fireEvent.click(screen.getByRole("button", { name: "Complete sale" }));
    await screen.findByText("Connection interrupted");
    fireEvent.click(screen.getByRole("button", { name: "Complete sale" }));
    await waitFor(() => expect(createOfflinePosSale).toHaveBeenCalledTimes(2));
    expect(createOfflinePosSale.mock.calls[0][0].requestId).toBe(createOfflinePosSale.mock.calls[1][0].requestId);
    expect(await screen.findByText(/SL-POS-2 completed successfully/i)).toBeInTheDocument();
  });
});
