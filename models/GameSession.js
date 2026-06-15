import mongoose from 'mongoose';

const gameSessionSchema = new mongoose.Schema({
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
  players: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    username: String,
    score: { type: Number, default: 1000 },
    ready: { type: Boolean, default: false },
    hintsUsed: { type: Number, default: 0 },
    puzzlesSolved: { type: Number, default: 0 }
  }],
  chapter: { type: String, required: true, default: 'abandoned-mansion' },
  currentRoom: { type: String, default: 'lobby' },
  mode: { type: String, enum: ['normal', 'practice', 'ranked', 'speedrun'], default: 'normal' },
  score: { type: Number, default: 1000 },
  timer: { type: Number, default: 600 },
  timerActive: { type: Boolean, default: false },
  hintsUsed: { type: Number, default: 0 },
  puzzlesSolved: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Puzzle' }],
  selectedPuzzles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Puzzle' }],
  gameLevel: { type: Number, default: 1 },
  collectedItems: [{ type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem' }],
  unlockedDoors: [String],
  status: { type: String, enum: ['waiting', 'active', 'paused', 'completed', 'failed'], default: 'waiting' },
  startTime: Date,
  endTime: Date,
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' }
}, { timestamps: true });

gameSessionSchema.methods.startTimer = function() {
  this.timerActive = true;
  this.startTime = new Date();
  this.status = 'active';
  return this.save();
};

gameSessionSchema.methods.deductScore = function(amount) {
  this.score = Math.max(0, this.score - amount);
  return this.save();
};

gameSessionSchema.methods.addSolvedPuzzle = function(puzzleId) {
  if (!this.puzzlesSolved.includes(puzzleId)) {
    this.puzzlesSolved.push(puzzleId);
  }
  return this.save();
};

export default mongoose.model('GameSession', gameSessionSchema);
