import { describe, expect, it } from "vitest";
import {
  getDatabaseLogicalBytes,
  getOrderStorageReport,
  getOrderWriteLimitBytes,
  isOrderStorageLimitReached,
} from "../src/utils/storageUsage.js";

describe("order storage guard", () => {
  it("counts document and index bytes toward the database limit", () => {
    expect(getDatabaseLogicalBytes({ dataSize: 400, indexSize: 100 })).toBe(500);
    expect(isOrderStorageLimitReached({ dataSize: 400, indexSize: 100 }, 500)).toBe(true);
    expect(isOrderStorageLimitReached({ dataSize: 399, indexSize: 100 }, 500)).toBe(false);
  });

  it("uses a conservative Free-cluster default and validates configuration", () => {
    expect(getOrderWriteLimitBytes(undefined)).toBe(350 * 1024 * 1024);
    expect(getOrderWriteLimitBytes("300")).toBe(300 * 1024 * 1024);
    expect(() => getOrderWriteLimitBytes("512")).toThrow(/between 64 and 511/);
  });

  it("reports measured order document size without exposing database credentials", () => {
    expect(getOrderStorageReport({
      databaseStats: { dataSize: 1000, indexSize: 200 },
      orderStats: { count: 10, size: 800, totalIndexSize: 100, avgObjSize: 80 },
    })).toEqual({
      database: { documentBytes: 1000, indexBytes: 200, logicalBytes: 1200 },
      orders: { count: 10, documentBytes: 800, indexBytes: 100, averageDocumentBytes: 80 },
    });
  });
});
