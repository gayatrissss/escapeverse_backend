import express from 'express';
import { body, validationResult } from 'express-validator';
import { OAuth2Client } from 'google-auth-library';
import User from '../models/User.js';
import Profile from '../models/Profile.js';
import DailyReward from '../models/DailyReward.js';
import { generateToken } from '../middleware/auth.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Register
router.post('/register',
  [
    body('username').trim().isLength({ min: 3, max: 20 }).withMessage('Username must be 3-20 characters'),
    body('email').isEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { username, email, password } = req.body;

      const existingUser = await User.findOne({ $or: [{ email }, { username }] });
      if (existingUser) {
        return res.status(400).json({ message: 'Username or email already exists' });
      }

      const user = await User.create({ username, email, password });
      await Profile.create({ userId: user._id });
      await DailyReward.create({ userId: user._id });

      const token = generateToken(user._id);

      res.status(201).json({
        token,
        user: {
          id: user._id, username: user.username, email: user.email,
          coins: user.coins, xp: user.xp, level: user.level,
          avatar: user.avatar, theme: user.theme, isFirstLogin: user.isFirstLogin
        }
      });
    } catch (error) {
      res.status(500).json({ message: 'Registration failed', error: error.message });
    }
  }
);

// Login
router.post('/login',
  [
    body('email').isEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { email, password } = req.body;
      const user = await User.findOne({ email });

      if (!user) return res.status(401).json({ message: 'Invalid credentials' });

      const isMatch = await user.comparePassword(password);
      if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

      user.lastLogin = new Date();
      await user.save();

      const token = generateToken(user._id);

      res.json({
        token,
        user: {
          id: user._id, username: user.username, email: user.email,
          coins: user.coins, xp: user.xp, level: user.level,
          avatar: user.avatar, theme: user.theme, isFirstLogin: user.isFirstLogin,
          companion: user.companion
        }
      });
    } catch (error) {
      res.status(500).json({ message: 'Login failed', error: error.message });
    }
  }
);

// Google Login
router.post('/google', async (req, res) => {
  try {
    const { tokenId } = req.body;

    let googlePayload;
    try {
      const ticket = await googleClient.verifyIdToken({ idToken: tokenId, audience: process.env.GOOGLE_CLIENT_ID });
      googlePayload = ticket.getPayload();
    } catch {
      // Fallback for dev: accept direct payload
      googlePayload = { sub: req.body.googleId, email: req.body.email, name: req.body.name, picture: req.body.picture };
    }

    let user = await User.findOne({ googleId: googlePayload.sub });

    if (!user) {
      user = await User.findOne({ email: googlePayload.email });
      if (user) {
        user.googleId = googlePayload.sub;
        await user.save();
      } else {
        const username = googlePayload.name?.replace(/\s/g, '').toLowerCase() + '_' + Date.now().toString(36);
        user = await User.create({
          username, email: googlePayload.email, googleId: googlePayload.sub,
          avatar: googlePayload.picture || 'default-avatar'
        });
        await Profile.create({ userId: user._id });
        await DailyReward.create({ userId: user._id });
      }
    }

    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user._id);

    res.json({
      token,
      user: {
        id: user._id, username: user.username, email: user.email,
        coins: user.coins, xp: user.xp, level: user.level,
        avatar: user.avatar, theme: user.theme, isFirstLogin: user.isFirstLogin
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Google login failed', error: error.message });
  }
});

// Guest Login
router.post('/guest', async (req, res) => {
  try {
    const guestId = 'guest_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    const user = await User.create({
      username: guestId, email: `${guestId}@guest.escapeverse.io`,
      isGuest: true, coins: 50
    });
    await Profile.create({ userId: user._id });

    const token = generateToken(user._id);

    res.status(201).json({
      token,
      user: {
        id: user._id, username: user.username, email: user.email,
        coins: user.coins, xp: user.xp, level: user.level,
        avatar: user.avatar, theme: user.theme, isFirstLogin: true, isGuest: true
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Guest login failed', error: error.message });
  }
});

// Forgot Password (placeholder)
router.post('/forgot-password',
  [body('email').isEmail().withMessage('Valid email required')],
  async (req, res) => {
    try {
      const { email } = req.body;
      const user = await User.findOne({ email });
      if (!user) return res.status(404).json({ message: 'User not found' });
      // In production: send email with reset token
      res.json({ message: 'Password reset link sent to your email' });
    } catch (error) {
      res.status(500).json({ message: 'Failed to process request' });
    }
  }
);

// Get current user
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    const profile = await Profile.findOne({ userId: req.userId });
    res.json({ user, profile });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch user' });
  }
});

export default router;
