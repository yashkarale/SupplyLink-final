import express from 'express';
import {
  getSellerOrders,
  trackPublicOrder,
  updateSellerOrderStatus,
} from '../controllers/orderController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', protect, getSellerOrders);
router.get('/track/:token', trackPublicOrder);
router.patch('/:id/status', protect, updateSellerOrderStatus);

export default router;
