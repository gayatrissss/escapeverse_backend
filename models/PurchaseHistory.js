import mongoose from 'mongoose';

const purchaseHistorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'StoreItem', required: true },
  itemName: String,
  price: { type: Number, required: true },
  currency: { type: String, default: 'coins' },
  date: { type: Date, default: Date.now }
}, { timestamps: true });

export default mongoose.model('PurchaseHistory', purchaseHistorySchema);
