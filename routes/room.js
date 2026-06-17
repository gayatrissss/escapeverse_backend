import express from 'express';
import mongoose from 'mongoose';
import { auth } from '../middleware/auth.js';
import Room from '../models/Room.js';

const router = express.Router();

// Create room
router.post('/create', auth, async (req, res) => {
  try {
    const { name, type = 'public', chapter = 'abandoned-mansion', maxPlayers = 4, settings, password } = req.body;
    const room = await Room.create({
      name, type, chapter, maxPlayers, password,
      host: req.userId,
      players: [{ userId: req.userId, username: req.user.username, ready: false }],
      settings: { ...{ mode: 'normal', difficulty: 'medium', timer: 600 }, ...settings }
    });
    res.status(201).json({ room });
  } catch (error) {
    res.status(500).json({ message: 'Failed to create room', error: error.message });
  }
});

// Get public rooms
router.get('/public', auth, async (req, res) => {
  try {
    const { chapter, mode } = req.query;
    const filter = { type: 'public', status: { $in: ['waiting', 'ready'] } };
    if (chapter) filter.chapter = chapter;
    if (mode) filter['settings.mode'] = mode;

    const rooms = await Room.find(filter)
      .populate('host', 'username avatar')
      .sort({ createdAt: -1 }).limit(20);
    res.json({ rooms });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch rooms' });
  }
});

// Get room by id
router.get('/:roomId', auth, async (req, res) => {
  try {
    const room = await Room.findById(req.params.roomId)
      .populate('host', 'username avatar')
      .populate('players.userId', 'username avatar level');
    if (!room) return res.status(404).json({ message: 'Room not found' });
    res.json({ room });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch room' });
  }
});

// Join room
router.post('/:roomId/join', auth, async (req, res) => {
  try {
    // Check MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: 'Database unavailable', dbState: mongoose.connection.readyState });
    }

    const room = await Room.findById(req.params.roomId);
    if (!room) return res.status(404).json({ message: 'Room not found' });
    if (room.type === 'private' && room.password !== req.body.password) {
      return res.status(403).json({ message: 'Incorrect password' });
    }
    try {
      await room.addPlayer(req.userId, req.user?.username || 'Anonymous');
    } catch (addErr) {
      return res.status(400).json({ message: addErr.message });
    }
    const updated = await Room.findById(req.params.roomId)
      .populate('players.userId', 'username avatar level');
    res.json({ room: updated, message: 'Joined room' });
  } catch (error) {
    console.error('Room join error:', error.message, error.stack);
    res.status(500).json({ message: error.message });
  }
});

// Leave room
router.post('/:roomId/leave', auth, async (req, res) => {
  try {
    const room = await Room.findById(req.params.roomId);
    if (!room) return res.status(404).json({ message: 'Room not found' });
    await room.removePlayer(req.userId);
    if (room.host.toString() === req.userId.toString() && room.players.length > 0) {
      room.host = room.players[0].userId;
      await room.save();
    }
    res.json({ message: 'Left room' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to leave room' });
  }
});

// Ready check
router.post('/:roomId/ready', auth, async (req, res) => {
  try {
    const room = await Room.findById(req.params.roomId);
    if (!room) return res.status(404).json({ message: 'Room not found' });
    const player = room.players.find(p => p.userId.toString() === req.userId.toString());
    if (!player) return res.status(400).json({ message: 'Not in room' });
    player.ready = !player.ready;
    await room.save();
    const allReady = room.allReady();
    if (allReady) room.status = 'ready';
    await room.save();
    res.json({ room, allReady });
  } catch (error) {
    res.status(500).json({ message: 'Failed to toggle ready' });
  }
});

// Delete room
router.delete('/:roomId', auth, async (req, res) => {
  try {
    const room = await Room.findById(req.params.roomId);
    if (!room) return res.status(404).json({ message: 'Room not found' });
    if (room.host.toString() !== req.userId.toString()) return res.status(403).json({ message: 'Only host can delete' });
    await Room.findByIdAndDelete(req.params.roomId);
    res.json({ message: 'Room deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete room' });
  }
});

export default router;
