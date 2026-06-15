import mongoose from 'mongoose';

const achievementSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: {
    type: String, required: true,
    enum: ['first-escape', 'puzzle-master', 'no-hint', 'perfect-escape', 'collector', 'speed-runner', 'legend', 'hidden-explorer', 'social-butterfly', 'daily-warrior', 'shopaholic', 'lucky-star', 'guild-master', 'friend-maker']
  },
  name: { type: String, required: true },
  description: { type: String, required: true },
  icon: String,
  rarity: { type: String, enum: ['common', 'rare', 'epic', 'legendary'], default: 'common' },
  unlockedAt: { type: Date, default: Date.now },
  progress: { type: Number, default: 0 },
  maxProgress: { type: Number, default: 1 }
}, { timestamps: true });

achievementSchema.index({ userId: 1, type: 1 }, { unique: true });

export default mongoose.model('Achievement', achievementSchema);
