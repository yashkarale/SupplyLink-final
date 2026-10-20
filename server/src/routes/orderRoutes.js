import express from 'express';
import {
  getSellerOrders,
  getSellerPaymentProof,
  confirmSellerManualPayment,
  trackPublicOrder,
  updateSellerOrderStatus,
} from '../controllers/orderController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', protect, getSellerOrders);
router.get('/track/:token', trackPublicOrder);
router.get('/:id/payment-proof', protect, getSellerPaymentProof);
router.post('/:id/confirm-payment', protect, confirmSellerManualPayment);
router.patch('/:id/status', protect, updateSellerOrderStatus);

export default router;
