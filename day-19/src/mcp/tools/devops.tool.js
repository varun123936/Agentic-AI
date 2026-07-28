let SERVICES = {
  'payment-service':      { status:'degraded', instances:3, healthyInstances:1, cpu:94, memory:87 },
  'order-service':        { status:'healthy',  instances:2, healthyInstances:2, cpu:45, memory:60 },
  'notification-service': { status:'down',     instances:2, healthyInstances:0, cpu:0,  memory:0  }
};
const LOGS = {
  'payment-service':      [{ level:'ERROR', ts:new Date(Date.now()-5*60000).toISOString(),  msg:'DB connection pool exhausted' }, { level:'ERROR', ts:new Date(Date.now()-8*60000).toISOString(), msg:'Transaction timeout 30000ms' }, { level:'WARN', ts:new Date(Date.now()-12*60000).toISOString(), msg:'High latency p99=4200ms' }],
  'notification-service': [{ level:'ERROR', ts:new Date(Date.now()-2*60000).toISOString(),  msg:'FATAL: Out of memory killed' }, { level:'WARN',  ts:new Date(Date.now()-20*60000).toISOString(), msg:'Memory leak in email renderer' }]
};
export const devopsToolDefinitions = [
  { name:'check_all_services', description:'Get health overview of ALL backend services. Call this first.', parameters:{ type:'object', properties:{ include_metrics:{ type:'string', description:'Pass "all" for metrics' } } } },
  { name:'check_service_health', description:'Check health of one specific service.', parameters:{ type:'object', properties:{ serviceName:{ type:'string', description:'payment-service | order-service | notification-service' } }, required:['serviceName'] } },
  { name:'get_service_logs', description:'Get recent logs for a service to find root cause.', parameters:{ type:'object', properties:{ serviceName:{ type:'string' }, level:{ type:'string', description:'ERROR|WARN|ALL' }, lastMinutes:{ type:'number' } }, required:['serviceName'] } },
  { name:'restart_service', description:'Restart a service. REQUIRES HUMAN APPROVAL. Never call without approval.', parameters:{ type:'object', properties:{ serviceName:{ type:'string' }, reason:{ type:'string' } }, required:['serviceName','reason'] } },
  { name:'create_incident_report', description:'Create incident report after resolution. Call as last step.', parameters:{ type:'object', properties:{ title:{ type:'string' }, severity:{ type:'string', description:'P1|P2|P3|P4' }, affectedService:{ type:'string' }, rootCause:{ type:'string' }, resolution:{ type:'string' } }, required:['title','severity','affectedService','rootCause','resolution'] } }
];
export const devopsToolExecutors = {
  check_all_services: async () => {
    const list = Object.entries(SERVICES).map(([k,v]) => ({ serviceName:k, status:v.status, healthyInstances:v.healthyInstances, totalInstances:v.instances, cpu:v.cpu, memory:v.memory }));
    return { success:true, summary:{ total:list.length, healthy:list.filter(s=>s.status==='healthy').length, degraded:list.filter(s=>s.status==='degraded').length, down:list.filter(s=>s.status==='down').length }, services:list, issues:list.filter(s=>s.status!=='healthy').map(s=>`${s.serviceName}: ${s.status}`) };
  },
  check_service_health: async ({ serviceName }) => {
    const s = SERVICES[serviceName];
    if (!s) return { success:false, error:`"${serviceName}" not found. Available: ${Object.keys(SERVICES).join(', ')}` };
    return { success:true, serviceName, ...s, recommendation: s.status==='down'?'CRITICAL: Down. Immediate action.':s.status==='degraded'?'WARNING: Degraded. Check logs.':'OK: Healthy.' };
  },
  get_service_logs: async ({ serviceName, level='ERROR', lastMinutes=30 }) => {
    let logs = (LOGS[serviceName]||[]).filter(l => new Date(l.ts) >= new Date(Date.now()-lastMinutes*60000));
    if (level!=='ALL') logs = logs.filter(l => l.level===level);
    return { success:true, serviceName, count:logs.length, logs: logs.map(l=>({ level:l.level, timestamp:l.ts, message:l.msg })) };
  },
  restart_service: async ({ serviceName, reason }) => {
    const s = SERVICES[serviceName];
    if (!s) return { success:false, error:`"${serviceName}" not found` };
    const prev = s.status;
    SERVICES[serviceName] = { ...s, status:'healthy', healthyInstances:s.instances, cpu:30, memory:50 };
    return { success:true, serviceName, previousStatus:prev, currentStatus:'healthy', message:`${serviceName} restarted. ${s.instances} instances healthy.`, auditLog:{ action:'RESTART', reason, ts:new Date().toISOString() } };
  },
  create_incident_report: async (args) => {
    const r = { incidentId:`INC-${Date.now()}`, ...args, createdAt:new Date().toISOString(), status:'resolved' };
    console.log('\n[INCIDENT REPORT]\n', JSON.stringify(r, null, 2));
    return { success:true, incidentId:r.incidentId, message:`Report ${r.incidentId} created.`, report:r };
  }
};