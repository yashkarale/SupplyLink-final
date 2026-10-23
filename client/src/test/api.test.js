import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { loginUser, registerUser, revokeCurrentSession, setAuthToken } from "../services/api";

const mockPost = vi.hoisted(() => vi.fn());
const mockGet = vi.hoisted(() => vi.fn());
const mockPut = vi.hoisted(() => vi.fn());

vi.mock("axios", () => ({
  default: {
    create: vi.fn(() => ({
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
      post: mockPost,
      get: mockGet,
      put: mockPut,
      delete: vi.fn(),
    })),
  },
}));

describe("api service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockPost.mockReset();
    mockGet.mockReset();
    mockPut.mockReset();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("loginUser posts credentials and returns token", async () => {
    mockPost.mockResolvedValueOnce({ data: { token: "abc123", user: { id: "1" } } });

    const result = await loginUser({ email: "test@example.com", password: "secret123" });

    expect(mockPost).toHaveBeenCalledWith("/auth/login", { email: "test@example.com", password: "secret123" });
    expect(result.token).toBe("abc123");
  });

  it("setAuthToken stores and removes token", () => {
    setAuthToken("xyz789");
    expect(localStorage.getItem("supplylink_token")).toBe("xyz789");

    setAuthToken(null);
    expect(localStorage.getItem("supplylink_token")).toBeNull();
  });

  it("registerUser sends name, email, password", async () => {
    mockPost.mockResolvedValueOnce({ data: { verificationRequired: true } });

    await registerUser({ name: "Test Seller", email: "test@example.com", password: "secret123" });

    expect(mockPost).toHaveBeenCalledWith("/auth/register", {
      name: "Test Seller",
      email: "test@example.com",
      password: "secret123",
    });
  });

  it("revokeCurrentSession calls the authenticated logout endpoint", async () => {
    mockPost.mockResolvedValueOnce({ data: { success: true } });

    await revokeCurrentSession();

    expect(mockPost).toHaveBeenCalledWith("/auth/logout");
  });
});
