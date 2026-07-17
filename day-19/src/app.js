import express from 'express';
import dotenv from 'dotenv';
dotenv.config();

import { connectDB } from './config/db.config.js';
import agentRoutes    from './routes/agent.routes.js';
import incidentRoutes from './routes/incident.routes.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10kb' }));
app.use('/api/agent',    agentRoutes);
app.use('/api/incident', incidentRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🚀 Server: http://localhost:${PORT}`);
    console.log(`\n📍 Endpoints:`);
    console.log(`   POST /api/agent/chat            — Single agent chat`);
    console.log(`   POST /api/agent/stream          — Streaming agent`);
    console.log(`   POST /api/agent/parallel        — Parallel tool test`);
    console.log(`   POST /api/incident/investigate  — DevOps agent`);
    console.log(`   POST /api/incident/approve      — Approve/deny action`);
    console.log(`   POST /api/incident/order        — Order agent`);
    console.log(`   GET  /api/incident/pending      — List pending approvals\n`);
  });
});