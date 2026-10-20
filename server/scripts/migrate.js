import "dotenv/config";
import mongoose from "mongoose";
import User from "../src/models/User.js";
import Seller from "../src/models/Seller.js";
import Product from "../src/models/Product.js";
import Order from "../src/models/Order.js";
import EmailWebhookEvent from "../src/models/EmailWebhookEvent.js";
import SubscriptionPayment from "../src/models/SubscriptionPayment.js";
import SubscriptionCheckout from "../src/models/SubscriptionCheckout.js";
import RazorpayWebhookEvent from "../src/models/RazorpayWebhookEvent.js";

if (!process.env.MONGODB_URI) {
  throw new Error("MONGODB_URI is required to create application indexes.");
}

try {
  await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false });
  await Promise.all([
    User.createIndexes(),
    Seller.createIndexes(),
    Product.createIndexes(),
    Order.createIndexes(),
    EmailWebhookEvent.createIndexes(),
    SubscriptionPayment.createIndexes(),
    SubscriptionCheckout.createIndexes(),
    RazorpayWebhookEvent.createIndexes(),
  ]);
  console.log("Supply Link schema indexes are current.");
} catch (error) {
  console.error("Database index migration failed:", error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
