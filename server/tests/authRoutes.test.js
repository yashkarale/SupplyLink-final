import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';

const startApp = () => new Promise((resolve) => {
  const server = app.listen(0, () => {
    const { port } = server.address();
    resolve({ server, port });
  });
});

describe('auth routes', () => {
  it('GET /api/auth/login is unavailable so credentials cannot be sent in a URL', async () => {
    const { server, port } = await startApp();

    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/auth/login`);

      expect(response.status).toBe(404);
    } finally {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it('does not accept credentials from query parameters', async () => {
    const { server, port } = await startApp();

    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/auth/login?email=buyer%40example.com&password=secret123`);
      expect(response.status).toBe(404);
    } finally {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it('POST /api/auth/login validates request payload', async () => {
    const { server, port } = await startApp();

    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.message).toMatch(/Email and password/i);
    } finally {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it('POST /api/auth/verify-email rejects malformed tokens without database access', async () => {
    const { server, port } = await startApp();

    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'not-a-token' }),
      });

      expect(response.status).toBe(400);
      expect((await response.json()).message).toMatch(/verification link is invalid or expired/i);
    } finally {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it('POST /api/auth/resend-verification validates email before database access', async () => {
    const { server, port } = await startApp();

    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'not-an-email' }),
      });

      expect(response.status).toBe(400);
      expect((await response.json()).message).toMatch(/email address/i);
    } finally {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it('registration fails closed when verification email settings are missing', async () => {
    const original = {
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.EMAIL_FROM,
      appUrl: process.env.APP_BASE_URL,
    };
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    delete process.env.APP_BASE_URL;
    const { server, port } = await startApp();

    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Seller', email: 'seller@example.com', password: 'password123' }),
      });

      expect(response.status).toBe(503);
      expect((await response.json()).message).toMatch(/email verification is not configured/i);
    } finally {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
      if (original.apiKey === undefined) delete process.env.RESEND_API_KEY;
      else process.env.RESEND_API_KEY = original.apiKey;
      if (original.from === undefined) delete process.env.EMAIL_FROM;
      else process.env.EMAIL_FROM = original.from;
      if (original.appUrl === undefined) delete process.env.APP_BASE_URL;
      else process.env.APP_BASE_URL = original.appUrl;
    }
  });

  it('rejects legacy signed-in sessions until email ownership is verified', async () => {
    const originalSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'test-only-auth-route-secret-at-least-32-characters';
    const token = jwt.sign({ userId: '507f1f77bcf86cd799439011', role: 'seller' }, process.env.JWT_SECRET);
    const { server, port } = await startApp();

    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/sellers/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.status).toBe(403);
      expect((await response.json()).code).toBe('EMAIL_VERIFICATION_REQUIRED');
    } finally {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
      if (originalSecret === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = originalSecret;
    }
  });

  it('protected seller and product routes require authentication', async () => {
    const { server, port } = await startApp();

    try {
      const sellerResponse = await fetch(`http://127.0.0.1:${port}/api/sellers/me`);
      expect(sellerResponse.status).toBe(401);

      const productsResponse = await fetch(`http://127.0.0.1:${port}/api/products/`);
      expect(productsResponse.status).toBe(401);
    } finally {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it('dashboard summary route is protected and available', async () => {
    const { server, port } = await startApp();

    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/sellers/dashboard`);
      expect(response.status).toBe(401);
    } finally {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });
});
