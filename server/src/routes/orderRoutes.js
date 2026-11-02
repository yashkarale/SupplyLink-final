import express from 'express';
import {
  getSellerOrders,
  getSellerPaymentProof,
  confirmSellerManualPayment,
  trackPublicOrder,
  updateSellerOrderStatus,
  createOfflinePosSale,
  getSellerPosSales,
} from '../controllers/orderController.js';
import { protect } from '../middleware/authMiddleware.js';
import { requireSellerAccess } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.get('/', protect, requireSellerAccess, getSellerOrders);
router.get('/pos', protect, requireSellerAccess, getSellerPosSales);
router.post('/pos', protect, requireSellerAccess, createOfflinePosSale);
router.get('/track/:token', trackPublicOrder);
router.get('/:id/payment-proof', protect, requireSellerAccess, getSellerPaymentProof);
router.post('/:id/confirm-payment', protect, requireSellerAccess, confirmSellerManualPayment);
router.patch('/:id/status', protect, requireSellerAccess, updateSellerOrderStatus);

export default router;
