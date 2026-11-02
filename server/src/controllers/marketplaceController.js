import Product from "../models/Product.js";
import Seller from "../models/Seller.js";
import Order from "../models/Order.js";

const getSellerSort = (value) => {
  const sort = sanitizeMarketplaceText(value).toLowerCase();
  if (sort === "name") return { businessName: 1, _id: 1 };
  if (sort === "category") return { category: 1, businessName: 1, _id: 1 };
  return { createdAt: -1, _id: 1 };
};

const normalizePagination = (query = {}) => {
  const rawPage = Number.parseInt(query.page ?? "1", 10);
  const rawLimit = Number.parseInt(query.limit ?? "12", 10);

  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const limit = Number.isInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 50) : 12;

  return { page, limit, skip: (page - 1) * limit };
};

const sanitizeMarketplaceText = (value) => {
  if (value === undefined || value === null) return "";
  return String(value)
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parsePriceFilter = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
};

const normalizeSortValue = (value) => {
  const next = sanitizeMarketplaceText(value).toLowerCase();
  if (["newest", "price_asc", "price_desc", "relevance"].includes(next)) return next;
  return "newest";
};

const serializePublicSeller = (seller) => ({
  id: seller._id,
  businessName: seller.businessName,
  storeSlug: seller.storeSlug,
  category: seller.category,
  description: seller.description || "",
  businessAddress: seller.businessAddress || "",
  country: seller.country || null,
  city: seller.city || null,
  state: seller.state || null,
  area: seller.area || null,
  locality: seller.locality || null,
  pickupAvailable: Boolean(seller.pickupAvailable),
  sellerDeliveryAvailable: Boolean(seller.sellerDeliveryAvailable),
  openingHours: Array.isArray(seller.openingHours)
    ? seller.openingHours.map((hours) => ({
      day: hours.day || "",
      isClosed: Boolean(hours.isClosed),
      intervals: Array.isArray(hours.intervals)
        ? hours.intervals.map((interval) => ({ open: interval.open || "", close: interval.close || "" }))
        : [],
    }))
    : [],
  storefrontUrl: `/store/${encodeURIComponent(seller.storeSlug)}`,
});

const serializePublicProduct = (product) => {
  const stock = product.stock === undefined || product.stock === null || product.stock === ""
    ? null
    : Number(product.stock);
  return {
    _id: product._id,
    name: product.name,
    slug: product.slug,
    description: product.description || "",
    category: product.category,
    price: product.price,
    compareAtPrice: product.compareAtPrice,
    images: Array.isArray(product.images) ? product.images : [],
    createdAt: product.createdAt,
    availability: stock !== null && Number.isFinite(stock)
      ? (stock > 0 ? "in_stock" : "out_of_stock")
      : "seller_confirmation_required",
  };
};

const buildVisibleSellerQuery = (overrides = {}) => ({
  isPublished: true,
  status: "active",
  ...overrides,
});

const normalizeDiscoveryValue = (value) => {
  const text = sanitizeMarketplaceText(value);
  return text || null;
};

const coerceBoolean = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes"].includes(normalized)) return true;
  if (["false", "0", "no"].includes(normalized)) return false;
  return null;
};

const parseDiscoveryPage = (value) => {
  const next = Number.parseInt(value ?? "1", 10);
  return Number.isInteger(next) && next > 0 ? next : 1;
};

const parseDiscoveryLimit = (value) => {
  const next = Number.parseInt(value ?? "12", 10);
  return Number.isInteger(next) && next > 0 ? Math.min(next, 24) : 12;
};

