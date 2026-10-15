import mongoose from "mongoose";
import Product from "../models/Product.js";
import Seller from "../models/Seller.js";
import { publishStoreEvent } from "../utils/storeEvents.js";
import { getProductLimitForSeller } from "../utils/planEntitlements.js";
import { isDatabaseWriteLimitReached } from "../utils/storageUsage.js";

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

const sanitizeProductPayload = (body) => {
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
    const stock = variant?.stock === undefined || variant?.stock === null ? undefined : Number(variant.stock);
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
        sellerId: req.user.userId,
        slug: baseSlug,
        isPublished: payload.status === "published",
      }], { session });
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
    await session.withTransaction(async () => {
      const product = await Product.findOne({ _id: req.params.id, sellerId: req.user.userId }).session(session);
      if (!product) {
        const error = new Error("Product not found");
        error.status = 404;
        throw error;
      }

      const editableFields = [
        "name", "category", "description", "sku", "status", "price", "stock",
        "lowStockThreshold", "compareAtPrice", "images", "variants",
      ];
      const updates = Object.fromEntries(
        editableFields
          .filter((field) => Object.prototype.hasOwnProperty.call(req.body, field))
          .map((field) => [field, req.body[field]])
      );
      const payload = sanitizeProductPayload({ ...product.toObject(), ...updates });
      const nextSlug = req.body.name ? slugify(req.body.name) : product.slug;

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

      Object.assign(product, payload, {
        slug: nextSlug,
        isPublished: payload.status === "published",
      });
      await product.save({ session });
      updatedProduct = product;
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
  try {
    if (await isDatabaseAtWriteLimit()) {
      return res.status(503).json({ success: false, message: "Inventory changes are temporarily paused while database capacity is prepared." });
    }
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

    const requestedStock = Number(req.body.stock);
    const delta = Number(req.body.delta ?? 0);

    if (Number.isFinite(requestedStock)) {
      if (requestedStock < 0) {
        return res.status(400).json({
          success: false,
          message: "Stock cannot be negative",
        });
      }

      product.stock = requestedStock;
    } else if (Number.isFinite(delta)) {
      product.stock = Math.max(0, Number(product.stock) + delta);
    } else {
      return res.status(400).json({
        success: false,
        message: "Provide either stock or delta",
      });
    }

    await product.save();
    await notifyPublicStore(req.user.userId);

    return res.status(200).json({
      success: true,
      message: "Inventory updated successfully",
      product,
    });
  } catch (error) {
    console.error("Inventory update error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to update inventory",
    });
  }
};
