import express from 'express';
import { auth } from '../middleware/auth.js';
import Achievement from '../models/Achievement.js';
import Profile from '../models/Profile.js';

const router = express.Router();

const ACHIEVEMENT_DEFS = [
  { type: 'first-escape', name: 'First Escape', description: 'Complete your first escape room', rarity: 'common', maxProgress: 1 },
  { type: 'puzzle-master', name: 'Puzzle Master', description: 'Solve 50 puzzles', rarity: 'rare', maxProgress: 50 },
  { type: 'no-hint', name: 'No Hints', description: 'Complete a room without hints', rarity: 'rare', maxProgress: 1 },
  { type: 'perfect-escape', name: 'Perfect Escape', description: 'Score 1000+ in a room', rarity: 'epic', maxProgress: 1 },
  { type: 'collector', name: 'Collector', description: 'Collect 100 items', rarity: 'rare', maxProgress: 100 },
  { type: 'speed-runner', name: 'Speed Runner', description: 'Complete a room in under 3 minutes', rarity: 'epic', maxProgress: 1 },
  { type: 'legend', name: 'Legend', description: 'Reach level 50', rarity: 'legendary', maxProgress: 50 },
  { type: 'hidden-explorer', name: 'Hidden Explorer', description: 'Find all hidden objects', rarity: 'rare', maxProgress: 10 },
  { type: 'social-butterfly', name: 'Social Butterfly', description: 'Add 10 friends', rarity: 'common', maxProgress: 10 },
  { type: 'daily-warrior', name: 'Daily Warrior', description: 'Claim 30 daily rewards', rarity: 'epic', maxProgress: 30 },
  { type: 'shopaholic', name: 'Shopaholic', description: 'Buy 20 items from shop', rarity: 'rare', maxProgress: 20 },
  { type: 'lucky-star', name: 'Lucky Star', description: 'Win a rare item from lucky wheel', rarity: 'rare', maxProgress: 1 },
  { type: 'friend-maker', name: 'Friend Maker', description: 'Play 10 multiplayer games', rarity: 'common', maxProgress: 10 }
];

// Get all achievements with user progress
router.get('/', auth, async (req, res) => {
  try {
    const userAchievements = await Achievement.find({ userId: req.userId });
    const all = ACHIEVEMENT_DEFS.map(def => {
      const unlocked = userAchievements.find(a => a.type === def.type);
      return { ...def, unlocked: !!unlocked, progress: unlocked?.progress || 0, unlockedAt: unlocked?.unlockedAt };
    });
    res.json({ achievements: all });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch achievements' });
  }
});

// Check and unlock achievements
router.post('/check', auth, async (req, res) => {
  try {
    const profile = await Profile.findOne({ userId: req.userId });
    const newAchievements = [];

    if (profile && profile.gamesWon >= 1) {
      const a = await Achievement.findOneAndUpdate(
        { userId: req.userId, type: 'first-escape' },
        { $setOnInsert: { userId: req.userId, type: 'first-escape', name: 'First Escape', description: 'Complete your first escape room', rarity: 'common', progress: 1, maxProgress: 1 } },
        { upsert: true, new: true }
      );
      if (a.progress === 1 && !a._wasNew === undefined) newAchievements.push(a);
    }

    res.json({ newAchievements });
  } catch (error) {
    res.status(500).json({ message: 'Failed to check achievements' });
  }
});

// Get definitions
router.get('/definitions', auth, async (req, res) => {
  res.json({ definitions: ACHIEVEMENT_DEFS });
});

export default router;
