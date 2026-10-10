import express from 'express';
import Seller from '../models/Seller.js';
import Product from '../models/Product.js';
import { createPublicOrder } from '../controllers/orderController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/products', protect, async (req, res) => {
  try {
    const product = await Product.create({
      ...req.body,
      sellerId: req.user.userId
    });
    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/products', protect, async (req, res) => {
  try {
    const products = await Product.find({ sellerId: req.user.userId });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/:slug/orders', createPublicOrder);

router.get('/:slug', async (req, res) => {
  try {
    const seller = await Seller.findOne({ storeSlug: req.params.slug });
    if (!seller) {
      return res.status(404).json({ message: 'Store not found' });
    }
    const products = await Product.find({ sellerId: seller.userId, isPublished: true });
    res.json({ seller, products });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;