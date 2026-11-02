import { Router } from "express";
import {
  getMarketplaceProduct,
  listMarketplaceCategories,
  listMarketplaceLocalities,
  listPopularMarketplaceProducts,
  listMarketplaceProducts,
  listRelatedMarketplaceProducts,
  listMarketplaceSellers,
} from "../controllers/marketplaceController.js";

const router = Router();

router.get("/products", listMarketplaceProducts);
router.get("/products/popular", listPopularMarketplaceProducts);
router.get("/products/:sellerSlug/:productSlug/related", listRelatedMarketplaceProducts);
router.get("/product/:slug", getMarketplaceProduct);
router.get("/product/:sellerSlug/:productSlug", getMarketplaceProduct);
router.get("/products/:slug", getMarketplaceProduct);
router.get("/products/:sellerSlug/:productSlug", getMarketplaceProduct);
router.get("/sellers", listMarketplaceSellers);
router.get("/localities", listMarketplaceLocalities);
router.get("/categories", listMarketplaceCategories);

export default router;
