import express from 'express';
import { auth } from '../middleware/auth.js';
import Puzzle from '../models/Puzzle.js';
import GameSession from '../models/GameSession.js';

const router = express.Router();

// Get random puzzles for a game session (shuffled, excluding previously solved)
router.get('/random', auth, async (req, res) => {
  try {
    const { chapter = 'abandoned-mansion', level = 1 } = req.query;
    const userLevel = parseInt(level) || 1;

    // Get user's solved puzzle IDs from all past sessions
    const pastSessions = await GameSession.find({
      'players.userId': req.userId,
      status: { $in: ['completed', 'failed'] }
    }).select('puzzlesSolved');
    const solvedIds = new Set();
    pastSessions.forEach(s => s.puzzlesSolved.forEach(id => solvedIds.add(id.toString())));

    const rooms = ['foyer', 'library', 'study', 'bedroom', 'basement'];
    const selectedPuzzles = [];

    for (const room of rooms) {
      // Level range: level 1 = easy (1), level 2-3 = medium (1-3), level 4-5 = hard (1-5)
      const maxLevel = Math.min(userLevel, 5);
      const allPuzzles = await Puzzle.find({
        chapterId: chapter,
        roomId: room,
        level: { $lte: maxLevel }
      }).sort({ order: 1 });

      // Prefer unsolved puzzles
      const unsolved = allPuzzles.filter(p => !solvedIds.has(p._id.toString()));
      const pool = unsolved.length >= 3 ? unsolved : allPuzzles;

      // Shuffle and pick 3
      const shuffled = [...pool].sort(() => Math.random() - 0.5);
      const picked = shuffled.slice(0, 3);

      // If not enough, fill from all puzzles (allow repeats with flag)
      while (picked.length < 3 && allPuzzles.length > 0) {
        const extra = allPuzzles[Math.floor(Math.random() * allPuzzles.length)];
        picked.push({ ...extra.toObject(), repeated: true });
      }

      selectedPuzzles.push(...picked);
    }

    // Final shuffle of all selected puzzles
    const finalPuzzles = selectedPuzzles.sort(() => Math.random() - 0.5);

    // Strip answers for client (keep for server validation)
    const safePuzzles = finalPuzzles.map(p => {
      const obj = typeof p.toObject === 'function' ? p.toObject() : { ...p };
      delete obj.answer;
      return obj;
    });

    res.json({ puzzles: safePuzzles, puzzleIds: finalPuzzles.map(p => p._id || p.id), gameLevel: userLevel });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch random puzzles', error: error.message });
  }
});

// Get puzzles for chapter/room (original endpoint)
router.get('/', auth, async (req, res) => {
  try {
    const { chapter, room } = req.query;
    const filter = {};
    if (chapter) filter.chapterId = chapter;
    if (room) filter.roomId = room;

    const puzzles = await Puzzle.find(filter).sort({ order: 1 });
    res.json({ puzzles });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch puzzles' });
  }
});

// Get single puzzle
router.get('/:puzzleId', auth, async (req, res) => {
  try {
    const puzzle = await Puzzle.findById(req.params.puzzleId);
    if (!puzzle) return res.status(404).json({ message: 'Puzzle not found' });
    const { answer, solvedBy, ...safePuzzle } = puzzle.toObject();
    res.json({ puzzle: safePuzzle });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch puzzle' });
  }
});

// Validate answer
router.post('/:puzzleId/validate', auth, async (req, res) => {
  try {
    const { answer } = req.body;
    const puzzle = await Puzzle.findById(req.params.puzzleId);
    if (!puzzle) return res.status(404).json({ message: 'Puzzle not found' });

    const correct = puzzle.answer.toLowerCase() === answer.toLowerCase();
    res.json({ correct, points: correct ? puzzle.points : 0 });
  } catch (error) {
    res.status(500).json({ message: 'Failed to validate answer' });
  }
});

// Get hint
router.get('/:puzzleId/hint/:level', auth, async (req, res) => {
  try {
    const puzzle = await Puzzle.findById(req.params.puzzleId);
    if (!puzzle) return res.status(404).json({ message: 'Puzzle not found' });

    const level = parseInt(req.params.level);
    const hints = { 1: puzzle.hint1, 2: puzzle.hint2, 3: puzzle.hint3 };
    res.json({ hint: hints[level] || puzzle.hint1 });
  } catch (error) {
    res.status(500).json({ message: 'Failed to get hint' });
  }
});

export default router;
