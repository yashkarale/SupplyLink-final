import mongoose from "mongoose";
import Product from "../models/Product.js";
import Seller from "../models/Seller.js";
import { publishStoreEvent } from "../utils/storeEvents.js";
import { getProductLimitForSeller } from "../utils/planEntitlements.js";
import { isDatabaseWriteLimitReached } from "../utils/storageUsage.js";
import { destroyCloudinaryImage, inspectUploadedImage, uploadImageToCloudinary } from "../services/mediaStorage.js";
import { createNotification } from "./notificationController.js";
import { manualStockCorrection } from "../services/inventoryService.js";
import InventoryMovement from "../models/InventoryMovement.js";
import crypto from "node:crypto";

const isDatabaseAtWriteLimit = async () => {
  try {
    return await isDatabaseWriteLimitReached(mongoose.connection.db);
  } catch (error) {
    console.error("Product storage check failed:", error.message);
    return true;
  }
};

const notifyPublicStore = async (sellerId) => {
  try {
    const seller = await Seller.findOne({ userId: sellerId }).select("storeSlug isPublished status").lean();
    if (seller?.isPublished && seller.status !== "suspended") publishStoreEvent(seller.storeSlug, "catalog.updated");
  } catch (error) {
    console.error("Store update event could not be published:", error.message);
  }
};

const slugify = (value) => {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "product";
};

const sanitizeProductPayload = (body, { allowExistingVariantStock = false } = {}) => {
  const parsed = { ...body };

  parsed.name = String(parsed.name || "").trim();
  parsed.category = String(parsed.category || "").trim();
  parsed.description = String(parsed.description || "").trim();
  parsed.sku = String(parsed.sku || "").trim().toUpperCase();
  parsed.status = String(parsed.status || "published").trim().toLowerCase();

  if (!parsed.name || !parsed.category) {
    throw new Error("Product name and category are required");
  }
  if (parsed.name.length > 160 || parsed.category.length > 80 || parsed.sku.length > 80 || parsed.description.length > 2000) {
    throw new Error("Product text exceeds the allowed length");
  }

  parsed.price = Number(parsed.price);
  parsed.stock = Number(parsed.stock ?? 0);
  parsed.lowStockThreshold = Number(parsed.lowStockThreshold ?? 5);
  parsed.compareAtPrice = Number(parsed.compareAtPrice || 0);

  if (!Number.isFinite(parsed.price) || parsed.price < 0) {
    throw new Error("Price must be a valid non-negative number");
  }

  if (!Number.isFinite(parsed.stock) || parsed.stock < 0) {
    throw new Error("Stock must be a valid non-negative number");
  }

  if (!Number.isFinite(parsed.lowStockThreshold) || parsed.lowStockThreshold < 0) {
    throw new Error("Low stock threshold must be valid");
  }

  parsed.images = Array.isArray(parsed.images) ? parsed.images.filter(Boolean) : [];
  if (parsed.images.length > 8 || parsed.images.some((image) => typeof image !== "string" || image.length > 2048 || !(/^(https?:\/\/[^\s]+|\/(?!\/)[^\s]*)$/i.test(image)))) {
    throw new Error("Use up to 8 HTTP(S) or local image URLs, each no longer than 2048 characters. Store image files outside MongoDB.");
  }
  parsed.variants = Array.isArray(parsed.variants) ? parsed.variants : [];
  if (parsed.variants.length > 50) {
    throw new Error("A product can have at most 50 variants.");
  }
  parsed.variants = parsed.variants.map((variant) => {
    const size = String(variant?.size || "").trim();
    const color = String(variant?.color || "").trim();
    const hasStock = variant?.stock !== undefined && variant?.stock !== null;
    if (hasStock && !allowExistingVariantStock) throw new Error("Variant stock is not supported; use the product inventory adjustment.");
    const stock = hasStock ? Number(variant.stock) : undefined;
    if (size.length > 60 || color.length > 60 || (stock !== undefined && (!Number.isInteger(stock) || stock < 0))) {
      throw new Error("Product variant details are invalid or too long.");
    }
    return { size, color, ...(stock === undefined ? {} : { stock }) };
  });

  return parsed;
};

