import express, { Router } from "express";
import {
  createProduct,
  getProduct,
  listProducts,
  listInventoryMovements,
  updateInventory,
  updateProduct,
  uploadProductImage,
} from "../controllers/productController.js";
import { protect } from "../middleware/authMiddleware.js";
import { requireSellerAccess } from "../middleware/roleMiddleware.js";

const router = Router();

router.get("/", protect, requireSellerAccess, listProducts);
router.get("/inventory/movements", protect, requireSellerAccess, listInventoryMovements);
router.post("/", protect, requireSellerAccess, createProduct);
router.get("/:id", protect, requireSellerAccess, getProduct);
router.put("/:id", protect, requireSellerAccess, updateProduct);
router.patch("/:id/stock", protect, requireSellerAccess, updateInventory);
router.post("/:id/images", protect, requireSellerAccess, express.raw({ type: ["image/png", "image/jpeg"], limit: "4mb" }), uploadProductImage);

export default router;
