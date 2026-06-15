import express from 'express';
import { auth } from '../middleware/auth.js';
import ChatMessage from '../models/ChatMessage.js';

const router = express.Router();

// Get messages for room
router.get('/:roomId', auth, async (req, res) => {
  try {
    const { limit = 50, before } = req.query;
    const filter = { roomId: req.params.roomId };
    if (before) filter.timestamp = { $lt: new Date(before) };

    const messages = await ChatMessage.find(filter)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .populate('userId', 'username avatar');

    res.json({ messages: messages.reverse() });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch messages' });
  }
});

// Send message (REST fallback)
router.post('/:roomId', auth, async (req, res) => {
  try {
    const { message, type = 'text' } = req.body;
    if (!message || message.length > 500) return res.status(400).json({ message: 'Invalid message' });

    const chatMessage = await ChatMessage.create({
      roomId: req.params.roomId,
      userId: req.userId, username: req.user.username,
      message, type
    });

    const populated = await ChatMessage.findById(chatMessage._id)
      .populate('userId', 'username avatar');
    res.status(201).json({ message: populated });
  } catch (error) {
    res.status(500).json({ message: 'Failed to send message' });
  }
});

export default router;