export const listProducts = async (req, res) => {
  try {
    const [products, seller] = await Promise.all([
      Product.find({ sellerId: req.user.userId }).sort({ createdAt: -1 }),
      Seller.findOne({ userId: req.user.userId }).select("plan subscriptionStatus planExpiresAt").lean(),
    ]);
    const productLimit = getProductLimitForSeller(seller);

    return res.status(200).json({
      success: true,
      products,
      productLimit,
      activeProductCount: products.filter((product) => product.status !== "archived").length,
    });
  } catch (error) {
    console.error("List products error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to load products",
    });
  }
};

export const getProduct = async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      sellerId: req.user.userId,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.status(200).json({
      success: true,
      product,
    });
  } catch (error) {
    console.error("Get product error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to retrieve product",
    });
  }
};

export const createProduct = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    if (await isDatabaseAtWriteLimit()) {
      return res.status(503).json({ success: false, message: "Product changes are temporarily paused while database capacity is prepared." });
    }
    const payload = sanitizeProductPayload(req.body);
    const baseSlug = payload.slug || slugify(payload.name);
    let createdProduct;
    await session.withTransaction(async () => {
      const seller = await Seller.findOne({ userId: req.user.userId }).session(session);
      if (!seller) {
        const error = new Error("Complete store setup before adding products.");
        error.status = 403;
        throw error;
      }

      const productLimit = getProductLimitForSeller(seller);
      if (productLimit !== null && payload.status !== "archived") {
        await Seller.updateOne({ _id: seller._id }, { $inc: { productLimitLockVersion: 1 } }, { session });
        const activeCount = await Product.countDocuments({
          sellerId: req.user.userId,
          status: { $ne: "archived" },
        }).session(session);
        if (activeCount >= productLimit) {
          const error = new Error(`The Free plan allows up to ${productLimit} non-archived products. Archive a product or upgrade your plan.`);
          error.status = 403;
          throw error;
        }
      }

      const duplicateProduct = await Product.findOne({ sellerId: req.user.userId, slug: baseSlug }).session(session);
      if (duplicateProduct) {
        const error = new Error("A product with this slug already exists");
        error.status = 409;
        throw error;
      }

      [createdProduct] = await Product.create([{
        ...payload,
        stock: 0,
        sellerId: req.user.userId,
        slug: baseSlug,
        isPublished: payload.status === "published",
      }], { session });
      if (payload.stock > 0) {
        const initialInventory = await manualStockCorrection({
          sellerId: req.user.userId,
          productId: createdProduct._id,
          targetStock: payload.stock,
          reason: "Initial product inventory",
          referenceId: String(createdProduct._id),
          movementType: "MANUAL_ADJUSTMENT",
          idempotencyKey: `product-create:${createdProduct._id}`,
          session,
        });
        createdProduct.stock = initialInventory.product.stock;
      }
    });
    await notifyPublicStore(req.user.userId);

    return res.status(201).json({
      success: true,
      message: "Product created successfully",
      product: createdProduct,
    });
  } catch (error) {
    console.error("Create product error:", error.message);
    return res.status(error.status || (error.code === 11000 ? 409 : 400)).json({
      success: false,
      message: error.message || "Unable to create product",
    });
  } finally {
    await session.endSession();
  }
};

