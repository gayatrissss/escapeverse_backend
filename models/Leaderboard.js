import mongoose from 'mongoose';

const leaderboardSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  username: { type: String, required: true },
  score: { type: Number, required: true },
  chapter: { type: String, required: true },
  mode: { type: String, enum: ['normal', 'practice', 'ranked', 'speedrun'], default: 'normal' },
  time: { type: Number },
  hintsUsed: { type: Number, default: 0 },
  puzzlesSolved: { type: Number, default: 0 },
  season: { type: String, default: 'all-time' },
  country: String,
  rank: Number,
  date: { type: Date, default: Date.now }
}, { timestamps: true });

leaderboardSchema.index({ chapter: 1, mode: 1, score: -1 });
leaderboardSchema.index({ season: 1, score: -1 });

export default mongoose.model('Leaderboard', leaderboardSchema);
