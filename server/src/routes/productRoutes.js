import { Router } from "express";
import {
  createProduct,
  getProduct,
  listProducts,
  updateInventory,
  updateProduct,
} from "../controllers/productController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = Router();

router.get("/", protect, listProducts);
router.post("/", protect, createProduct);
router.get("/:id", protect, getProduct);
router.put("/:id", protect, updateProduct);
router.patch("/:id/stock", protect, updateInventory);

export default router;