export const updateProduct = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    if (await isDatabaseAtWriteLimit()) {
      return res.status(503).json({ success: false, message: "Product changes are temporarily paused while database capacity is prepared." });
    }
    let updatedProduct;
    let inventoryAdjustment;
    await session.withTransaction(async () => {
      const product = await Product.findOne({ _id: req.params.id, sellerId: req.user.userId }).session(session);
      if (!product) {
        const error = new Error("Product not found");
        error.status = 404;
        throw error;
      }

      const editableFields = [
        "name", "category", "description", "sku", "status", "price",
        "lowStockThreshold", "compareAtPrice", "images", "variants",
      ];
      const updates = Object.fromEntries(
        editableFields
          .filter((field) => Object.prototype.hasOwnProperty.call(req.body, field))
          .map((field) => [field, req.body[field]])
      );
      if (Array.isArray(updates.variants) && updates.variants.some((variant) => Object.prototype.hasOwnProperty.call(variant || {}, "stock"))) {
        const error = new Error("Variant stock cannot be edited directly; use the product inventory adjustment.");
        error.status = 400;
        throw error;
      }
      const payload = sanitizeProductPayload({ ...product.toObject(), ...updates }, { allowExistingVariantStock: true });
      const nextSlug = req.body.name ? slugify(req.body.name) : product.slug;

      if (Object.prototype.hasOwnProperty.call(req.body || {}, "stock")) {
        const targetStock = Number(req.body.stock);
        if (!Number.isSafeInteger(targetStock) || targetStock < 0 || targetStock > 10_000_000) {
          const error = new Error("Stock must be a whole number between 0 and 10,000,000.");
          error.status = 400;
          throw error;
        }
        inventoryAdjustment = await manualStockCorrection({
          sellerId: req.user.userId,
          productId: product._id,
          targetStock,
          reason: "Product edit stock update",
          referenceId: String(req.body.referenceId || req.params.id),
          movementType: "MANUAL_ADJUSTMENT",
          idempotencyKey: String(req.get?.("Idempotency-Key") || req.body.idempotencyKey || crypto.randomUUID()),
          session,
        });
      }

      if (nextSlug !== product.slug) {
        const duplicateProduct = await Product.findOne({
          sellerId: req.user.userId,
          slug: nextSlug,
          _id: { $ne: product._id },
        }).session(session);
        if (duplicateProduct) {
          const error = new Error("A product with this new slug already exists");
          error.status = 409;
          throw error;
        }
      }

      if (product.status === "archived" && payload.status !== "archived") {
        const seller = await Seller.findOne({ userId: req.user.userId }).session(session);
        const productLimit = getProductLimitForSeller(seller);
        if (productLimit !== null) {
          if (seller) await Seller.updateOne({ _id: seller._id }, { $inc: { productLimitLockVersion: 1 } }, { session });
          const activeCount = await Product.countDocuments({
            sellerId: req.user.userId,
            status: { $ne: "archived" },
            _id: { $ne: product._id },
          }).session(session);
          if (activeCount >= productLimit) {
            const error = new Error(`The Free plan allows up to ${productLimit} non-archived products. Archive a product or upgrade your plan.`);
            error.status = 403;
            throw error;
          }
        }
      }

      const { stock: _ignoredStock, ...productFields } = payload;
      Object.assign(product, productFields, {
        slug: nextSlug,
        isPublished: payload.status === "published",
      });
      await product.save({ session });
      updatedProduct = inventoryAdjustment
        ? await Product.findOne({ _id: product._id, sellerId: req.user.userId }).session(session)
        : product;
    });
    await notifyPublicStore(req.user.userId);

    return res.status(200).json({
      success: true,
      message: "Product updated successfully",
      product: updatedProduct,
    });
  } catch (error) {
    console.error("Update product error:", error.message);
    return res.status(error.status || (error.code === 11000 ? 409 : 400)).json({
      success: false,
      message: error.message || "Unable to update product",
    });
  } finally {
    await session.endSession();
  }
};

