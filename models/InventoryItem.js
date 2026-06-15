import mongoose from 'mongoose';

const inventoryItemSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'GameSession' },
  name: { type: String, required: true },
  description: String,
  image: String,
  type: { type: String, enum: ['key', 'tool', 'clue', 'consumable', 'special'], default: 'clue' },
  combinable: { type: Boolean, default: false },
  combineWith: [String],
  used: { type: Boolean, default: false },
  usedOn: String,
  collectedAt: { type: Date, default: Date.now }
}, { timestamps: true });

export default mongoose.model('InventoryItem', inventoryItemSchema);
