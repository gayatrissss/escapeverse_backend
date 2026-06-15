import mongoose from 'mongoose';

const friendRequestSchema = new mongoose.Schema({
  from: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  to: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'accepted', 'rejected', 'blocked'], default: 'pending' },
  message: String,
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

friendRequestSchema.index({ from: 1, to: 1 }, { unique: true });

export default mongoose.model('FriendRequest', friendRequestSchema);
