import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("../pages/Marketplace", () => ({ default: () => <h1>Buyer marketplace home</h1> }));
vi.mock("../pages/LandingPage", () => ({ default: () => <h1>Seller information page</h1> }));

import App from "../App";

describe("application entry routes", () => {
  it("opens the buyer marketplace at the root URL", async () => {
    render(<MemoryRouter initialEntries={["/"]}><App /></MemoryRouter>);
    expect(await screen.findByRole("heading", { name: "Buyer marketplace home" })).toBeInTheDocument();
  });

  it("keeps seller information on its separate route", async () => {
    render(<MemoryRouter initialEntries={["/sell"]}><App /></MemoryRouter>);
    expect(await screen.findByRole("heading", { name: "Seller information page" })).toBeInTheDocument();
  });
});
