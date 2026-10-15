
import jwt from "jsonwebtoken";

export const protect = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Authentication required"
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.emailVerified !== true) {
      return res.status(403).json({
        code: "EMAIL_VERIFICATION_REQUIRED",
        message: "Verify your email before accessing your seller account.",
      });
    }

    req.user = {
      userId: decoded.userId,
      role: decoded.role
    };

    next();
  } catch (error) {
    console.error("JWT verification failed:", error.name, error.message);

    return res.status(401).json({
      message: "Invalid or expired token"
    });
  }
};
