import express from 'express';
import { auth } from '../middleware/auth.js';
import Leaderboard from '../models/Leaderboard.js';
import FriendRequest from '../models/FriendRequest.js';

const router = express.Router();

// Get leaderboard
router.get('/', auth, async (req, res) => {
  try {
    const { chapter, mode, season, period, limit = 50 } = req.query;
    const filter = {};
    if (chapter) filter.chapter = chapter;
    if (mode) filter.mode = mode;
    if (season) filter.season = season;

    if (period === 'weekly') {
      const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
      filter.date = { $gte: weekAgo };
    } else if (period === 'monthly') {
      const monthAgo = new Date(); monthAgo.setMonth(monthAgo.getMonth() - 1);
      filter.date = { $gte: monthAgo };
    }

    const entries = await Leaderboard.find(filter)
      .sort({ score: -1 })
      .limit(parseInt(limit))
      .populate('userId', 'username avatar level');

    entries.forEach((entry, i) => { entry.rank = i + 1; });
    res.json({ leaderboard: entries });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch leaderboard' });
  }
});

// Get friends leaderboard
router.get('/friends', auth, async (req, res) => {
  try {
    const friends = await FriendRequest.find({
      $or: [
        { from: req.userId, status: 'accepted' },
        { to: req.userId, status: 'accepted' }
      ]
    });

    const friendIds = friends.map(f =>
      f.from.toString() === req.userId.toString() ? f.to : f.from
    );
    friendIds.push(req.userId);

    const entries = await Leaderboard.find({ userId: { $in: friendIds } })
      .sort({ score: -1 }).limit(20)
      .populate('userId', 'username avatar level');

    entries.forEach((entry, i) => { entry.rank = i + 1; });
    res.json({ leaderboard: entries });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch friends leaderboard' });
  }
});

// Get player rank
router.get('/rank/:userId', auth, async (req, res) => {
  try {
    const { chapter, mode } = req.query;
    const filter = { userId: req.params.userId };
    if (chapter) filter.chapter = chapter;
    if (mode) filter.mode = mode;

    const bestScore = await Leaderboard.findOne(filter).sort({ score: -1 });
    if (!bestScore) return res.json({ rank: null, bestScore: null });

    const higherCount = await Leaderboard.countDocuments({
      ...(chapter && { chapter }), ...(mode && { mode }),
      score: { $gt: bestScore.score }
    });

    res.json({ rank: higherCount + 1, bestScore: bestScore.score });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch rank' });
  }
});

export default router;
