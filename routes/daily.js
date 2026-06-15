import express from 'express';
import { auth } from '../middleware/auth.js';
import DailyReward from '../models/DailyReward.js';
import User from '../models/User.js';

const router = express.Router();

const WHEEL_REWARDS = [
  { type: 'coins', amount: 50, label: '50 Coins', color: '#4c6ef5' },
  { type: 'coins', amount: 100, label: '100 Coins', color: '#39ff14' },
  { type: 'xp', amount: 25, label: '25 XP', color: '#ff00ff' },
  { type: 'coins', amount: 200, label: '200 Coins', color: '#00fff5' },
  { type: 'hint-token', amount: 1, label: 'Hint Token', color: '#fff01f' },
  { type: 'xp', amount: 75, label: '75 XP', color: '#ff6600' },
  { type: 'coins', amount: 500, label: '500 Coins', color: '#ff073a' },
  { type: 'rare-skin', amount: 1, label: 'Rare Skin!', color: '#ffd700' }
];

// Get daily reward status
router.get('/status', auth, async (req, res) => {
  try {
    let daily = await DailyReward.findOne({ userId: req.userId });
    if (!daily) {
      daily = await DailyReward.create({ userId: req.userId });
    }

    const rewards = [
      { day: 1, type: 'coins', amount: 100 },
      { day: 2, type: 'xp', amount: 50 },
      { day: 3, type: 'coins', amount: 200 },
      { day: 4, type: 'badge', amount: 1 },
      { day: 5, type: 'coins', amount: 300 },
      { day: 6, type: 'xp', amount: 150 },
      { day: 7, type: 'coins', amount: 500, bonus: 'rare-avatar' }
    ];

    res.json({
      streak: daily.streak,
      lastClaimed: daily.lastClaimed,
      canClaim: daily.canClaim(),
      claimedRewards: daily.claimedRewards,
      rewards,
      luckyWheelSpins: daily.luckyWheelSpins,
      canSpin: !daily.lastWheelSpin || (new Date() - new Date(daily.lastWheelSpin)) > 24 * 60 * 60 * 1000
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch daily status' });
  }
});

// Claim daily reward
router.post('/claim', auth, async (req, res) => {
  try {
    let daily = await DailyReward.findOne({ userId: req.userId });
    if (!daily) daily = await DailyReward.create({ userId: req.userId });

    if (!daily.canClaim()) return res.status(400).json({ message: 'Already claimed today' });

    daily.claim();
    const reward = [
      { day: 1, type: 'coins', amount: 100 },
      { day: 2, type: 'xp', amount: 50 },
      { day: 3, type: 'coins', amount: 200 },
      { day: 4, type: 'badge', amount: 1 },
      { day: 5, type: 'coins', amount: 300 },
      { day: 6, type: 'xp', amount: 150 },
      { day: 7, type: 'coins', amount: 500, bonus: 'rare-avatar' }
    ].find(r => r.day === daily.streak);

    const user = await User.findById(req.userId);
    if (reward.type === 'coins') await user.addCoins(reward.amount);
    if (reward.type === 'xp') await user.addXP(reward.amount);

    res.json({
      message: `Day ${daily.streak} reward claimed!`,
      reward, streak: daily.streak, coins: user.coins, xp: user.xp
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to claim reward', error: error.message });
  }
});

// Spin lucky wheel
router.post('/wheel/spin', auth, async (req, res) => {
  try {
    let daily = await DailyReward.findOne({ userId: req.userId });
    if (!daily) daily = await DailyReward.create({ userId: req.userId });

    const canSpin = !daily.lastWheelSpin || (new Date() - new Date(daily.lastWheelSpin)) > 24 * 60 * 60 * 1000;
    if (!canSpin) return res.status(400).json({ message: 'Already spun today' });

    const rewardIndex = Math.floor(Math.random() * WHEEL_REWARDS.length);
    const reward = WHEEL_REWARDS[rewardIndex];

    const user = await User.findById(req.userId);
    if (reward.type === 'coins') await user.addCoins(reward.amount);
    if (reward.type === 'xp') await user.addXP(reward.amount);

    daily.luckyWheelSpins += 1;
    daily.lastWheelSpin = new Date();
    await daily.save();

    res.json({
      reward, rewardIndex, spins: daily.luckyWheelSpins,
      coins: user.coins, xp: user.xp,
      message: `You won ${reward.label}!`
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to spin wheel' });
  }
});

// Get wheel segments
router.get('/wheel/segments', auth, async (req, res) => {
  res.json({ segments: WHEEL_REWARDS });
});

export default router;
