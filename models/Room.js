import mongoose from 'mongoose';

const roomSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  type: { type: String, enum: ['public', 'private'], default: 'public' },
  host: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  players: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    username: String,
    ready: { type: Boolean, default: false },
    joinedAt: { type: Date, default: Date.now }
  }],
  maxPlayers: { type: Number, default: 4, min: 1, max: 4 },
  chapter: { type: String, default: 'abandoned-mansion' },
  status: { type: String, enum: ['waiting', 'ready', 'playing', 'completed'], default: 'waiting' },
  settings: {
    mode: { type: String, enum: ['normal', 'practice', 'ranked', 'speedrun'], default: 'normal' },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
    timer: { type: Number, default: 600 }
  },
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'GameSession' },
  password: String,
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

roomSchema.methods.addPlayer = function(userId, username) {
  if (this.players.length >= this.maxPlayers) throw new Error('Room is full');
  if (this.players.find(p => p.userId.toString() === userId.toString())) throw new Error('Already in room');
  this.players.push({ userId, username });
  return this.save();
};

roomSchema.methods.removePlayer = function(userId) {
  this.players = this.players.filter(p => p.userId.toString() !== userId.toString());
  if (this.players.length === 0) this.status = 'waiting';
  return this.save();
};

roomSchema.methods.allReady = function() {
  return this.players.length > 0 && this.players.every(p => p.ready);
};

export default mongoose.model('Room', roomSchema);
