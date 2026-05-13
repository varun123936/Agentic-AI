// env.js is loaded via --import before this file runs,
// so process.env is fully populated here already.
import express from 'express';

import { connectDB } from './config/db.config.js';
import { AI_CONFIG } from './config/ai.config.js';
import { errorHandler } from './middleware/errorHandler.js';
import { aiRateLimiter } from './middleware/rateLimiter.js';
import authRoutes from './routes/auth.routes.js';
import chatRoutes from './routes/chat.routes.js';
import adminRoutes from './routes/admin.routes.js';

const app = express();
const PORT = AI_CONFIG.port;

// ── CORS Middleware ───────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', AI_CONFIG.corsOrigin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

// ── Body parser ───────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));

// ── Routes ────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/chat', aiRateLimiter, chatRoutes);
app.use('/api/admin', adminRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', provider: process.env.AI_PROVIDER });
});

// ── 404 handler ───────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.path}`,
    code: 'ROUTE_NOT_FOUND'
  });
});

// ── Global error handler (MUST be last) ──────────────────────
app.use(errorHandler);

// ── Start server ──────────────────────────────────────────────
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🚀 Server running at: http://localhost:${PORT}`);
    console.log(`🤖 AI Provider:       ${process.env.AI_PROVIDER || 'gemini'}`);
    console.log(`🌐 CORS Origin:       ${AI_CONFIG.corsOrigin}`);
    console.log('\n📡 Available routes:');
    console.log(`   POST   /api/auth/register`);
    console.log(`   POST   /api/auth/login`);
    console.log(`   GET    /api/auth/me`);
    console.log(`   POST   /api/auth/logout`);
    console.log(`   POST   /api/chat/conversations`);
    console.log(`   GET    /api/chat/conversations`);
    console.log(`   GET    /api/chat/conversations/:id/messages`);
    console.log(`   POST   /api/chat/conversations/:id/stream`);
    console.log(`   GET    /api/chat/usage`);
    console.log(`   GET    /api/admin/users`);
    console.log(`   GET    /api/admin/usage`);
    console.log(`   GET    /api/admin/stats`);
    console.log(`   PATCH  /api/admin/users/:id/token-limit`);
    console.log(`   GET    /health\n`);
  });
}).catch((err) => {
  console.error('❌ Failed to start server:', err.message);
  process.exit(1);
});
