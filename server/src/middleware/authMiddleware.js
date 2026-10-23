
import jwt from "jsonwebtoken";
import AuthSession from "../models/AuthSession.js";

export const protect = (req, res, next) => {
  let decoded;
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Authentication required"
      });
    }

    const token = authHeader.split(" ")[1];

    decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.emailVerified !== true) {
      return res.status(403).json({
        code: "EMAIL_VERIFICATION_REQUIRED",
        message: "Verify your email before accessing your seller account.",
      });
    }

  } catch (error) {
    console.error("JWT verification failed:", error.name, error.message);

    return res.status(401).json({
      message: "Invalid or expired token"
    });
  }

  if (typeof decoded.userId !== "string" || typeof decoded.jti !== "string") {
    return res.status(401).json({ message: "Invalid or revoked session" });
  }

  AuthSession.findOne({
    sessionId: decoded.jti,
    userId: decoded.userId,
    expiresAt: { $gt: new Date() },
  }).select("_id").lean().then((session) => {
    if (!session) {
      return res.status(401).json({ message: "Invalid or revoked session" });
    }

    req.user = { userId: decoded.userId, role: decoded.role, sessionId: decoded.jti };
    return next();
  }).catch((error) => {
    console.error("Session validation failed:", error.message);
    return res.status(503).json({ message: "Unable to validate the authenticated session" });
  });
};
