import mongoose from 'mongoose';

const puzzleSchema = new mongoose.Schema({
  chapterId: { type: String, required: true },
  roomId: { type: String, required: true },
  name: { type: String, required: true },
  type: {
    type: String, required: true,
    enum: ['memory-match', 'number-lock', 'pattern', 'color', 'hidden-object', 'laser', 'math-logic', 'cipher', 'pressure-plate', 'ai-generated', 'riddle', 'logic', 'math', 'word', 'sequence', 'observation']
  },
  objectName: { type: String },
  description: String,
  question: { type: String },
  answer: { type: String, required: true },
  options: [String],
  hint1: { type: String, default: 'Look around for clues...' },
  hint2: { type: String, default: 'Think about what you have collected...' },
  hint3: { type: String, default: 'The answer is close...' },
  points: { type: Number, default: 100 },
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
  solvedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  timeLimit: { type: Number, default: 120 },
  requiredItems: [String],
  rewards: {
    coins: { type: Number, default: 50 },
    xp: { type: Number, default: 25 },
    item: String
  },
  order: { type: Number, default: 0 },
  level: { type: Number, default: 1, min: 1, max: 5 },
  isOptional: { type: Boolean, default: false }
}, { timestamps: true });

export default mongoose.model('Puzzle', puzzleSchema);