const buildMarketplaceFilters = (req, sellers) => {
  const search = sanitizeMarketplaceText(req.query.search);
  const category = sanitizeMarketplaceText(req.query.category);
  const minPrice = parsePriceFilter(req.query.minPrice);
  const maxPrice = parsePriceFilter(req.query.maxPrice);
  const inStockOnly = String(req.query.inStock ?? "").toLowerCase() === "true" || String(req.query.inStock ?? "") === "1";
  const sellerFilter = sanitizeMarketplaceText(req.query.seller || req.query.sellerId);

  const sellerIds = sellers.map((seller) => seller.userId);
  const visibleSellerIds = sellerFilter
    ? sellers
        .filter((seller) => {
          const target = sellerFilter.toLowerCase();
          const lookups = [
            String(seller.userId || "").toLowerCase(),
            String(seller.storeSlug || "").toLowerCase(),
            String(seller.businessName || "").toLowerCase(),
          ];
          return lookups.some((entry) => entry === target || entry.includes(target));
        })
        .map((seller) => seller.userId)
    : sellerIds;

  const filters = {
    sellerId: { $in: visibleSellerIds },
    isPublished: true,
    status: "published",
  };

  if (category) {
    filters.category = category;
  }

  if (minPrice !== null || maxPrice !== null) {
    filters.price = {};
    if (minPrice !== null) filters.price.$gte = minPrice;
    if (maxPrice !== null) filters.price.$lte = maxPrice;
  }

  if (inStockOnly) {
    filters.stock = { $gt: 0 };
  }

  if (search) {
    filters.$text = { $search: search };
  }

  return filters;
};

const getProductSort = (sortValue, hasSearch) => {
  if (hasSearch) {
    return {
      score: { $meta: "textScore" },
      createdAt: -1,
      _id: 1,
    };
  }

  switch (sortValue) {
    case "price_asc":
      return { price: 1, createdAt: -1, _id: 1 };
    case "price_desc":
      return { price: -1, createdAt: -1, _id: 1 };
    case "newest":
    default:
      return { createdAt: -1, _id: 1 };
  }
};

const getPublicSellerMap = (sellers) => {
  const sellerMap = new Map();
  for (const seller of sellers) {
    sellerMap.set(String(seller.userId), serializePublicSeller(seller));
  }
  return sellerMap;
};

