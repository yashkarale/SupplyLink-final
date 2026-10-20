import crypto from "node:crypto";

const getCloudinaryConfig = () => {
  const { CLOUDINARY_CLOUD_NAME: cloudName, CLOUDINARY_API_KEY: apiKey, CLOUDINARY_API_SECRET: apiSecret } = process.env;
  if (!cloudName || !apiKey || !apiSecret) {
    const error = new Error("Private image storage is not configured. Set the Cloudinary server environment variables.");
    error.status = 503;
    throw error;
  }
  return { cloudName, apiKey, apiSecret };
};

const cloudinarySignature = (params, apiSecret) => {
  const canonical = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  return crypto.createHash("sha1").update(`${canonical}${apiSecret}`).digest("hex");
};

export const inspectUploadedImage = (buffer, contentType, purpose) => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw Object.assign(new Error("Choose an image file."), { status: 400 });
  const limit = purpose === "payment-qr" ? 2 * 1024 * 1024 : 4 * 1024 * 1024;
  if (buffer.length > limit) throw Object.assign(new Error(`Image must be no larger than ${purpose === "payment-qr" ? "2" : "4"} MB.`), { status: 413 });

  let format;
  let width;
  let height;
  if (buffer.length >= 24 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    format = "png";
    width = buffer.readUInt32BE(16);
    height = buffer.readUInt32BE(20);
  } else if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    format = "jpg";
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) break;
      const marker = buffer[offset + 1];
      const segmentLength = buffer.readUInt16BE(offset + 2);
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        height = buffer.readUInt16BE(offset + 5);
        width = buffer.readUInt16BE(offset + 7);
        break;
      }
      if (segmentLength < 2) break;
      offset += segmentLength + 2;
    }
  }

  const expectedMime = format === "png" ? "image/png" : format === "jpg" ? "image/jpeg" : "";
  if (!expectedMime || contentType !== expectedMime || !width || !height || width > 6000 || height > 6000) {
    throw Object.assign(new Error("Upload a valid PNG or JPEG image."), { status: 400 });
  }
  if (purpose === "payment-qr") {
    if (Math.min(width, height) < 300 || Math.max(width, height) > 3000 || Math.max(width, height) / Math.min(width, height) > 1.05) {
      throw Object.assign(new Error("QR image must be square and between 300 × 300 and 3000 × 3000 pixels."), { status: 400 });
    }
  } else if (width < 320 || height < 400) {
    throw Object.assign(new Error("Payment screenshot must be at least 320 × 400 pixels."), { status: 400 });
  }
  return { format, width, height };
};

export const uploadImageToCloudinary = async ({ buffer, contentType, folder, publicId, deliveryType }) => {
  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
  const timestamp = Math.floor(Date.now() / 1000);
  const params = { folder, public_id: publicId, timestamp, type: deliveryType };
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(buffer)], { type: contentType }));
  form.append("api_key", apiKey);
  for (const [key, value] of Object.entries(params)) form.append(key, String(value));
  form.append("signature", cloudinarySignature(params, apiSecret));

  const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(20000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.public_id || !payload.format) {
    const error = new Error("Image storage upload failed. Please try again.");
    error.status = 502;
    throw error;
  }
  return {
    publicId: payload.public_id,
    format: payload.format,
    secureUrl: payload.secure_url,
    width: payload.width,
    height: payload.height,
  };
};

export const destroyCloudinaryImage = async (publicId, deliveryType = "upload") => {
  if (!publicId) return;
  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
  const timestamp = Math.floor(Date.now() / 1000);
  const params = { public_id: publicId, timestamp, type: deliveryType };
  const form = new URLSearchParams({
    ...Object.fromEntries(Object.entries(params).map(([key, value]) => [key, String(value)])),
    api_key: apiKey,
    signature: cloudinarySignature(params, apiSecret),
  });
  const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/destroy`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error("Unable to remove replaced image from storage.");
};

export const createPrivateImageDownloadUrl = ({ publicId, format, expiresAt }) => {
  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
  const timestamp = Math.floor(Date.now() / 1000);
  const params = { expires_at: expiresAt, format, public_id: publicId, timestamp, type: "authenticated" };
  const query = new URLSearchParams({
    ...Object.fromEntries(Object.entries(params).map(([key, value]) => [key, String(value)])),
    api_key: apiKey,
    signature: cloudinarySignature(params, apiSecret),
  });
  return `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/download?${query}`;
};
