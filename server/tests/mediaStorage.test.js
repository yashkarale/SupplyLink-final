import { describe, expect, it } from "vitest";
import { inspectUploadedImage } from "../src/services/mediaStorage.js";

const pngHeader = (width, height) => {
  const buffer = Buffer.alloc(24);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(buffer);
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
};

describe("uploaded image validation", () => {
  it("accepts a square, adequately sized payment QR", () => {
    expect(inspectUploadedImage(pngHeader(600, 600), "image/png", "payment-qr")).toMatchObject({
      format: "png",
      width: 600,
      height: 600,
    });
  });

  it("rejects a non-square or too small payment QR", () => {
    expect(() => inspectUploadedImage(pngHeader(600, 400), "image/png", "payment-qr")).toThrow(/square/i);
    expect(() => inspectUploadedImage(pngHeader(200, 200), "image/png", "payment-qr")).toThrow(/300/i);
    expect(() => inspectUploadedImage(pngHeader(3001, 3001), "image/png", "payment-qr")).toThrow(/3000/i);
  });

  it("rejects MIME spoofing and oversized image files", () => {
    expect(() => inspectUploadedImage(pngHeader(600, 600), "image/jpeg", "payment-qr")).toThrow(/valid PNG or JPEG/i);
    expect(() => inspectUploadedImage(Buffer.alloc(2 * 1024 * 1024 + 1), "image/png", "payment-qr")).toThrow(/2 MB/i);
  });

  it("requires payment screenshots to meet the minimum receipt dimensions", () => {
    expect(inspectUploadedImage(pngHeader(480, 900), "image/png", "payment-proof")).toMatchObject({ width: 480, height: 900 });
    expect(() => inspectUploadedImage(pngHeader(250, 300), "image/png", "payment-proof")).toThrow(/320 × 400/i);
  });
});
