import { describe, expect, it } from "vitest";
import app from "../src/app.js";

describe("readiness probe", () => {
  it("returns unavailable while MongoDB is disconnected", async () => {
    const server = app.listen(0);
    const { port } = server.address();

    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/ready`);
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({
        success: false,
        status: "not_ready",
        checks: { database: "disconnected" },
      });
    } finally {
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });
});
