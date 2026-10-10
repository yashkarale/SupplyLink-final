import express from 'express';
import {
  getSellerOrders,
  updateSellerOrderStatus,
} from '../controllers/orderController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', protect, getSellerOrders);
router.patch('/:id/status', protect, updateSellerOrderStatus);

export default router;