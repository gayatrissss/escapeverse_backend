import express from 'express';
import { auth } from '../middleware/auth.js';
import GameSession from '../models/GameSession.js';
import Room from '../models/Room.js';
import Puzzle from '../models/Puzzle.js';
import User from '../models/User.js';
import Profile from '../models/Profile.js';
import Leaderboard from '../models/Leaderboard.js';
import InventoryItem from '../models/InventoryItem.js';

const router = express.Router();

// Start a new game session
router.post('/start', auth, async (req, res) => {
  try {
    const { chapter = 'abandoned-mansion', mode = 'normal', roomId, level } = req.body;

    // Determine game level
    const user = await User.findById(req.userId);
    const gameLevel = level || user.gameLevel || 1;

    // Select random puzzles for this session
    const rooms = ['foyer', 'library', 'study', 'bedroom', 'basement'];
    const selectedPuzzleIds = [];

    // Get user's solved puzzle IDs
    const pastSessions = await GameSession.find({
      'players.userId': req.userId,
      status: { $in: ['completed', 'failed'] }
    }).select('puzzlesSolved');
    const solvedIds = new Set();
    pastSessions.forEach(s => s.puzzlesSolved.forEach(id => solvedIds.add(id.toString())));

    for (const room of rooms) {
      const maxLevel = Math.min(gameLevel, 5);
      const allPuzzles = await Puzzle.find({
        chapterId: chapter, roomId: room, level: { $lte: maxLevel }
      }).sort({ order: 1 });

      const unsolved = allPuzzles.filter(p => !solvedIds.has(p._id.toString()));
      const pool = unsolved.length >= 3 ? unsolved : allPuzzles;
      const shuffled = [...pool].sort(() => Math.random() - 0.5);
      const picked = shuffled.slice(0, 3);

      while (picked.length < 3 && allPuzzles.length > 0) {
        picked.push(allPuzzles[Math.floor(Math.random() * allPuzzles.length)]);
      }

      selectedPuzzleIds.push(...picked.map(p => p._id));
    }

    const timerMap = { normal: 600, ranked: 480, speedrun: 480, practice: 99999 };
    const session = await GameSession.create({
      roomId: roomId || null,
      players: [{ userId: req.userId, username: req.user.username, score: 1000 }],
      chapter, mode,
      gameLevel,
      selectedPuzzles: selectedPuzzleIds,
      timer: timerMap[mode] || 600,
      status: 'active',
      startTime: new Date()
    });

    res.status(201).json({ session, gameLevel });
  } catch (error) {
    res.status(500).json({ message: 'Failed to start game', error: error.message });
  }
});

// Get game session
router.get('/:sessionId', auth, async (req, res) => {
  try {
    const session = await GameSession.findById(req.params.sessionId)
      .populate('puzzlesSolved')
      .populate('collectedItems');
    if (!session) return res.status(404).json({ message: 'Session not found' });
    res.json({ session });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch session' });
  }
});

// Collect item
router.post('/:sessionId/collect', auth, async (req, res) => {
  try {
    const { itemId, itemName, itemType, description } = req.body;
    const session = await GameSession.findById(req.params.sessionId);
    if (!session || session.status !== 'active') return res.status(400).json({ message: 'Invalid session' });

    const item = await InventoryItem.create({
      userId: req.userId, sessionId: session._id,
      name: itemName, type: itemType, description
    });

    session.collectedItems.push(item._id);
    await session.save();

    res.json({ item, message: `Collected: ${itemName}` });
  } catch (error) {
    res.status(500).json({ message: 'Failed to collect item' });
  }
});

// Use hint
router.post('/:sessionId/hint', auth, async (req, res) => {
  try {
    const { puzzleId, hintLevel } = req.body;
    const session = await GameSession.findById(req.params.sessionId);
    if (!session || session.status !== 'active') return res.status(400).json({ message: 'Invalid session' });

    if (session.mode === 'practice') {
      const puzzle = await Puzzle.findById(puzzleId);
      const hints = [puzzle.hint1, puzzle.hint2, puzzle.hint3];
      return res.json({ hint: hints[Math.min(hintLevel - 1, 2)] });
    }

    session.hintsUsed += 1;
    await session.deductScore(50);

    const puzzle = await Puzzle.findById(puzzleId);
    const hints = [puzzle.hint1, puzzle.hint2, puzzle.hint3];
    const hint = hints[Math.min(hintLevel - 1, 2)];

    res.json({ hint, score: session.score, hintsUsed: session.hintsUsed });
  } catch (error) {
    res.status(500).json({ message: 'Failed to use hint' });
  }
});

