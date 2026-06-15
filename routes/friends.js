import express from 'express';
import { auth } from '../middleware/auth.js';
import FriendRequest from '../models/FriendRequest.js';
import User from '../models/User.js';

const router = express.Router();

// Send friend request
router.post('/request', auth, async (req, res) => {
  try {
    const { username } = req.body;
    const targetUser = await User.findOne({ username });
    if (!targetUser) return res.status(404).json({ message: 'User not found' });
    if (targetUser._id.toString() === req.userId.toString()) return res.status(400).json({ message: 'Cannot add yourself' });

    const existing = await FriendRequest.findOne({
      $or: [
        { from: req.userId, to: targetUser._id },
        { from: targetUser._id, to: req.userId }
      ]
    });
    if (existing) return res.status(400).json({ message: 'Request already exists' });

    const request = await FriendRequest.create({ from: req.userId, to: targetUser._id });
    res.status(201).json({ request, message: 'Friend request sent' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to send request' });
  }
});

// Accept/reject friend request
router.put('/request/:requestId', auth, async (req, res) => {
  try {
    const { status } = req.body;
    const request = await FriendRequest.findOne({ _id: req.params.requestId, to: req.userId });
    if (!request) return res.status(404).json({ message: 'Request not found' });

    request.status = status;
    await request.save();
    res.json({ message: `Request ${status}` });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update request' });
  }
});

// Get friends list
router.get('/list', auth, async (req, res) => {
  try {
    const requests = await FriendRequest.find({
      $or: [
        { from: req.userId, status: 'accepted' },
        { to: req.userId, status: 'accepted' }
      ]
    });

    const friendIds = requests.map(r =>
      r.from.toString() === req.userId.toString() ? r.to : r.from
    );

    const friends = await User.find({ _id: { $in: friendIds } })
      .select('username avatar level lastLogin');

    res.json({ friends });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch friends' });
  }
});

// Get pending requests
router.get('/pending', auth, async (req, res) => {
  try {
    const incoming = await FriendRequest.find({ to: req.userId, status: 'pending' })
      .populate('from', 'username avatar level');
    const outgoing = await FriendRequest.find({ from: req.userId, status: 'pending' })
      .populate('to', 'username avatar level');
    res.json({ incoming, outgoing });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch pending requests' });
  }
});

// Remove friend
router.delete('/:friendId', auth, async (req, res) => {
  try {
    await FriendRequest.findOneAndDelete({
      $or: [
        { from: req.userId, to: req.params.friendId },
        { from: req.params.friendId, to: req.userId }
      ]
    });
    res.json({ message: 'Friend removed' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to remove friend' });
  }
});

// Search users
router.get('/search', auth, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json({ users: [] });
    const users = await User.find({
      username: { $regex: q, $options: 'i' },
      _id: { $ne: req.userId }
    }).select('username avatar level').limit(10);
    res.json({ users });
  } catch (error) {
    res.status(500).json({ message: 'Search failed' });
  }
});

export default router;
