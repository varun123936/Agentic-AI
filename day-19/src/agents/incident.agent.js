import { BaseAgent }         from './base.agent.js';
import { devopsToolDefinitions } from '../mcp/tools/devops.tool.js';
import { AI_CONFIG }         from '../config/ai.config.js';

const SYSTEM = `You are an expert DevOps incident response agent running on ${AI_CONFIG.provider === 'gemini' ? 'Gemini 2.0 Flash' : 'Ollama gemma4:cloud'}.

Investigation Protocol:
1. Call check_all_services to see overall health
2. For each degraded/down service call check_service_health
3. Call get_service_logs to find root cause
4. Diagnose and propose fix
5. STOP and request approval before restart_service
6. After fix, call create_incident_report

Severity: P1=down, P2=degraded, P3=slow, P4=minor`;

export function createIncidentAgent(callbacks = {}) {
  return new BaseAgent({
    name: 'IncidentAgent', systemPrompt: SYSTEM,
    maxToolRounds: 12, temperature: 0.1,
    tools: devopsToolDefinitions,
    requiresApproval: ['restart_service'],
    ...callbacks
  });
}