export const listMarketplaceProducts = async (req, res) => {
  try {
    const { page, limit, skip } = normalizePagination(req.query);
    const sortValue = normalizeSortValue(req.query.sort);
    const search = sanitizeMarketplaceText(req.query.search);
    const country = normalizeDiscoveryValue(req.query.country);
    const state = normalizeDiscoveryValue(req.query.state);
    const city = normalizeDiscoveryValue(req.query.city);
    const locality = normalizeDiscoveryValue(req.query.locality);
    const area = normalizeDiscoveryValue(req.query.area);
    const category = normalizeDiscoveryValue(req.query.category);
    const pickup = coerceBoolean(req.query.pickup);
    const sellerDelivery = coerceBoolean(req.query.sellerDelivery);
    const inStockOnly = String(req.query.inStock ?? "") === "true" || String(req.query.inStock ?? "") === "1";

    const sellerQuery = buildVisibleSellerQuery({
      ...(country ? { country } : {}),
      ...(state ? { state } : {}),
      ...(city ? { city } : {}),
      ...(locality ? { locality } : {}),
      ...(area ? { area } : {}),
      ...(pickup !== null ? { pickupAvailable: pickup } : {}),
      ...(sellerDelivery !== null ? { sellerDeliveryAvailable: sellerDelivery } : {}),
    });

    const sellers = await Seller.find(sellerQuery)
      .select("_id userId businessName storeSlug category description businessAddress country city state area locality pickupAvailable sellerDeliveryAvailable openingHours isPublished status")
      .sort({ createdAt: -1 })
      .lean();

    const sellerMap = getPublicSellerMap(sellers);
    const sellerIds = sellers.map((seller) => seller.userId);

    if (!sellerIds.length) {
      return res.status(200).json({
        success: true,
        products: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 1,
        },
      });
    }

    const filters = buildMarketplaceFilters(req, sellers);
    if (category) {
      filters.category = category;
    }
    const hasSearch = Boolean(search);
    const [total, products] = await Promise.all([
      Product.countDocuments(filters),
      Product.find(filters, {
        _id: 1,
        sellerId: 1,
        name: 1,
        slug: 1,
        description: 1,
        category: 1,
        price: 1,
        compareAtPrice: 1,
        images: 1,
        createdAt: 1,
        stock: 1,
        ...(hasSearch ? { score: { $meta: "textScore" } } : {}),
      })
        .sort(getProductSort(sortValue, hasSearch))
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    const visibleProducts = products
      .filter((product) => product && sellerMap.has(String(product.sellerId)))
      .map((product) => {
        const seller = sellerMap.get(String(product.sellerId));

        return {
          ...serializePublicProduct(product),
          seller,
          storefrontUrl: seller.storefrontUrl,
        };
      });

    return res.status(200).json({
      success: true,
      products: visibleProducts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    console.error("Marketplace product listing failed:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to load marketplace products.",
    });
  }
};

export const listPopularMarketplaceProducts = async (req, res) => {
  try {
    const country = normalizeDiscoveryValue(req.query.country);
    const state = normalizeDiscoveryValue(req.query.state);
    const city = normalizeDiscoveryValue(req.query.city);
    const locality = normalizeDiscoveryValue(req.query.locality);
    const limit = parseDiscoveryLimit(req.query.limit || "8");
    const sellerQuery = buildVisibleSellerQuery({
      ...(country ? { country } : {}),
      ...(state ? { state } : {}),
      ...(city ? { city } : {}),
      ...(locality ? { locality } : {}),
    });
    const sellers = await Seller.find(sellerQuery)
      .select("_id userId businessName storeSlug category description businessAddress country city state area locality pickupAvailable sellerDeliveryAvailable openingHours isPublished status")
      .lean();
    const sellerIds = sellers.map((seller) => seller.userId);
    if (!sellerIds.length) return res.status(200).json({ success: true, products: [] });

    const ranking = await Order.aggregate([
      { $match: {
        sellerId: { $in: sellerIds },
        orderType: "ONLINE",
        orderStatus: "DELIVERED",
        $or: [{ paymentStatus: "VERIFIED" }, { paymentMethod: "COD" }],
      } },
      { $unwind: "$items" },
      { $group: { _id: "$items.productId", completedQuantity: { $sum: "$items.quantity" } } },
      { $sort: { completedQuantity: -1, _id: 1 } },
      { $limit: limit },
    ]);
    const rankedIds = ranking.map((item) => item._id).filter(Boolean);
    if (!rankedIds.length) return res.status(200).json({ success: true, products: [] });

    const productQuery = {
      _id: { $in: rankedIds },
      sellerId: { $in: sellerIds },
      isPublished: true,
      status: "published",
    };
    const products = await Product.find(productQuery)
      .select("_id sellerId name slug description category price compareAtPrice images createdAt stock")
      .lean();
    const productMap = new Map(products.map((product) => [String(product._id), product]));
    const sellerMap = getPublicSellerMap(sellers);
    const visibleProducts = rankedIds
      .map((id) => productMap.get(String(id)))
      .filter((product) => product && sellerMap.has(String(product.sellerId)))
      .map((product) => ({
        ...serializePublicProduct(product),
        seller: sellerMap.get(String(product.sellerId)),
      }));
    return res.status(200).json({ success: true, products: visibleProducts });
  } catch (error) {
    console.error("Popular marketplace products failed:", error.message);
    return res.status(500).json({ success: false, message: "Unable to load popular products." });
  }
};

export const getMarketplaceProduct = async (req, res) => {
  try {
    const explicitSellerSlug = sanitizeMarketplaceText(req.params.sellerSlug || req.query.sellerSlug || req.query.seller || "").toLowerCase();
    const slug = sanitizeMarketplaceText(req.params.productSlug || req.params.slug || req.query.productSlug || "").toLowerCase();

    if (!slug) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const visibleSellers = await Seller.find(buildVisibleSellerQuery())
      .select("_id userId businessName storeSlug category description businessAddress country state city area locality pickupAvailable sellerDeliveryAvailable openingHours isPublished status")
      .lean();

    const sellerMap = getPublicSellerMap(visibleSellers);
    const sellerIds = visibleSellers.map((seller) => seller.userId);

    if (!sellerIds.length) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const matchingSeller = explicitSellerSlug
      ? visibleSellers.find((seller) => String(seller.storeSlug || "").toLowerCase() === explicitSellerSlug)
      : null;

    const baseQuery = {
      slug,
      sellerId: { $in: sellerIds },
      isPublished: true,
      status: "published",
    };

    const product = matchingSeller
      ? await Product.findOne({ ...baseQuery, sellerId: matchingSeller.userId })
          .select("_id sellerId name slug description category price compareAtPrice images createdAt stock")
          .lean()
      : await Product.findOne({ ...baseQuery })
          .select("_id sellerId name slug description category price compareAtPrice images createdAt stock")
          .lean();

    const resolvedProduct = product || null;

    if (!matchingSeller && !resolvedProduct) {
      return res.status(404).json({
        success: false,
        message: "This product URL is ambiguous. Use the seller-specific marketplace URL.",
      });
    }

    if (!resolvedProduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const seller = sellerMap.get(String(resolvedProduct.sellerId));
    if (!seller) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.status(200).json({
      success: true,
      product: {
        ...serializePublicProduct(resolvedProduct),
        seller,
        storefrontUrl: seller.storefrontUrl,
      },
    });
  } catch (error) {
    console.error("Marketplace product lookup failed:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to load product details.",
    });
  }
};

export const listRelatedMarketplaceProducts = async (req, res) => {
  try {
    const sellerSlug = sanitizeMarketplaceText(req.params.sellerSlug).toLowerCase();
    const productSlug = sanitizeMarketplaceText(req.params.productSlug).toLowerCase();
    const limit = parseDiscoveryLimit(req.query.limit || "4");
    const seller = await Seller.findOne(buildVisibleSellerQuery({ storeSlug: sellerSlug }))
      .select("userId country state city")
      .lean();
    if (!seller) return res.status(200).json({ success: true, products: [] });
    const currentProduct = await Product.findOne({
      sellerId: seller.userId,
      slug: productSlug,
      isPublished: true,
      status: "published",
    }).select("category").lean();
    if (!currentProduct) return res.status(200).json({ success: true, products: [] });

    const nearbySellers = await Seller.find(buildVisibleSellerQuery({
      userId: { $ne: seller.userId },
      ...(seller.city ? { city: seller.city } : seller.state ? { state: seller.state } : seller.country ? { country: seller.country } : {}),
    })).select("_id userId businessName storeSlug category description businessAddress country city state area locality pickupAvailable sellerDeliveryAvailable openingHours").lean();
    if (!nearbySellers.length) return res.status(200).json({ success: true, products: [] });

    const nearbyIds = nearbySellers.map((item) => item.userId);
    const baseQuery = { sellerId: { $in: nearbyIds }, isPublished: true, status: "published" };
    const select = "_id sellerId name slug description category price compareAtPrice images createdAt stock";
    let related = await Product.find({ ...baseQuery, category: currentProduct.category })
      .select(select).sort({ createdAt: -1, _id: 1 }).limit(limit).lean();
    if (related.length < limit) {
      const alreadyIncluded = related.map((item) => item._id);
      const more = await Product.find({ ...baseQuery, _id: { $nin: alreadyIncluded } })
        .select(select).sort({ createdAt: -1, _id: 1 }).limit(limit - related.length).lean();
      related = [...related, ...more];
    }
    const sellerMap = getPublicSellerMap(nearbySellers);
    return res.status(200).json({
      success: true,
      products: related.filter((item) => sellerMap.has(String(item.sellerId))).map((item) => ({
        ...serializePublicProduct(item),
        seller: sellerMap.get(String(item.sellerId)),
      })),
    });
  } catch (error) {
    console.error("Related marketplace products failed:", error.message);
    return res.status(500).json({ success: false, message: "Unable to load related products." });
  }
};

export const listMarketplaceLocalities = async (req, res) => {
  try {
    const country = normalizeDiscoveryValue(req.query.country);
    const state = normalizeDiscoveryValue(req.query.state);
    const city = normalizeDiscoveryValue(req.query.city);
    const search = sanitizeMarketplaceText(req.query.search);
    const limit = parseDiscoveryLimit(req.query.limit);
    const page = parseDiscoveryPage(req.query.page);

    const match = {
      isPublished: true,
      status: "active",
      city: { $exists: true, $ne: "", $ne: null },
    };

    if (country) match.country = country;
    if (city) match.city = city;
    if (state) match.state = state;
    if (search) {
      const pattern = new RegExp(escapeRegex(search), "i");
      match.$or = [
        { country: pattern },
        { state: pattern },
        { city: pattern },
        { locality: pattern },
        { area: pattern },
      ];
    }

    const skip = (page - 1) * limit;
    const [result] = await Seller.aggregate([
      { $match: match },
      { $group: { _id: { country: "$country", state: "$state", city: "$city", locality: "$locality", area: "$area" }, shopCount: { $sum: 1 } } },
      { $sort: { "_id.country": 1, "_id.state": 1, "_id.city": 1, "_id.locality": 1, "_id.area": 1 } },
      { $facet: { rows: [{ $skip: skip }, { $limit: limit }], metadata: [{ $count: "total" }] } },
    ]);
    const rows = result?.rows || [];
    const total = Number(result?.metadata?.[0]?.total || 0);

    const data = rows.map((row) => ({
      country: row._id.country || null,
      state: row._id.state || null,
      city: row._id.city || null,
      locality: row._id.locality || null,
      area: row._id.area || null,
      shopCount: Number(row.shopCount ?? row.count ?? 0),
    }));

    return res.status(200).json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    console.error("Marketplace locality listing failed:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to load localities.",
    });
  }
};

export const listMarketplaceCategories = async (req, res) => {
  try {
    const country = normalizeDiscoveryValue(req.query.country);
    const state = normalizeDiscoveryValue(req.query.state);
    const city = normalizeDiscoveryValue(req.query.city);
    const locality = normalizeDiscoveryValue(req.query.locality);
    const area = normalizeDiscoveryValue(req.query.area);

    const sellerMatch = {
      isPublished: true,
      status: "active",
      ...(country ? { country } : {}),
      ...(state ? { state } : {}),
      ...(city ? { city } : {}),
      ...(locality ? { locality } : {}),
      ...(area ? { area } : {}),
    };

    const sellers = await Seller.find(sellerMatch)
      .select("userId")
      .lean();

    const sellerIds = sellers.map((seller) => seller.userId);

    if (!sellerIds.length) {
      return res.status(200).json({ success: true, data: [] });
    }

    const categories = await Product.aggregate([
      { $match: { sellerId: { $in: sellerIds }, isPublished: true, status: "published" } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
    ]);

    return res.status(200).json({
      success: true,
      data: categories.map((entry) => ({
        category: entry._id,
        count: Number(entry.count || 0),
      })),
    });
  } catch (error) {
    console.error("Marketplace category listing failed:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to load categories.",
    });
  }
};

export const listMarketplaceSellers = async (req, res) => {
  try {
    const { page, limit, skip } = normalizePagination(req.query);
    const country = normalizeDiscoveryValue(req.query.country);
    const state = normalizeDiscoveryValue(req.query.state);
    const city = normalizeDiscoveryValue(req.query.city);
    const locality = normalizeDiscoveryValue(req.query.locality);
    const category = normalizeDiscoveryValue(req.query.category);
    const search = sanitizeMarketplaceText(req.query.search);

    const sellerQuery = buildVisibleSellerQuery({
      ...(country ? { country } : {}),
      ...(state ? { state } : {}),
      ...(city ? { city } : {}),
      ...(locality ? { locality } : {}),
    });
    if (category) {
      const matchingProductSellers = await Product.distinct("sellerId", {
        category,
        isPublished: true,
        status: "published",
      });
      const matchingBusinessCategories = await Seller.distinct("userId", {
        ...sellerQuery,
        category,
      });
      const matchingSellerIds = [...new Set([...matchingProductSellers, ...matchingBusinessCategories].map(String))];
      sellerQuery.userId = { $in: matchingSellerIds };
    }
    if (search) {
      const pattern = new RegExp(escapeRegex(search), "i");
      sellerQuery.$or = [{ businessName: pattern }, { description: pattern }];
    }

    const [total, sellers] = await Promise.all([
      Seller.countDocuments(sellerQuery),
      Seller.find(sellerQuery)
      .select("_id businessName storeSlug category description businessAddress isPublished status country city state area locality pickupAvailable sellerDeliveryAvailable openingHours")
        .sort(getSellerSort(req.query.sort))
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    const publicSellers = sellers.map((seller) => ({
      ...serializePublicSeller(seller),
      id: seller._id,
    }));

    return res.status(200).json({
      success: true,
      sellers: publicSellers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    console.error("Marketplace seller listing failed:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to load marketplace sellers.",
    });
  }
};
