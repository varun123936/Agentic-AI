import express from 'express';
import dotenv from 'dotenv';
dotenv.config();

import { connectDB } from './config/db.config.js';
import chatRoutes from './routes/chat.routes.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10kb' }));
app.use(express.static('.'));

app.use('/api/chat', chatRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', provider: process.env.AI_PROVIDER });
});

// Connect DB first, then start server
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Server: http://localhost:${PORT}`);
    console.log(`🤖 Provider: ${process.env.AI_PROVIDER || 'gemini'}`);
  });
});