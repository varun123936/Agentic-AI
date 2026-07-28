import { BaseAgent }         from './base.agent.js';
import { devopsToolDefinitions } from '../mcp/tools/devops.tool.js';
import { AI_CONFIG }         from '../config/ai.config.js';

const SYSTEM = `You are an expert DevOps incident response agent on ${AI_CONFIG.provider==='gemini'?'Gemini 2.0 Flash':'Ollama gemma4:cloud'}.
Protocol: 1) check_all_services 2) check_service_health per problem 3) get_service_logs 4) diagnose 5) STOP for approval before restart_service 6) create_incident_report.
Severity: P1=down P2=degraded P3=slow P4=minor`;

export function createIncidentAgent(cb={}) {
  return new BaseAgent({ name:'IncidentAgent', systemPrompt:SYSTEM, maxToolRounds:12, temperature:0.1, tools:devopsToolDefinitions, requiresApproval:['restart_service'], ...cb });
}