
import "dotenv/config";
import mongoose from "mongoose";
import app from "./app.js";
import connectDB from "./config/database.js";
import { getOrderWriteLimitBytes } from "./utils/storageUsage.js";

process.env.PORT ||= "5000";
process.env.CLIENT_URL ||= "http://localhost:5173";

const PORT = Number(process.env.PORT || 5000);

const startServer = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI must be set before starting the server.");
    }
    getOrderWriteLimitBytes();
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET === "supplylink-dev-secret-change-me") {
      throw new Error("Set JWT_SECRET to a random value of at least 32 characters before starting the server.");
    }
    if (process.env.NODE_ENV === "production") {
      const origins = String(process.env.CLIENT_URL || "").split(",").map((origin) => origin.trim()).filter(Boolean);
      if (!origins.length || origins.some((origin) => !origin.startsWith("https://"))) {
        throw new Error("Production CLIENT_URL must contain the HTTPS frontend origin(s).");
      }
    }
    await connectDB();

    const server = app.listen(PORT, () => {
      console.log(`Supply Link API listening on port ${PORT}`);
    });

    let shuttingDown = false;
    const shutdown = (signal) => {
      if (shuttingDown) return;
      shuttingDown = true;
      console.log(`${signal} received; closing HTTP and database connections`);
      const forceExit = setTimeout(() => {
        server.closeAllConnections?.();
        process.exit(1);
      }, 10000);
      forceExit.unref();
      server.close(async (error) => {
        try {
          await mongoose.disconnect();
          clearTimeout(forceExit);
          process.exit(error ? 1 : 0);
        } catch (shutdownError) {
          console.error("Shutdown failed:", shutdownError.message);
          process.exit(1);
        }
      });
    };

    process.once("SIGINT", () => shutdown("SIGINT"));
    process.once("SIGTERM", () => shutdown("SIGTERM"));
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
};

startServer();
