import { describe, it, expect } from 'vitest';
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
