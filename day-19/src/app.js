import express      from 'express';
import dotenv       from 'dotenv';
import path         from 'path';
import { fileURLToPath } from 'url';
dotenv.config();

import { connectDB }     from './config/db.config.js';
import { AI_CONFIG }     from './config/ai.config.js';
import agentRoutes       from './routes/agent.routes.js';
import incidentRoutes    from './routes/incident.routes.js';

const app      = express();
const PORT     = process.env.PORT || 3000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, '../public')));

app.use('/api/agent',    agentRoutes);
app.use('/api/incident', incidentRoutes);

// Switch provider via API
app.post('/api/config/provider', (req, res) => {
  const { provider } = req.body;
  if (!['gemini','ollama'].includes(provider)) return res.status(400).json({ error:'Invalid provider' });
  AI_CONFIG.provider = provider;
  console.log(`[CONFIG] Switched to: ${provider}`);
  res.json({ success:true, provider, model: provider==='gemini' ? 'gemini-2.0-flash' : AI_CONFIG.ollama.model });
});

app.get('/api/config', (req, res) => {
  res.json({ provider:AI_CONFIG.provider, model: AI_CONFIG.provider==='gemini' ? 'gemini-2.0-flash' : AI_CONFIG.ollama.model });
});

app.get('/health', (req, res) => res.json({ ok:true, provider:AI_CONFIG.provider }));

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n${'═'.repeat(55)}`);
    console.log(`  🚀  Day 19 — AI Agent Dashboard`);
    console.log(`  🌐  http://localhost:${PORT}`);
    console.log(`  🤖  Provider: ${AI_CONFIG.provider}`);
    console.log(`  📦  Model: ${AI_CONFIG.provider==='gemini' ? 'gemini-2.0-flash' : AI_CONFIG.ollama.model}`);
    console.log(`${'═'.repeat(55)}\n`);
  });
});