import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  productId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  description: String,
  category: String,
  price: Number,
  stock: Number,
  rating: Number,
  tags: [String]
}, {
  timestamps: true
});

// Text index for search
productSchema.index({
  name: 'text',
  description: 'text',
  tags: 'text'
});

export const Product = mongoose.model('Product', productSchema);