export const updateInventory = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    if (await isDatabaseAtWriteLimit()) {
      return res.status(503).json({ success: false, message: "Inventory changes are temporarily paused while database capacity is prepared." });
    }
    const hasStock = Object.prototype.hasOwnProperty.call(req.body || {}, "stock");
    const hasDelta = Object.prototype.hasOwnProperty.call(req.body || {}, "delta");
    if (hasStock === hasDelta) {
      return res.status(400).json({ success: false, message: "Provide exactly one of stock or delta" });
    }
    if (hasDelta && !String(req.body.idempotencyKey || req.get?.("Idempotency-Key") || "").trim()) {
      return res.status(400).json({ success: false, message: "Delta stock changes require a stable idempotency key." });
    }

    const value = Number(hasStock ? req.body.stock : req.body.delta);
    if (!Number.isSafeInteger(value) || Math.abs(value) > 10_000_000) {
      return res.status(400).json({ success: false, message: "Stock changes must be whole numbers between 0 and 10,000,000" });
    }

    const reason = String(req.body.reason || (hasStock ? "Manual stock update" : "Inventory delta")).slice(0, 250);
    const referenceId = String(req.body.referenceId || req.params.id || "");
    const idempotencyKey = String(req.body.idempotencyKey || req.get?.("Idempotency-Key") || crypto.randomUUID()).trim();
    if (idempotencyKey.length > 160) return res.status(400).json({ success: false, message: "Idempotency key is too long." });

    let result;
    await session.withTransaction(async () => {
      let currentProduct;
      if (hasStock) {
        if (value < 0) {
          throw Object.assign(new Error("Stock value cannot be negative"), { status: 400 });
        }
        currentProduct = await Product.findOne({ _id: req.params.id, sellerId: req.user.userId }).session(session);
        if (!currentProduct) {
          const error = new Error("Product not found");
          error.status = 404;
          throw error;
        }
        result = await manualStockCorrection({
          sellerId: req.user.userId,
          productId: req.params.id,
          targetStock: value,
          reason,
          referenceId,
          movementType: "MANUAL_ADJUSTMENT",
          idempotencyKey,
          session,
        });
      } else {
        currentProduct = await Product.findOne({ _id: req.params.id, sellerId: req.user.userId }).select("stock").session(session).lean();
        if (!currentProduct) {
          const error = new Error("Product not found");
          error.status = 404;
          throw error;
        }
        const targetStock = Number(currentProduct.stock || 0) + value;
        result = value >= 0
          ? await manualStockCorrection({
              sellerId: req.user.userId,
              productId: req.params.id,
              targetStock,
              reason,
              referenceId,
              movementType: "RESTOCK",
              idempotencyKey,
              session,
            })
          : await manualStockCorrection({
              sellerId: req.user.userId,
              productId: req.params.id,
              targetStock,
              reason,
              referenceId,
              movementType: "STOCK_CORRECTION",
              idempotencyKey,
              session,
            });
      }

      if (!result.product) {
        const error = new Error("Product not found");
        error.status = 404;
        throw error;
      }
    });

    await notifyPublicStore(req.user.userId);

    if (Number(result.product.stock) <= Number(result.product.lowStockThreshold || 5)) {
      createNotification({
        sellerId: req.user.userId,
        type: "stock_low",
        title: "Low stock alert",
        message: `Product "${result.product.name}" is running low (${result.product.stock} left).`,
        data: { productId: result.product._id, productName: result.product.name, stock: result.product.stock, threshold: result.product.lowStockThreshold },
        link: `/inventory`,
      }).catch((error) => console.error("Failed to create low stock notification:", error.message));
    }

    return res.status(200).json({
      success: true,
      message: "Inventory updated successfully",
      product: result.product,
      movement: result.movement,
    });
  } catch (error) {
    console.error("Inventory update error:", error.message);
    return res.status(error.status || (error.name === "CastError" ? 404 : 500)).json({
      success: false,
      message: error.status === 409 ? error.message : "Unable to update inventory",
    });
  } finally {
    await session.endSession();
  }
};

