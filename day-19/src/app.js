import express   from 'express';
import cors      from 'cors';
import dotenv    from 'dotenv';
dotenv.config();

import { connectDB }     from './config/db.config.js';
import { AI_CONFIG }     from './config/ai.config.js';
import agentRoutes       from './routes/agent.routes.js';
import incidentRoutes    from './routes/incident.routes.js';

const app  = express();
const PORT = process.env.PORT || 3000;

// CORS — allow Angular dev server
app.use(cors({ origin: ['http://localhost:4200', 'http://localhost:3001'], credentials: true }));
app.use(express.json({ limit: '10kb' }));

app.use('/api/agent',    agentRoutes);
app.use('/api/incident', incidentRoutes);

// Switch provider at runtime
app.post('/api/config/provider', (req, res) => {
  const { provider } = req.body;
  if (!['gemini','ollama'].includes(provider)) return res.status(400).json({ error:'Invalid provider' });
  AI_CONFIG.provider = provider;
  console.log(`[CONFIG] Provider switched to: ${provider}`);
  res.json({ success:true, provider, model: provider==='gemini'?'gemini-2.0-flash':AI_CONFIG.ollama.model });
});

app.get('/api/config', (req, res) => res.json({
  provider: AI_CONFIG.provider,
  model: AI_CONFIG.provider==='gemini' ? 'gemini-2.0-flash' : AI_CONFIG.ollama.model,
  tools: ['get_order_status','get_orders_by_customer','cancel_order','search_products','check_product_stock','get_current_weather','check_all_services','check_service_health','get_service_logs','restart_service','create_incident_report']
}));

app.get('/health', (req, res) => res.json({ ok:true, provider:AI_CONFIG.provider }));

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n${'═'.repeat(50)}`);
    console.log(`  🚀 Day 19 Backend: http://localhost:${PORT}`);
    console.log(`  🤖 Provider: ${AI_CONFIG.provider}`);
    console.log(`${'═'.repeat(50)}\n`);
  });
});