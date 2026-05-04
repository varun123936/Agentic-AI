import express from 'express';
import dotenv from 'dotenv';
dotenv.config();

import chatRoutes from './routes/chat.routes.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10kb' }));

// Serve the test HTML file
app.use(express.static('src/public'));

app.use('/api/chat', chatRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', provider: process.env.AI_PROVIDER });
});

app.listen(PORT, () => {
  console.log(`🚀 Server: http://localhost:${PORT}`);
  console.log(`🤖 Provider: ${process.env.AI_PROVIDER || 'gemini'}`);
  console.log(`🧪 Test UI: http://localhost:${PORT}/test-client.html`);
});