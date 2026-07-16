import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import { Order } from '../src/models/order.model.js';
import { Product } from '../src/models/product.model.js';

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected');

  // Clear existing
  await Order.deleteMany({});
  await Product.deleteMany({});

  // Seed orders
  await Order.insertMany([
    {
      orderId: 'ORD-1001',
      customerId: 'CUST-001',
      customerName: 'Ravi Kumar',
      customerEmail: 'ravi@example.com',
      items: [
        { productName: 'MacBook Pro 14"', quantity: 1, price: 150000 }
      ],
      totalAmount: 150000,
      status: 'shipped',
      paymentStatus: 'paid',
      trackingNumber: 'TRK-XY123456',
      estimatedDelivery: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      shippingAddress: {
        street: '42 MG Road', city: 'Hyderabad',
        state: 'Telangana', pincode: '500001'
      }
    },
    {
      orderId: 'ORD-1002',
      customerId: 'CUST-001',
      customerName: 'Ravi Kumar',
      customerEmail: 'ravi@example.com',
      items: [
        { productName: 'iPhone 15 Pro', quantity: 1, price: 120000 },
        { productName: 'AirPods Pro', quantity: 1, price: 25000 }
      ],
      totalAmount: 145000,
      status: 'pending',
      paymentStatus: 'paid',
      shippingAddress: {
        street: '42 MG Road', city: 'Hyderabad',
        state: 'Telangana', pincode: '500001'
      }
    },
    {
      orderId: 'ORD-1003',
      customerId: 'CUST-002',
      customerName: 'Priya Singh',
      customerEmail: 'priya@example.com',
      items: [
        { productName: 'Sony WH-1000XM5', quantity: 1, price: 28000 }
      ],
      totalAmount: 28000,
      status: 'delivered',
      paymentStatus: 'paid',
      shippingAddress: {
        street: '15 Banjara Hills', city: 'Hyderabad',
        state: 'Telangana', pincode: '500034'
      }
    }
  ]);

  // Seed products
  await Product.insertMany([
    {
      productId: 'PROD-001',
      name: 'MacBook Pro 14 inch',
      description: 'Apple MacBook Pro with M3 chip, 16GB RAM, 512GB SSD',
      category: 'Laptops',
      price: 150000,
      stock: 15,
      rating: 4.8,
      tags: ['apple', 'laptop', 'macbook', 'pro']
    },
    {
      productId: 'PROD-002',
      name: 'iPhone 15 Pro',
      description: 'Apple iPhone 15 Pro with A17 chip, 256GB storage',
      category: 'Smartphones',
      price: 120000,
      stock: 8,
      rating: 4.9,
      tags: ['apple', 'iphone', 'smartphone', 'pro']
    },
    {
      productId: 'PROD-003',
      name: 'Sony WH-1000XM5',
      description: 'Premium noise cancelling wireless headphones',
      category: 'Audio',
      price: 28000,
      stock: 0,
      rating: 4.7,
      tags: ['sony', 'headphones', 'noise-cancelling', 'wireless']
    },
    {
      productId: 'PROD-004',
      name: 'Samsung Galaxy S24 Ultra',
      description: 'Samsung flagship with 200MP camera and S Pen',
      category: 'Smartphones',
      price: 130000,
      stock: 12,
      rating: 4.6,
      tags: ['samsung', 'galaxy', 'smartphone', 'android']
    }
  ]);

  console.log('✅ Seeded 3 orders and 4 products');
  await mongoose.disconnect();
}

seed().catch(console.error);