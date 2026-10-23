import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AuthPage from "../pages/AuthPage";

const mockLoginUser = vi.hoisted(() => vi.fn());
const mockRegisterUser = vi.hoisted(() => vi.fn());
const mockGetSellerProfile = vi.hoisted(() => vi.fn());
const mockSetAuthToken = vi.hoisted(() => vi.fn());

vi.mock("../services/api", () => ({
  loginUser: mockLoginUser,
  registerUser: mockRegisterUser,
  getSellerProfile: mockGetSellerProfile,
  resendVerificationEmail: vi.fn(),
  setAuthToken: mockSetAuthToken,
}));

function renderWithRouter(ui, { route = "/" } = {}) {
  return {
    ...render(ui, { wrapper: ({ children }) => <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter> }),
  };
}

describe("AuthPage - login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockLoginUser.mockReset();
    mockRegisterUser.mockReset();
    mockGetSellerProfile.mockReset();
    mockSetAuthToken.mockReset();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("shows login form with email and password fields", () => {
    renderWithRouter(<AuthPage mode="login" />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByText(/sign in to supply link/i)).toBeInTheDocument();
  });

  it("shows register form with name field", () => {
    renderWithRouter(<AuthPage mode="register" />);
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByText(/start selling smarter/i)).toBeInTheDocument();
  });

  it("shows error for invalid credentials", async () => {
    mockLoginUser.mockRejectedValueOnce({ response: { status: 401, data: { message: "Invalid email or password" } } });

    renderWithRouter(<AuthPage mode="login" />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "bad@example.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument());
  });

  it("shows verification required message for unverified account", async () => {
    mockLoginUser.mockResolvedValueOnce({ verificationRequired: true, message: "Verify your email" });

    renderWithRouter(<AuthPage mode="login" />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "test@example.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "secret123" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(screen.getByText(/verify your email/i)).toBeInTheDocument());
  });
});