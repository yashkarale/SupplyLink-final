import { describe, expect, it } from "vitest";
import { normalizeStoreSlug } from "../src/utils/storeSlug.js";

describe("normalizeStoreSlug", () => {
  it("canonicalizes encoded route values after Express decodes them", () => {
    expect(normalizeStoreSlug("green routes")).toBe("green-routes");
  });

  it("normalizes case, accents, punctuation, and repeated separators", () => {
    expect(normalizeStoreSlug("  Crème & Co.  ")).toBe("creme-co");
  });

  it("bounds slugs to the seller model limit", () => {
    expect(normalizeStoreSlug("a".repeat(80))).toHaveLength(60);
  });
});
