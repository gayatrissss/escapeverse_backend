import express from 'express';
import { auth } from '../middleware/auth.js';
import User from '../models/User.js';
import Profile from '../models/Profile.js';

const router = express.Router();

// Get profile
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    const profile = await Profile.findOne({ userId: req.userId });
    res.json({ user, profile });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch profile' });
  }
});

// Get user by id
router.get('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password -companionMemory');
    const profile = await Profile.findOne({ userId: req.params.id });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user, profile });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch user' });
  }
});

// Update profile settings
router.put('/settings', auth, async (req, res) => {
  try {
    const { theme, avatar, companion, settings } = req.body;
    const update = {};
    if (theme) update.theme = theme;
    if (avatar) update.avatar = avatar;
    if (companion) update.companion = companion;
    if (settings) update.settings = { ...req.user.settings, ...settings };

    const user = await User.findByIdAndUpdate(req.userId, update, { new: true }).select('-password');
    res.json({ user });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update settings' });
  }
});

// Complete onboarding
router.post('/complete-onboarding', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    user.isFirstLogin = false;
    user.coins += 500;
    user.companionMemory.playerName = user.username;
    await user.save();
    res.json({ message: 'Onboarding complete! +500 coins', coins: user.coins });
  } catch (error) {
    res.status(500).json({ message: 'Failed to complete onboarding' });
  }
});

// Get companion memory
router.get('/companion/memory', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('companionMemory username');
    res.json({ companionMemory: user.companionMemory, username: user.username });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch companion memory' });
  }
});

// Update companion memory
router.put('/companion/memory', auth, async (req, res) => {
  try {
    const { favoritePuzzle, message } = req.body;
    const user = await User.findById(req.userId);
    if (favoritePuzzle) user.companionMemory.favoritePuzzle = favoritePuzzle;
    if (message) {
      user.companionMemory.messages.push({ message, timestamp: new Date() });
      if (user.companionMemory.messages.length > 50) {
        user.companionMemory.messages = user.companionMemory.messages.slice(-50);
      }
    }
    user.companionMemory.lastGreeting = new Date();
    await user.save();
    res.json({ companionMemory: user.companionMemory });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update companion memory' });
  }
});

export default router;
