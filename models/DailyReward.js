import mongoose from 'mongoose';

const dailyRewardSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  lastClaimed: { type: Date },
  streak: { type: Number, default: 0 },
  claimedRewards: [{
    day: Number,
    reward: { type: String },
    amount: { type: Number },
    claimedAt: { type: Date, default: Date.now }
  }],
  luckyWheelSpins: { type: Number, default: 0 },
  lastWheelSpin: Date
}, { timestamps: true });

const REWARDS = [
  { day: 1, type: 'coins', amount: 100 },
  { day: 2, type: 'xp', amount: 50 },
  { day: 3, type: 'coins', amount: 200 },
  { day: 4, type: 'badge', amount: 1, item: 'bronze-badge' },
  { day: 5, type: 'coins', amount: 300 },
  { day: 6, type: 'xp', amount: 150 },
  { day: 7, type: 'coins', amount: 500, bonus: 'rare-avatar' }
];

dailyRewardSchema.statics.getRewardForDay = function(day) {
  return REWARDS.find(r => r.day === day) || REWARDS[0];
};

dailyRewardSchema.methods.canClaim = function() {
  if (!this.lastClaimed) return true;
  const last = new Date(this.lastClaimed);
  const now = new Date();
  const diffDays = Math.floor((now - last) / (1000 * 60 * 60 * 24));
  return diffDays >= 1;
};

dailyRewardSchema.methods.claim = function() {
  if (!this.canClaim()) throw new Error('Already claimed today');
  const last = this.lastClaimed ? new Date(this.lastClaimed) : null;
  const now = new Date();
  if (last) {
    const diffDays = Math.floor((now - last) / (1000 * 60 * 60 * 24));
    this.streak = diffDays === 1 ? this.streak + 1 : 1;
  } else {
    this.streak = 1;
  }
  if (this.streak > 7) this.streak = 1;
  this.lastClaimed = now;
  const reward = REWARDS.find(r => r.day === this.streak) || REWARDS[0];
  this.claimedRewards.push({ day: this.streak, reward: reward.type, amount: reward.amount });
  return this.save();
};

export default mongoose.model('DailyReward', dailyRewardSchema);
