import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import Product from "../src/models/Product.js";

const runId = randomUUID();
const sourceName = "supplylink_backup_drill_test";
const restoreName = "supplylink_restore_drill_test";
const markerCollection = "_supplylink_backup_drill_guard";
const markerId = "backup-restore-drill";

const assertTarget = (uri) => {
  let target;
  try {
    target = new URL(uri);
  } catch {
    throw new Error("Set BACKUP_RESTORE_DRILL_URI to the confirmed local MongoDB URI.");
  }
  const database = decodeURIComponent(target.pathname.replace(/^\//, ""));
  const host = target.host.toLowerCase();
  const local = ["localhost", "127.0.0.1", "::1"].includes(target.hostname.toLowerCase());
  if (!local || (target.port || "27017") !== "27017" || target.username || target.password) {
    throw new Error("Refusing backup drill: only unauthenticated local MongoDB on port 27017 is allowed.");
  }
  if (database !== "supplylink_staging" || process.env.BACKUP_RESTORE_DATABASE_CONFIRM !== database) {
    throw new Error("Refusing backup drill: confirm the exact supplylink_staging database name.");
  }
  if (process.env.BACKUP_RESTORE_HOST_CONFIRM?.toLowerCase() !== host) {
    throw new Error("Refusing backup drill: BACKUP_RESTORE_HOST_CONFIRM must match the URI host.");
  }
  return { database, host };
};

if (process.env.RUN_BACKUP_RESTORE_DRILL !== "1") {
  throw new Error("Refusing backup drill: set RUN_BACKUP_RESTORE_DRILL=1 to opt in.");
}

const uri = process.env.BACKUP_RESTORE_DRILL_URI;
const { database: confirmedDatabase, host: confirmedHost } = assertTarget(uri);
const mongoose = Product.db.base;
const archivePath = path.join(os.tmpdir(), `supplylink-backup-drill-${runId}.ejson`);
let source;
let restored;
let sourceGuardCreated = false;
let restoreGuardCreated = false;

try {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  const admin = mongoose.connection.db.admin();
  const hello = await admin.command({ hello: 1 });
  const stagingMarker = await mongoose.connection.db
    .collection("_supplylink_staging_test_guard")
    .findOne({ _id: "staging-integration-target" });
  if (
    mongoose.connection.name !== confirmedDatabase ||
    mongoose.connection.host !== new URL(uri).hostname ||
    hello.setName !== "rs0" ||
    !hello.isWritablePrimary ||
    stagingMarker?.database !== confirmedDatabase ||
    stagingMarker?.host !== confirmedHost ||
    stagingMarker?.allowTestWrites !== true
  ) {
    throw new Error("Refusing backup drill: local staging replica-set marker/topology did not match.");
  }

  const client = mongoose.connection.getClient();
  source = client.db(sourceName);
  restored = client.db(restoreName);
  for (const [name, db] of [[sourceName, source], [restoreName, restored]]) {
    if ((await db.listCollections().toArray()).length !== 0) {
      throw new Error(`Refusing backup drill: ${name} already exists; no data was overwritten.`);
    }
  }

  await source.createCollection(markerCollection);
  await source.collection(markerCollection).insertOne({
    _id: markerId,
    runId,
    host: confirmedHost,
    database: sourceName,
    allowDrop: true,
  });
  sourceGuardCreated = true;
  await restored.createCollection(markerCollection);
  await restored.collection(markerCollection).insertOne({
    _id: markerId,
    runId,
    host: confirmedHost,
    database: restoreName,
    allowDrop: true,
  });
  restoreGuardCreated = true;

  const userId = new mongoose.Types.ObjectId();
  const productId = new mongoose.Types.ObjectId();
  const orderId = new mongoose.Types.ObjectId();
  const paymentId = new mongoose.Types.ObjectId();
  const notificationId = new mongoose.Types.ObjectId();
  const createdAt = new Date("2026-10-21T12:00:00.000Z");
  const fixtureEmail = `backup-${runId}@example.invalid`;
  const slugSuffix = runId.slice(0, 8);
  const records = {
    users: [{ _id: userId, name: "Backup Drill Seller", email: fixtureEmail, emailVerified: true, createdAt }],
    sellers: [{ _id: new mongoose.Types.ObjectId(), userId, businessName: "Backup Drill Store", storeSlug: `backup-${slugSuffix}`, email: fixtureEmail, plan: "launch", subscriptionStatus: "active", createdAt }],
    products: [{ _id: productId, sellerId: userId, name: "Recovery Product", slug: `recovery-${slugSuffix}`, sku: `REC-${slugSuffix}`, category: "drill", price: 1299, stock: 7, status: "published", isPublished: true, createdAt }],
    orders: [{ _id: orderId, sellerId: userId, orderReference: `SL-DRILL-${runId.slice(0, 12)}`, items: [{ productId, name: "Recovery Product", quantity: 2, unitPrice: 1299, lineTotal: 2598 }], customer: { name: "Synthetic Buyer", phone: "+910000000000", address: "Synthetic Address", postalCode: "000000" }, subtotal: 2598, totalAmount: 2598, paymentMethod: "COD", paymentStatus: "PENDING", orderStatus: "CONFIRMED", createdAt }],
    subscriptionpayments: [{ _id: paymentId, sellerId: userId, razorpayOrderId: `order_drill_${runId}`, razorpayPaymentId: `pay_drill_${runId}`, plan: "launch", amount: 49900, currency: "INR", paidAt: createdAt, entitlementStartedAt: createdAt, entitlementExpiresAt: new Date("2026-11-20T12:00:00.000Z"), createdAt }],
    notifications: [{ _id: notificationId, sellerId: userId, type: "order_created", title: "Backup drill notification", message: "Synthetic recovery record", read: false, createdAt }],
  };
  const indexes = {
    users: [{ key: { email: 1 }, options: { unique: true, name: "email_1" } }],
    sellers: [{ key: { userId: 1 }, options: { unique: true, name: "userId_1" } }],
    products: [{ key: { sellerId: 1, slug: 1 }, options: { unique: true, name: "sellerId_1_slug_1" } }],
    orders: [{ key: { orderReference: 1 }, options: { unique: true, name: "orderReference_1" } }],
    subscriptionpayments: [
      { key: { razorpayOrderId: 1 }, options: { unique: true, name: "razorpayOrderId_1" } },
      { key: { razorpayPaymentId: 1 }, options: { unique: true, name: "razorpayPaymentId_1" } },
    ],
    notifications: [{ key: { sellerId: 1, createdAt: -1 }, options: { name: "sellerId_1_createdAt_-1" } }],
  };

  for (const [name, documents] of Object.entries(records)) {
    const collection = source.collection(name);
    await collection.insertMany(documents);
    for (const index of indexes[name]) await collection.createIndex(index.key, index.options);
  }

  const collections = [];
  for (const name of Object.keys(records)) {
    collections.push({
      name,
      documents: await source.collection(name).find({}).toArray(),
      indexes: (await source.collection(name).listIndexes().toArray()).filter((index) => index.name !== "_id_"),
    });
  }
  const EJSON = mongoose.mongo.BSON.EJSON;
  const serialized = EJSON.stringify({ format: "supplylink-logical-bson-drill-v1", source: sourceName, runId, collections }, null, 2, { relaxed: false });
  await fs.writeFile(archivePath, serialized, { encoding: "utf8", flag: "wx" });
  const archive = EJSON.parse(await fs.readFile(archivePath, "utf8"), { relaxed: false });
  if (archive.format !== "supplylink-logical-bson-drill-v1" || archive.source !== sourceName || archive.runId !== runId) {
    throw new Error("Backup archive identity check failed.");
  }

  for (const item of archive.collections) {
    await restored.createCollection(item.name);
    const collection = restored.collection(item.name);
    if (item.documents.length) await collection.insertMany(item.documents);
    for (const index of item.indexes) {
      const options = { ...index };
      delete options.key;
      delete options.ns;
      delete options.v;
      delete options.background;
      await collection.createIndex(index.key, options);
    }
  }

  const counts = {};
  for (const [name, documents] of Object.entries(records)) {
    counts[name] = await restored.collection(name).countDocuments();
    if (counts[name] !== documents.length) throw new Error(`Restore count mismatch in ${name}.`);
  }
  const [seller, product, order, payment] = await Promise.all([
    restored.collection("sellers").findOne({ userId }),
    restored.collection("products").findOne({ _id: productId }),
    restored.collection("orders").findOne({ _id: orderId }),
    restored.collection("subscriptionpayments").findOne({ _id: paymentId }),
  ]);
  if (
    seller?.businessName !== "Backup Drill Store" ||
    product?.stock !== 7 ||
    order?.totalAmount !== 2598 ||
    order?.items?.[0]?.quantity !== 2 ||
    !(order?.createdAt instanceof Date) ||
    payment?.amount !== 49900 ||
    payment?.currency !== "INR"
  ) {
    throw new Error("Restored critical business record values did not match.");
  }

  const restoredIndexes = {};
  for (const name of Object.keys(records)) {
    restoredIndexes[name] = (await restored.collection(name).listIndexes().toArray()).map((index) => index.name).sort();
  }
  console.log(JSON.stringify({
    result: "PASS",
    source: sourceName,
    restoredTo: restoreName,
    archiveFormat: "BSON Extended JSON (strict dates/ObjectIds)",
    archiveBytes: Buffer.byteLength(serialized),
    restoredDocuments: counts,
    criticalValuesVerified: true,
    restoredIndexes,
    limitation: "Synthetic logical restore only; does not test cloud snapshots, PITR/oplog, encryption, or production data.",
  }));
} finally {
  if (sourceGuardCreated) {
    const marker = await source.collection(markerCollection).findOne({ _id: markerId });
    if (marker?.runId === runId && marker?.host === confirmedHost && marker?.database === sourceName && marker?.allowDrop === true) {
      await source.dropDatabase();
    }
  }
  if (restoreGuardCreated) {
    const marker = await restored.collection(markerCollection).findOne({ _id: markerId });
    if (marker?.runId === runId && marker?.host === confirmedHost && marker?.database === restoreName && marker?.allowDrop === true) {
      await restored.dropDatabase();
    }
  }
  await fs.rm(archivePath, { force: true });
  await mongoose.disconnect();
}
