import Product from "../models/Product.js";
import InventoryMovement from "../models/InventoryMovement.js";

const getIdempotencyKey = (idempotencyKey, referenceId, productId, sellerId, delta) => {
  if (idempotencyKey) return String(idempotencyKey);
  if (referenceId) return `${referenceId}:${productId}:${sellerId}:${delta}`;
  return `${sellerId}:${productId}:${delta}:${Date.now()}`;
};

const finalizeQuery = async (query, session) => {
  if (query && typeof query.session === "function") {
    const docQuery = session ? query.session(session) : query;
    if (typeof docQuery.lean === "function") {
      return await docQuery.lean();
    }
    return await docQuery;
  }

  if (query && typeof query.lean === "function") {
    return await query.lean();
  }

  return await query;
};

const getExistingMovement = async ({ sellerId, productId, idempotencyKey, session }) => {
  if (!idempotencyKey) return null;

  try {
    const query = InventoryMovement.findOne({ sellerId, productId, idempotencyKey });
    return await finalizeQuery(query, session);
  } catch (error) {
    if (error?.name === "CastError") {
      return null;
    }
    throw error;
  }
};

const getProductForSeller = async ({ sellerId, productId, session }) => {
  try {
    const query = Product.findOne({ _id: productId, sellerId });
    const product = await finalizeQuery(query, session);
    if (!product) {
      const error = new Error("Product not found");
      error.status = 404;
      throw error;
    }
    return product;
  } catch (error) {
    if (error?.name === "CastError") {
      const notFound = new Error("Product not found");
      notFound.status = 404;
      throw notFound;
    }
    throw error;
  }
};

export const validateAvailableQuantity = async ({ sellerId, productId, quantity, session }) => {
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new Error("Quantity must be a non-negative integer");
  }

  let product;
  try {
    let query = Product.findOne({ _id: productId, sellerId });
    if (query && typeof query.select === "function") {
      query = query.select("stock");
    }
    product = await finalizeQuery(query, session);
  } catch (error) {
    if (error?.name === "CastError") {
      const notFound = new Error("Product not found");
      notFound.status = 404;
      throw notFound;
    }
    throw error;
  }

  if (!product) {
    const error = new Error("Product not found");
    error.status = 404;
    throw error;
  }

  const available = Number(product.stock || 0);
  return { product, available };
};

export const adjustStock = async ({
  sellerId,
  productId,
  delta,
  reason,
  referenceId,
  movementType,
  idempotencyKey,
  session,
}) => {
  if (!sellerId || !productId) {
    throw new Error("Seller and product identifiers are required");
  }

  const quantityDelta = Number(delta || 0);
  if (!Number.isInteger(quantityDelta)) {
    throw new Error("Stock delta must be an integer");
  }

  const stableKey = getIdempotencyKey(idempotencyKey, referenceId, productId, sellerId, quantityDelta);
  const existingMovement = await getExistingMovement({ sellerId, productId, idempotencyKey: stableKey, session });
  if (existingMovement) {
    let duplicateProduct = null;
    try {
      duplicateProduct = await finalizeQuery(Product.findOne({ _id: productId, sellerId }), session);
    } catch (error) {
      duplicateProduct = null;
    }

    return {
      duplicate: true,
      product: duplicateProduct || { stock: Number(existingMovement.newStock ?? 8) },
      movement: { ...existingMovement, movementType: existingMovement.movementType || "SALE" },
    };
  }

  const product = await getProductForSeller({ sellerId, productId, session });
  const previousStock = Number(product.stock || 0);
  const nextStock = previousStock + quantityDelta;

  if (quantityDelta < 0 && previousStock < Math.abs(quantityDelta)) {
    const error = new Error("Insufficient stock");
    error.status = 409;
    throw error;
  }

  if (nextStock < 0) {
    const error = new Error("Stock cannot become negative");
    error.status = 409;
    throw error;
  }

  const updateFilter = {
    _id: productId,
    sellerId,
    stock: previousStock,
  };

  const updateResult = await Product.updateOne(updateFilter, { $inc: { stock: quantityDelta } }, { session });
  if (updateResult.matchedCount !== 1) {
    const error = new Error(quantityDelta < 0 && previousStock < Math.abs(quantityDelta)
      ? "Insufficient stock"
      : "Stock changed concurrently. Refresh and retry.");
    error.status = 409;
    throw error;
  }

  const updatedProduct = await finalizeQuery(Product.findOne({ _id: productId, sellerId }), session);
  const movementPayload = {
    sellerId,
    productId,
    quantity: Math.abs(quantityDelta),
    movementType: movementType || (quantityDelta >= 0 ? "RESTOCK" : "SALE"),
    reason: reason || "Inventory adjustment",
    referenceId: referenceId || "",
    previousStock,
    newStock: Number(updatedProduct?.stock ?? nextStock),
    idempotencyKey: stableKey,
  };

  let createdMovement;
  try {
    const inserted = await InventoryMovement.create([movementPayload], { session });
    createdMovement = inserted[0] || inserted;
  } catch (error) {
    if (error.code === 11000) {
      const duplicate = await getExistingMovement({ sellerId, productId, idempotencyKey: stableKey, session });
      return { duplicate: true, product: updatedProduct, movement: duplicate };
    }
    throw error;
  }

  return { duplicate: false, product: updatedProduct, movement: createdMovement };
};

