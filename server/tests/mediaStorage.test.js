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
  it("accepts square, portrait, and landscape payment QR images within dimension limits", () => {
    expect(inspectUploadedImage(pngHeader(600, 600), "image/png", "payment-qr")).toMatchObject({ format: "png", width: 600, height: 600 });
    expect(inspectUploadedImage(pngHeader(300, 600), "image/png", "payment-qr")).toMatchObject({ width: 300, height: 600 });
    expect(inspectUploadedImage(pngHeader(600, 300), "image/png", "payment-qr")).toMatchObject({ width: 600, height: 300 });
    expect(inspectUploadedImage(pngHeader(300, 300), "image/png", "payment-qr")).toMatchObject({ width: 300, height: 300 });
    expect(inspectUploadedImage(pngHeader(3000, 3000), "image/png", "payment-qr")).toMatchObject({ width: 3000, height: 3000 });
  });

  it("rejects payment QR images with either dimension below 300 or above 3000", () => {
    expect(() => inspectUploadedImage(pngHeader(200, 600), "image/png", "payment-qr")).toThrow(/300/i);
    expect(() => inspectUploadedImage(pngHeader(600, 200), "image/png", "payment-qr")).toThrow(/300/i);
    expect(() => inspectUploadedImage(pngHeader(3001, 600), "image/png", "payment-qr")).toThrow(/3000/i);
    expect(() => inspectUploadedImage(pngHeader(600, 3001), "image/png", "payment-qr")).toThrow(/3000/i);
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
