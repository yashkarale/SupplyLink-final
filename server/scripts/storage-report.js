import "dotenv/config";
import mongoose from "mongoose";
import Order from "../src/models/Order.js";
import { getOrderStorageReport, getOrderWriteLimitBytes } from "../src/utils/storageUsage.js";

if (!process.env.MONGODB_URI) {
  throw new Error("MONGODB_URI is required to report database usage.");
}

try {
  await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false });
  const database = mongoose.connection.db;
  const databaseStats = await database.stats({ scale: 1 });
  let orderStats = {};
  try {
    orderStats = await database.command({ collStats: Order.collection.collectionName, scale: 1 });
  } catch (error) {
    if (error.codeName !== "NamespaceNotFound") throw error;
  }

  const report = getOrderStorageReport({ databaseStats, orderStats });
  const writeLimitBytes = getOrderWriteLimitBytes();
  console.log(JSON.stringify({
    ...report,
    configuredOrderWriteLimitBytes: writeLimitBytes,
    configuredOrderWriteLimitPercent: Number((writeLimitBytes / (512 * 1024 * 1024) * 100).toFixed(1)),
    freeClusterQuotaBytes: 512 * 1024 * 1024,
    note: "Usage is for this database only. Atlas quota covers the entire cluster, so keep this cluster dedicated to Supply Link or configure a lower order write threshold.",
  }, null, 2));
} catch (error) {
  console.error("Storage report failed:", error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
