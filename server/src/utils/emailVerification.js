import crypto from "node:crypto";

export const createEmailVerificationToken = () => crypto.randomBytes(32).toString("hex");

export const hashEmailVerificationToken = (token) =>
  crypto.createHash("sha256").update(String(token)).digest("hex");

export const isEmailVerificationToken = (token) =>
  typeof token === "string" && /^[a-f0-9]{64}$/i.test(token);
