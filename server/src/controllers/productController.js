import Product from "../models/Product.js";

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
  parsed.variants = Array.isArray(parsed.variants) ? parsed.variants : [];

  return parsed;
};

export const listProducts = async (req, res) => {
  try {
    const products = await Product.find({ sellerId: req.user.userId }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      products,
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
  try {
    const payload = sanitizeProductPayload(req.body);
    const baseSlug = payload.slug || slugify(payload.name);

    const duplicateProduct = await Product.findOne({
      sellerId: req.user.userId,
      slug: baseSlug,
    });

    if (duplicateProduct) {
      return res.status(409).json({
        success: false,
        message: "A product with this slug already exists",
      });
    }

    const product = await Product.create({
      ...payload,
      sellerId: req.user.userId,
      slug: baseSlug,
      isPublished: payload.status === "published",
    });

    return res.status(201).json({
      success: true,
      message: "Product created successfully",
      product,
    });
  } catch (error) {
    console.error("Create product error:", error.message);
    return res.status(400).json({
      success: false,
      message: error.message || "Unable to create product",
    });
  }
};

export const updateProduct = async (req, res) => {
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

    const payload = sanitizeProductPayload({
      ...product.toObject(),
      ...req.body,
    });

    if (req.body.name && product.slug !== slugify(req.body.name)) {
      const duplicateProduct = await Product.findOne({
        sellerId: req.user.userId,
        slug: slugify(req.body.name),
        _id: { $ne: product._id },
      });

      if (duplicateProduct) {
        return res.status(409).json({
          success: false,
          message: "A product with this new slug already exists",
        });
      }
    }

    Object.assign(product, payload, {
      slug: req.body.name ? slugify(req.body.name) : product.slug,
      isPublished: (req.body.status || product.status) === "published",
    });

    await product.save();

    return res.status(200).json({
      success: true,
      message: "Product updated successfully",
      product,
    });
  } catch (error) {
    console.error("Update product error:", error.message);
    return res.status(400).json({
      success: false,
      message: error.message || "Unable to update product",
    });
  }
};

export const updateInventory = async (req, res) => {
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
