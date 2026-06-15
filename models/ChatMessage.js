import mongoose from 'mongoose';

const chatMessageSchema = new mongoose.Schema({
  roomId: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  username: { type: String, required: true },
  message: { type: String, required: true, maxlength: 500 },
  type: { type: String, enum: ['text', 'system', 'emoji', 'hint'], default: 'text' },
  timestamp: { type: Date, default: Date.now }
}, { timestamps: true });

chatMessageSchema.index({ roomId: 1, timestamp: -1 });

export default mongoose.model('ChatMessage', chatMessageSchema);
