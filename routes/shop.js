import express from 'express';
import { auth } from '../middleware/auth.js';
import StoreItem from '../models/StoreItem.js';
import PurchaseHistory from '../models/PurchaseHistory.js';
import User from '../models/User.js';

const router = express.Router();

// Get store items
router.get('/items', auth, async (req, res) => {
  try {
    const { category, rarity } = req.query;
    const filter = { active: true };
    if (category) filter.category = category;
    if (rarity) filter.rarity = rarity;

    const items = await StoreItem.find(filter).sort({ price: 1 });
    res.json({ items });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch store items' });
  }
});

// Get categories
router.get('/categories', auth, async (req, res) => {
  try {
    const categories = await StoreItem.distinct('category');
    res.json({ categories });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch categories' });
  }
});

// Purchase item
router.post('/purchase/:itemId', auth, async (req, res) => {
  try {
    const item = await StoreItem.findById(req.params.itemId);
    if (!item) return res.status(404).json({ message: 'Item not found' });

    const user = await User.findById(req.userId);
    if (user.coins < item.price) return res.status(400).json({ message: 'Not enough coins' });

    const existing = await PurchaseHistory.findOne({ userId: req.userId, itemId: item._id });
    if (existing) return res.status(400).json({ message: 'Already owned' });

    if (user.level < item.requiredLevel) {
      return res.status(400).json({ message: `Requires level ${item.requiredLevel}` });
    }

    user.coins -= item.price;
    await user.save();

    await PurchaseHistory.create({
      userId: req.userId, itemId: item._id, itemName: item.name,
      price: item.price, currency: item.currency
    });

    item.stats.salesCount += 1;
    await item.save();

    res.json({ message: `Purchased ${item.name}!`, coins: user.coins });
  } catch (error) {
    res.status(500).json({ message: 'Purchase failed', error: error.message });
  }
});

// Get purchase history
router.get('/history', auth, async (req, res) => {
  try {
    const purchases = await PurchaseHistory.find({ userId: req.userId })
      .populate('itemId').sort({ date: -1 });
    res.json({ purchases });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch purchase history' });
  }
});

// Get owned item ids
router.get('/owned', auth, async (req, res) => {
  try {
    const purchases = await PurchaseHistory.find({ userId: req.userId }).select('itemId');
    const ownedIds = purchases.map(p => p.itemId.toString());
    res.json({ ownedIds });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch owned items' });
  }
});

export default router;
