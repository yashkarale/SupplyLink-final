import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import morgan from "morgan";
import mongoose from "mongoose";
import authRoutes from "./routes/authRoutes.js";
import sellerRoutes from "./routes/sellerRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import billingRoutes from "./routes/billingRoutes.js";
import storeRoutes from "./routes/storeRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import { handleResendWebhook } from "./controllers/emailWebhookController.js";
import { handleRazorpayWebhook } from "./controllers/billingController.js";

const app = express();

const clientOrigins = (process.env.CLIENT_URL || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.disable("x-powered-by");
app.use(helmet({ crossOriginResourcePolicy: false }));
morgan.token("safe-url", (req) => {
  try {
    const url = new URL(req.originalUrl || req.url || "/", "http://localhost");
    for (const key of ["password", "email", "token", "proofToken", "signature", "secret", "key", "phone", "whatsapp"]) {
      if (url.searchParams.has(key)) url.searchParams.set(key, "[redacted]");
    }
    url.pathname = url.pathname.replace(/(\/api\/orders\/track\/)[^/?]+/i, "$1[redacted]");
    return `${url.pathname}${url.search}`;
  } catch {
    return "[invalid-url]";
  }
});
app.use(morgan(process.env.NODE_ENV === "production"
  ? ':remote-addr - :remote-user [:date[clf]] ":method :safe-url HTTP/:http-version" :status :res[content-length]'
  : ':method :safe-url :status :response-time ms - :res[content-length]'));

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || clientOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: "Too many requests. Please try again later.",
    },
  })
);

app.use(express.json({
  limit: "3mb",
  verify: (req, res, buffer) => {
    if (["/api/webhooks/resend", "/api/webhooks/razorpay"].includes(req.originalUrl.split("?")[0])) req.rawBody = Buffer.from(buffer);
  },
}));
app.use(express.urlencoded({ extended: true }));

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "ok",
    service: "supply-link-api",
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/ready", (req, res) => {
  const databaseReady = mongoose.connection.readyState === 1;
  res.status(databaseReady ? 200 : 503).json({
    success: databaseReady,
    status: databaseReady ? "ready" : "not_ready",
    checks: { database: databaseReady ? "connected" : "disconnected" },
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/sellers", sellerRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/store", storeRoutes);
app.use("/api/notifications", notificationRoutes);
app.post("/api/webhooks/resend", handleResendWebhook);
app.post("/api/webhooks/razorpay", handleRazorpayWebhook);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Endpoint not found",
  });
});

app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  const statusCode = err.status || 500;
  const message = err.status ? err.message : "Internal server error";

  console.error("Request failed:", err.message || err);

  res.status(statusCode).json({
    success: false,
    message,
  });
});

export default app;
