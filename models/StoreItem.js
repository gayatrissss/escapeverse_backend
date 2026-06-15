import mongoose from 'mongoose';

const storeItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: {
    type: String, required: true,
    enum: ['themes', 'avatars', 'pets', 'music', 'frames', 'effects', 'companions', 'inventory-skins']
  },
  description: String,
  price: { type: Number, required: true },
  currency: { type: String, enum: ['coins', 'gems', 'real'], default: 'coins' },
  image: String,
  rarity: { type: String, enum: ['common', 'rare', 'epic', 'legendary'], default: 'common' },
  stats: {
    popularity: { type: Number, default: 0 },
    salesCount: { type: Number, default: 0 }
  },
  isLimited: { type: Boolean, default: false },
  availableUntil: Date,
  requiredLevel: { type: Number, default: 1 },
  active: { type: Boolean, default: true }
}, { timestamps: true });

export default mongoose.model('StoreItem', storeItemSchema);
