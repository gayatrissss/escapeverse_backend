import mongoose from 'mongoose';

const profileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  gamesPlayed: { type: Number, default: 0 },
  gamesWon: { type: Number, default: 0 },
  winRate: { type: Number, default: 0 },
  avgTime: { type: Number, default: 0 },
  favoritePuzzle: { type: String, default: null },
  bestScore: { type: Number, default: 0 },
  totalPuzzlesSolved: { type: Number, default: 0 },
  totalHintsUsed: { type: Number, default: 0 },
  perfectEscapes: { type: Number, default: 0 },
  rankHistory: [{
    rank: Number,
    score: Number,
    season: String,
    date: { type: Date, default: Date.now }
  }],
  chapterProgress: [{
    chapter: String,
    completed: { type: Boolean, default: false },
    bestTime: Number,
    bestScore: Number,
    completedAt: Date
  }]
}, { timestamps: true });

profileSchema.methods.updateStats = function(won, time, score) {
  this.gamesPlayed += 1;
  if (won) {
    this.gamesWon += 1;
    if (score > this.bestScore) this.bestScore = score;
    if (!this.avgTime || time < this.avgTime) this.avgTime = time;
  }
  this.winRate = this.gamesPlayed > 0 ? (this.gamesWon / this.gamesPlayed) * 100 : 0;
  return this.save();
};

export default mongoose.model('Profile', profileSchema);
