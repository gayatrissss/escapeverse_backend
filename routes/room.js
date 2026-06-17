import express from 'express';
import mongoose from 'mongoose';
import { auth } from '../middleware/auth.js';
import Room from '../models/Room.js';
import GameSession from '../models/GameSession.js';
import User from '../models/User.js';
import Puzzle from '../models/Puzzle.js';

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

    // Create game session for this room
    const user = await User.findById(req.userId);
    const gameLevel = user?.gameLevel || 1;
    const rooms = ['foyer', 'library', 'study', 'bedroom', 'basement'];
    const selectedPuzzleIds = [];
    for (const rm of rooms) {
      const allPuzzles = await Puzzle.find({
        chapterId: chapter, roomId: rm, level: { $lte: Math.min(gameLevel, 5) }
      }).sort({ order: 1 });
      const shuffled = [...allPuzzles].sort(() => Math.random() - 0.5);
      selectedPuzzleIds.push(...shuffled.slice(0, 3).map(p => p._id));
    }

    const session = await GameSession.create({
      roomId: room._id,
      players: [{ userId: req.userId, username: req.user.username, score: 1000 }],
      chapter,
      mode: settings?.mode || 'normal',
      gameLevel,
      selectedPuzzles: selectedPuzzleIds,
      timer: settings?.timer || 600,
      status: 'active',
      startTime: new Date()
    });

    room.sessionId = session._id;
    room.status = 'playing';
    await room.save();

    res.status(201).json({ room, sessionId: session._id });
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
      // If already in room, that's OK - continue
      if (!addErr.message.includes('Already in room')) {
        return res.status(400).json({ message: addErr.message });
      }
    }

    // Create game session if room doesn't have one
    let sessionId = room.sessionId;
    if (!sessionId) {
      const user = await User.findById(req.userId);
      const gameLevel = user?.gameLevel || 1;

      // Select random puzzles
      const rooms = ['foyer', 'library', 'study', 'bedroom', 'basement'];
      const selectedPuzzleIds = [];
      for (const rm of rooms) {
        const allPuzzles = await Puzzle.find({
          chapterId: room.chapter || 'abandoned-mansion',
          roomId: rm,
          level: { $lte: Math.min(gameLevel, 5) }
        }).sort({ order: 1 });
        const shuffled = [...allPuzzles].sort(() => Math.random() - 0.5);
        selectedPuzzleIds.push(...shuffled.slice(0, 3).map(p => p._id));
      }

      const session = await GameSession.create({
        roomId: room._id,
        players: room.players.map(p => ({
          userId: p.userId, username: p.username, score: 1000
        })),
        chapter: room.chapter || 'abandoned-mansion',
        mode: room.settings?.mode || 'normal',
        gameLevel,
        selectedPuzzles: selectedPuzzleIds,
        timer: room.settings?.timer || 600,
        status: 'active',
        startTime: new Date()
      });

      sessionId = session._id;
      room.sessionId = sessionId;
      room.status = 'playing';
      await room.save();
    }

    const updated = await Room.findById(req.params.roomId)
      .populate('players.userId', 'username avatar level');
    res.json({ room: updated, sessionId, message: 'Joined room' });
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