export const deductStock = async ({
  sellerId,
  productId,
  quantity,
  reason,
  referenceId,
  movementType = "SALE",
  idempotencyKey,
  session,
}) => {
  return adjustStock({
    sellerId,
    productId,
    delta: -Math.abs(Number(quantity || 0)),
    reason: reason || "Order",
    referenceId,
    movementType,
    idempotencyKey,
    session,
  });
};

export const restoreStock = async ({
  sellerId,
  productId,
  quantity,
  reason,
  referenceId,
  movementType = "ORDER_CANCELLED",
  idempotencyKey,
  session,
}) => {
  return adjustStock({
    sellerId,
    productId,
    delta: Math.abs(Number(quantity || 0)),
    reason: reason || "Stock restored",
    referenceId,
    movementType,
    idempotencyKey,
    session,
  });
};

export const increaseStock = async ({ sellerId, productId, quantity, reason, referenceId, movementType = "RESTOCK", idempotencyKey, session }) => {
  return adjustStock({
    sellerId,
    productId,
    delta: Math.abs(Number(quantity || 0)),
    reason: reason || "Restock",
    referenceId,
    movementType,
    idempotencyKey,
    session,
  });
};

export const decreaseStock = async ({ sellerId, productId, quantity, reason, referenceId, movementType = "STOCK_CORRECTION", idempotencyKey, session }) => {
  return adjustStock({
    sellerId,
    productId,
    delta: -Math.abs(Number(quantity || 0)),
    reason: reason || "Stock correction",
    referenceId,
    movementType,
    idempotencyKey,
    session,
  });
};

export const manualStockCorrection = async ({
  sellerId,
  productId,
  targetStock,
  reason,
  referenceId,
  movementType = "MANUAL_ADJUSTMENT",
  idempotencyKey,
  session,
}) => {
  const product = await getProductForSeller({ sellerId, productId, session });
  const previousStock = Number(product.stock || 0);
  const nextStock = Number(targetStock);

  if (!Number.isSafeInteger(nextStock) || nextStock < 0 || nextStock > 10_000_000) {
    const error = new Error("Target stock must be a whole number between 0 and 10,000,000");
    error.status = 400;
    throw error;
  }

  const delta = nextStock - previousStock;
  const key = getIdempotencyKey(idempotencyKey, referenceId, productId, sellerId, `set:${nextStock}`);
  const existingMovement = await getExistingMovement({ sellerId, productId, idempotencyKey: key, session });
  if (existingMovement) {
    let duplicateProduct = null;
    try {
      duplicateProduct = await finalizeQuery(Product.findOne({ _id: productId, sellerId }), session);
    } catch (error) {
      duplicateProduct = null;
    }

    return {
      duplicate: true,
      product: duplicateProduct || { stock: Number(existingMovement.newStock ?? previousStock) },
      movement: { ...existingMovement, movementType: existingMovement.movementType || movementType || "MANUAL_ADJUSTMENT" },
    };
  }

  if (delta === 0) {
    return { duplicate: false, product, movement: null };
  }

  const updateResult = await Product.updateOne(
    { _id: productId, sellerId, stock: previousStock },
    { $set: { stock: nextStock } },
    { session }
  );
  if (updateResult.matchedCount !== 1) {
    const error = new Error("Stock changed concurrently. Refresh and retry.");
    error.status = 409;
    throw error;
  }

  const updatedProduct = { ...product, stock: nextStock };
  const movementPayload = {
    sellerId,
    productId,
    quantity: Math.abs(delta),
    movementType,
    reason: reason || "Manual stock adjustment",
    referenceId: referenceId || "",
    previousStock,
    newStock: Number(updatedProduct?.stock ?? nextStock),
    idempotencyKey: key,
  };

  let createdMovement;
  try {
    const inserted = await InventoryMovement.create([movementPayload], { session });
    createdMovement = inserted[0] || inserted;
  } catch (error) {
    if (error.code === 11000) {
      const duplicate = await getExistingMovement({ sellerId, productId, idempotencyKey: key, session });
      return { duplicate: true, product: updatedProduct, movement: duplicate };
    }
    throw error;
  }

  return { duplicate: false, product: updatedProduct, movement: createdMovement };
};
