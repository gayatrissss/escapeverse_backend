import express from 'express';
import { auth } from '../middleware/auth.js';
import InventoryItem from '../models/InventoryItem.js';

const router = express.Router();

// Get inventory for session
router.get('/session/:sessionId', auth, async (req, res) => {
  try {
    const items = await InventoryItem.find({ userId: req.userId, sessionId: req.params.sessionId });
    res.json({ items });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch inventory' });
  }
});

// Use item
router.post('/:itemId/use', auth, async (req, res) => {
  try {
    const { target } = req.body;
    const item = await InventoryItem.findOne({ _id: req.params.itemId, userId: req.userId });
    if (!item) return res.status(404).json({ message: 'Item not found' });
    if (item.used) return res.status(400).json({ message: 'Item already used' });

    item.used = true;
    item.usedOn = target;
    await item.save();
    res.json({ item, message: `Used ${item.name} on ${target}` });
  } catch (error) {
    res.status(500).json({ message: 'Failed to use item' });
  }
});

// Combine items
router.post('/combine', auth, async (req, res) => {
  try {
    const { item1Id, item2Id } = req.body;
    const item1 = await InventoryItem.findOne({ _id: item1Id, userId: req.userId });
    const item2 = await InventoryItem.findOne({ _id: item2Id, userId: req.userId });

    if (!item1 || !item2) return res.status(404).json({ message: 'Item not found' });
    if (!item1.combinable || !item2.combinable) return res.status(400).json({ message: 'Items cannot be combined' });

    if (!item1.combineWith.includes(item2.name) && !item2.combineWith.includes(item1.name)) {
      return res.status(400).json({ message: 'These items cannot be combined' });
    }

    const combined = await InventoryItem.create({
      userId: req.userId, sessionId: item1.sessionId,
      name: `${item1.name} + ${item2.name}`,
      description: `Combined from ${item1.name} and ${item2.name}`,
      type: 'special'
    });

    await InventoryItem.deleteMany({ _id: { $in: [item1Id, item2Id] } });
    res.json({ item: combined, message: 'Items combined!' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to combine items' });
  }
});

// Drop item
router.delete('/:itemId', auth, async (req, res) => {
  try {
    const item = await InventoryItem.findOneAndDelete({ _id: req.params.itemId, userId: req.userId });
    if (!item) return res.status(404).json({ message: 'Item not found' });
    res.json({ message: `Dropped ${item.name}` });
  } catch (error) {
    res.status(500).json({ message: 'Failed to drop item' });
  }
});

export default router;
