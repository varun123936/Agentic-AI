import express from 'express';
import dotenv from 'dotenv';
dotenv.config();

import { connectDB } from './config/db.config.js';
import agentRoutes from './routes/agent.routes.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10kb' }));
app.use('/api/agent', agentRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🚀 Server: http://localhost:${PORT}`);
    console.log(`🛠️  Tools available:`);
    console.log(`   • get_order_status`);
    console.log(`   • get_orders_by_customer`);
    console.log(`   • cancel_order`);
    console.log(`   • search_products`);
    console.log(`   • check_product_stock`);
    console.log(`   • get_current_weather\n`);
  });
});