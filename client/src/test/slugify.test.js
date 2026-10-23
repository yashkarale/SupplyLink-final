import { describe, it, expect } from "vitest";
import { slugify, getStoreUrl } from "../utils/slugify";

describe("slugify", () => {
  it("converts a business name to a lowercase hyphenated slug", () => {
    expect(slugify("Yash Clothing Store")).toBe("yash-clothing-store");
  });

  it("removes special characters and normalizes diacritics", () => {
    expect(slugify("Café & Co.!!!")).toBe("cafe-co");
  });

  it("trims and collapses multiple separators", () => {
    expect(slugify("  My   Store  Name  ")).toBe("my-store-name");
  });

  it("returns empty string for empty input", () => {
    expect(slugify("")).toBe("");
  });

  it("truncates long slugs to 60 characters", () => {
    const longName = "a".repeat(100);
    expect(slugify(longName).length).toBeLessThanOrEqual(60);
  });
});

describe("getStoreUrl", () => {
  it("builds a store URL from the current origin", () => {
    const url = getStoreUrl("my-store");
    expect(url).toContain("/store/my-store");
  });
});