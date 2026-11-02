import mongoose from "mongoose";
import Order from "../models/Order.js";
import Seller from "../models/Seller.js";
import { publishStoreEvent } from "../utils/storeEvents.js";
import { destroyCloudinaryImage } from "./mediaStorage.js";
import { restoreStock } from "./inventoryService.js";

export const expireUnpaidWhatsAppOrders = async ({ now = new Date(), batchSize = 50 } = {}) => {
  const expired = await Order.find({
    paymentMethod: "WHATSAPP",
    paymentStatus: "PENDING",
    orderStatus: "PENDING",
    paymentPendingUntil: { $lte: now },
  }).select("_id").limit(batchSize).lean();
  let count = 0;

  for (const candidate of expired) {
    const session = await mongoose.startSession();
    try {
      let sellerId;
      await session.withTransaction(async () => {
        const order = await Order.findOne({
          _id: candidate._id,
          paymentMethod: "WHATSAPP",
          paymentStatus: "PENDING",
          orderStatus: "PENDING",
          paymentPendingUntil: { $lte: now },
        }).session(session);
        if (!order) return;
        const quantities = new Map();
        for (const item of order.items || []) {
          const productId = String(item.productId || "");
          const quantity = Number(item.quantity || 0);
          if (!productId || !Number.isSafeInteger(quantity) || quantity < 1) throw new Error("Expired order inventory line is invalid.");
          quantities.set(productId, (quantities.get(productId) || 0) + quantity);
        }
        for (const [productId, quantity] of quantities) {
          const result = await restoreStock({
            sellerId: order.sellerId,
            productId,
            quantity,
            reason: "Expired pending order",
            referenceId: order.orderReference,
            movementType: "ORDER_CANCELLED",
            idempotencyKey: `${order.orderReference}:${productId}:expired`,
            session,
          });
          if (result.duplicate || !result.product) throw new Error("Cannot release stock for an expired order product.");
        }
        order.orderStatus = "CANCELLED";
        order.paymentStatus = "FAILED";
        order.statusHistory.push({ from: "PENDING", to: "CANCELLED", changedAt: now });
        await order.save({ session });
        sellerId = order.sellerId;
      });
      if (sellerId) {
        count += 1;
        const seller = await Seller.findOne({ userId: sellerId }).select("storeSlug").lean();
        if (seller?.storeSlug) publishStoreEvent(seller.storeSlug, "catalog.updated");
      }
    } catch (error) {
      console.error("Pending order expiration failed:", error.message);
    } finally {
      await session.endSession();
    }
  }

  const oldProofs = await Order.find({
    paymentProofPublicId: { $ne: "" },
    paymentProofDeleteAfter: { $lte: now },
  }).select("+paymentProofPublicId").limit(batchSize).lean();
  for (const proof of oldProofs) {
    try {
      await destroyCloudinaryImage(proof.paymentProofPublicId, "authenticated");
      await Order.updateOne({ _id: proof._id, paymentProofPublicId: proof.paymentProofPublicId }, {
        $unset: { paymentProofPublicId: 1, paymentProofFormat: 1, paymentProofDeleteAfter: 1 },
        $set: { paymentProofDeletedAt: now },
      });
    } catch (error) {
      console.error("Payment screenshot retention cleanup failed:", error.message);
    }
  }

  await Order.updateMany({ paymentProofTokenExpiresAt: { $lte: now } }, {
    $unset: { paymentProofTokenHash: 1, paymentProofTokenExpiresAt: 1 },
  });
  return count;
};