// Solve puzzle
router.post('/:sessionId/solve', auth, async (req, res) => {
  try {
    const { puzzleId, answer } = req.body;
    const session = await GameSession.findById(req.params.sessionId);
    if (!session || session.status !== 'active') return res.status(400).json({ message: 'Invalid session' });

    const puzzle = await Puzzle.findById(puzzleId);
    if (!puzzle) return res.status(404).json({ message: 'Puzzle not found' });

    if (puzzle.answer.toLowerCase() !== answer.toLowerCase()) {
      await session.deductScore(20);
      return res.json({ correct: false, message: 'Wrong answer! -20 points', score: session.score });
    }

    if (!session.puzzlesSolved.includes(puzzleId)) {
      session.puzzlesSolved.push(puzzleId);
      puzzle.solvedBy.push(req.userId);
      await puzzle.save();

      const user = await User.findById(req.userId);
      await user.addCoins(puzzle.rewards.coins);
      await user.addXP(puzzle.rewards.xp);

      const profile = await Profile.findOne({ userId: req.userId });
      if (profile) {
        profile.totalPuzzlesSolved += 1;
        await profile.save();
      }
    }

    await session.save();
    res.json({
      correct: true, message: 'Puzzle solved!',
      score: session.score, coins: puzzle.rewards.coins, xp: puzzle.rewards.xp
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to solve puzzle' });
  }
});

// End game session
router.post('/:sessionId/end', auth, async (req, res) => {
  try {
    const { won } = req.body;
    const session = await GameSession.findById(req.params.sessionId);
    if (!session) return res.status(404).json({ message: 'Session not found' });

    session.status = won ? 'completed' : 'failed';
    session.endTime = new Date();
    session.timerActive = false;

    if (won) {
      const timeElapsed = Math.floor((session.endTime - session.startTime) / 1000);
      const timeBonus = Math.max(0, (session.timer - timeElapsed)) * 2;
      const perfectBonus = session.hintsUsed === 0 ? 200 : 0;
      session.score += timeBonus + perfectBonus;

      const user = await User.findById(req.userId);
      const coinsEarned = Math.floor(session.score / 10);
      const xpEarned = Math.floor(session.score / 5);
      await user.addCoins(coinsEarned);
      await user.addXP(xpEarned);

      // Auto level-up on win
      let leveledUp = false;
      const oldLevel = user.gameLevel || 1;
      if (oldLevel < 5) {
        user.gameLevel = oldLevel + 1;
        leveledUp = true;
        await user.save();
      }

      const profile = await Profile.findOne({ userId: req.userId });
      if (profile) await profile.updateStats(true, timeElapsed, session.score);

      await Leaderboard.create({
        userId: req.userId, username: req.user.username,
        score: session.score, chapter: session.chapter, mode: session.mode,
        time: timeElapsed, hintsUsed: session.hintsUsed,
        puzzlesSolved: session.puzzlesSolved.length
      });

      await session.save();
      return res.json({
        won: true, score: session.score, coinsEarned, xpEarned,
        timeBonus, perfectBonus, time: timeElapsed,
        leveledUp, oldLevel, newLevel: user.gameLevel
      });
    }

    const profile = await Profile.findOne({ userId: req.userId });
    if (profile) await profile.updateStats(false, 0, session.score);

    await session.save();
    res.json({ won: false, score: session.score, message: 'Time is up!' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to end game', error: error.message });
  }
});

// Get active sessions
router.get('/active/list', auth, async (req, res) => {
  try {
    const sessions = await GameSession.find({
      players: { $elemMatch: { userId: req.userId } },
      status: { $in: ['active', 'waiting'] }
    }).sort({ createdAt: -1 }).limit(10);
    res.json({ sessions });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch sessions' });
  }
});

export default router;