export const listInventoryMovements = async (req, res) => {
  try {
    const rawPage = Number.parseInt(req.query.page || "1", 10);
    const rawLimit = Number.parseInt(req.query.limit || "25", 10);
    const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
    const limit = Number.isInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 25;
    const filter = { sellerId: req.user.userId };
    if (req.query.productId) filter.productId = req.query.productId;
    if (req.query.type && ["SALE", "RESTOCK", "ORDER_CANCELLED", "MANUAL_ADJUSTMENT", "STOCK_CORRECTION", "RETURN"].includes(String(req.query.type).toUpperCase())) {
      filter.movementType = String(req.query.type).toUpperCase();
    }
    const fromDate = req.query.fromDate ? new Date(req.query.fromDate) : null;
    const toDate = req.query.toDate ? new Date(req.query.toDate) : null;
    if ((req.query.fromDate && Number.isNaN(fromDate?.getTime())) || (req.query.toDate && Number.isNaN(toDate?.getTime()))) {
      return res.status(400).json({ success: false, message: "Enter valid movement date filters." });
    }
    if (fromDate || toDate) filter.createdAt = { ...(fromDate ? { $gte: fromDate } : {}), ...(toDate ? { $lte: toDate } : {}) };
    if (req.query.search) {
      const search = String(req.query.search).trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (search) filter.$or = [{ reason: { $regex: search, $options: "i" } }, { referenceId: { $regex: search, $options: "i" } }];
    }
    const [rows, total] = await Promise.all([
      InventoryMovement.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      InventoryMovement.countDocuments(filter),
    ]);
    const productIds = [...new Set(rows.map((row) => String(row.productId)))];
    const products = productIds.length ? await Product.find({ _id: { $in: productIds }, sellerId: req.user.userId }).select("name category sku").lean() : [];
    const productMap = new Map(products.map((product) => [String(product._id), product]));
    return res.status(200).json({
      success: true,
      movements: rows.map((row) => ({
        id: row._id,
        productId: row.productId,
        product: productMap.get(String(row.productId)) ? { name: productMap.get(String(row.productId)).name, category: productMap.get(String(row.productId)).category, sku: productMap.get(String(row.productId)).sku || "" } : null,
        quantity: row.quantity,
        movementType: row.movementType,
        reason: row.reason,
        referenceId: row.referenceId,
        previousStock: row.previousStock,
        newStock: row.newStock,
        createdAt: row.createdAt,
      })),
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (error) {
    console.error("Inventory movement history failed:", error.message);
    return res.status(500).json({ success: false, message: "Unable to load inventory movement history." });
  }
};

export const uploadProductImage = async (req, res) => {
  let uploaded;
  try {
    const inspected = inspectUploadedImage(req.body, req.headers["content-type"], "product-image");
    const product = await Product.findOne({ _id: req.params.id, sellerId: req.user.userId });
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });
    if (product.images.length >= 8) return res.status(409).json({ success: false, message: "A product can have at most 8 images." });

    uploaded = await uploadImageToCloudinary({
      buffer: req.body,
      contentType: req.headers["content-type"],
      folder: "supplylink/product-images",
      publicId: `${req.user.userId}-${req.params.id}-${crypto.randomUUID()}`,
      deliveryType: "upload",
    });
    if (!uploaded.secureUrl?.startsWith("https://")) throw Object.assign(new Error("Image storage did not return a secure URL."), { status: 502 });

    product.images.push(uploaded.secureUrl);
    await product.save();
    await notifyPublicStore(req.user.userId);
    return res.status(201).json({
      success: true,
      image: { url: uploaded.secureUrl, width: inspected.width, height: inspected.height },
      product,
    });
  } catch (error) {
    if (uploaded?.publicId) await destroyCloudinaryImage(uploaded.publicId).catch((cleanupError) => console.error("Orphan product image cleanup failed:", cleanupError.message));
    console.error("Product image upload failed:", error.message);
    return res.status(error.status || 502).json({ success: false, message: error.message || "Unable to upload product image." });
  }
};
