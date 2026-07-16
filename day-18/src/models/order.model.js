import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
  orderId: {
    type: String,
    required: true,
    unique: true
  },
  customerId: String,
  customerName: String,
  customerEmail: String,
  items: [{
    productName: String,
    quantity: Number,
    price: Number
  }],
  totalAmount: Number,
  status: {
    type: String,
    enum: [
      'pending',
      'confirmed',
      'processing',
      'shipped',
      'delivered',
      'cancelled',
      'refunded'
    ],
    default: 'pending'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },
  shippingAddress: {
    street: String,
    city: String,
    state: String,
    pincode: String
  },
  trackingNumber: String,
  estimatedDelivery: Date,
  notes: String
}, {
  timestamps: true
});

export const Order = mongoose.model('Order', orderSchema);