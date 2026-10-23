import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

const mockFindOne = vi.hoisted(() => vi.fn());
const mockDeleteOne = vi.hoisted(() => vi.fn());
const mockCreateSession = vi.hoisted(() => vi.fn());
const mockFindUser = vi.hoisted(() => vi.fn());

vi.mock("../src/models/AuthSession.js", () => ({
  default: { findOne: mockFindOne, deleteOne: mockDeleteOne, create: mockCreateSession },
}));
vi.mock("../src/models/User.js", () => ({ default: { findOne: mockFindUser } }));

import app from "../src/app.js";
import { login } from "../src/controllers/authController.js";

const startApp = () => new Promise((resolve) => {
  const server = app.listen(0, () => resolve({ server, port: server.address().port }));
});

describe("revocable bearer sessions", () => {
  const secret = "test-only-auth-session-secret-at-least-32-characters";
  let revoked;
  let sessionId;
  let userId;
  let token;
  let originalSecret;

  beforeEach(() => {
    originalSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = secret;
    revoked = false;
    sessionId = "session-a";
    userId = "507f1f77bcf86cd799439011";
    token = jwt.sign({ userId, role: "seller", emailVerified: true, jti: sessionId }, secret, { expiresIn: "1h" });
    mockFindOne.mockImplementation((filter) => ({
      select: () => ({
        lean: () => Promise.resolve(!revoked && filter.sessionId === sessionId && filter.userId === userId ? { _id: "active" } : null),
      }),
    }));
    mockDeleteOne.mockImplementation(async (filter) => {
      if (filter.sessionId === sessionId && filter.userId === userId) revoked = true;
      return { deletedCount: revoked ? 1 : 0 };
    });
    mockCreateSession.mockResolvedValue({});
    mockFindUser.mockReset();
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
    vi.clearAllMocks();
  });

  it("revokes the current token at logout and rejects it on the next request", async () => {
    const { server, port } = await startApp();
    const request = () => fetch(`http://127.0.0.1:${port}/api/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    try {
      const logout = await request();
      expect(logout.status).toBe(200);
      expect(mockDeleteOne).toHaveBeenCalledWith({ sessionId, userId });
      expect((await request()).status).toBe(401);
    } finally {
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });

  it("rejects legacy tokens that do not identify a persisted session", async () => {
    const legacyToken = jwt.sign({ userId, role: "seller", emailVerified: true }, secret, { expiresIn: "1h" });
    const { server, port } = await startApp();

    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${legacyToken}` },
      });
      expect(response.status).toBe(401);
      expect(mockFindOne).not.toHaveBeenCalled();
    } finally {
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });

  it("persists a session whose expiry matches the issued JWT", async () => {
    const user = {
      _id: { toString: () => userId },
      name: "Test Seller",
      email: "seller@example.com",
      password: await bcrypt.hash("password123", 4),
      role: "seller",
      emailVerified: true,
      tokenVersion: 0,
    };
    mockFindUser.mockReturnValue({ select: () => Promise.resolve(user) });
    const response = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };

    await login({ body: { email: user.email, password: "password123" } }, response);

    expect(mockFindUser).toHaveBeenCalledWith({ email: user.email });
    expect(response.status).toHaveBeenCalledWith(200);
    const body = response.json.mock.calls[0][0];
    const decoded = jwt.verify(body.token, secret);
    expect(decoded.jti).toBeTruthy();
    expect(mockCreateSession).toHaveBeenCalledWith({
      sessionId: decoded.jti,
      userId: user._id,
      expiresAt: new Date(decoded.exp * 1000),
    });
  });
});
