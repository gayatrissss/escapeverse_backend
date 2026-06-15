import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true, minlength: 3, maxlength: 20 },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  password: { type: String, minlength: 6 },
  googleId: { type: String },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  isGuest: { type: Boolean, default: false },
  isFirstLogin: { type: Boolean, default: true },
  coins: { type: Number, default: 100 },
  xp: { type: Number, default: 0 },
  stars: { type: Number, default: 0 },
  level: { type: Number, default: 1 },
  gameLevel: { type: Number, default: 1 },
  avatar: { type: String, default: 'default-avatar' },
  theme: { type: String, default: 'dark', enum: ['dark', 'cyberpunk', 'mystic', 'neon', 'horror', 'space', 'royal'] },
  companion: { type: String, default: 'echo' },
  companionMemory: {
    playerName: String,
    favoritePuzzle: String,
    lastGreeting: Date,
    totalHints: { type: Number, default: 0 },
    messages: [{ message: String, timestamp: Date }]
  },
  settings: {
    musicVolume: { type: Number, default: 0.7 },
    sfxVolume: { type: Number, default: 0.8 },
    notifications: { type: Boolean, default: true }
  },
  lastLogin: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password') || !this.password) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.addCoins = function(amount) {
  this.coins += amount;
  return this.save();
};

userSchema.methods.addXP = function(amount) {
  this.xp += amount;
  const newLevel = Math.floor(this.xp / 100) + 1;
  if (newLevel > this.level) this.level = newLevel;
  return this.save();
};

export default mongoose.model('User', userSchema);
