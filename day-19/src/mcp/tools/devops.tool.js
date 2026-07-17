// DevOps tools — simulated for learning
// In production these would call real AWS SDK, kubectl, etc.

// ── Simulated service registry ─────────────────────────────────
const SERVICES = {
  'payment-service': {
    name: 'Payment Service',
    status: 'degraded',    // healthy | degraded | down
    instances: 3,
    healthyInstances: 1,
    cpu: 94,
    memory: 87,
    port: 8001,
    lastDeployedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  },
  'order-service': {
    name: 'Order Service',
    status: 'healthy',
    instances: 2,
    healthyInstances: 2,
    cpu: 45,
    memory: 60,
    port: 8002,
    lastDeployedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  },
  'notification-service': {
    name: 'Notification Service',
    status: 'down',
    instances: 2,
    healthyInstances: 0,
    cpu: 0,
    memory: 0,
    port: 8003,
    lastDeployedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString()
  }
};

// ── Simulated log storage ──────────────────────────────────────
const SERVICE_LOGS = {
  'payment-service': [
    { level: 'ERROR', timestamp: new Date(Date.now() - 5 * 60000).toISOString(),  message: 'Database connection pool exhausted. Max connections: 10' },
    { level: 'ERROR', timestamp: new Date(Date.now() - 8 * 60000).toISOString(),  message: 'Transaction timeout after 30000ms for txn_id: TXN-8821' },
    { level: 'WARN',  timestamp: new Date(Date.now() - 10 * 60000).toISOString(), message: 'High latency detected: p99=4200ms, threshold=1000ms' },
    { level: 'ERROR', timestamp: new Date(Date.now() - 12 * 60000).toISOString(), message: 'Connection refused to payment-db:5432' },
    { level: 'INFO',  timestamp: new Date(Date.now() - 15 * 60000).toISOString(), message: 'Service started on port 8001' },
  ],
  'notification-service': [
    { level: 'ERROR', timestamp: new Date(Date.now() - 2 * 60000).toISOString(),  message: 'FATAL: Out of memory. Service killed by OOM killer.' },
    { level: 'ERROR', timestamp: new Date(Date.now() - 3 * 60000).toISOString(),  message: 'Memory usage at 98%: 1.96GB / 2GB' },
    { level: 'WARN',  timestamp: new Date(Date.now() - 20 * 60000).toISOString(), message: 'Memory leak detected in email template renderer' },
  ]
};

export const devopsToolDefinitions = [

  {
    name: 'check_service_health',
    description: `Check the health status of a backend service.
Returns CPU usage, memory usage, number of instances, and overall health.
Use this first when investigating any service issue.`,
    parameters: {
      type: 'object',
      properties: {
        serviceName: {
          type: 'string',
          description: 'Service name (e.g. payment-service, order-service, notification-service)'
        }
      },
      required: ['serviceName']
    }
  },

  {
    name: 'get_service_logs',
    description: `Get recent error and warning logs for a service.
Use this to understand WHY a service is failing.
Always call check_service_health first, then call this for degraded/down services.`,
    parameters: {
      type: 'object',
      properties: {
        serviceName: {
          type: 'string',
          description: 'Service name to get logs for'
        },
        level: {
          type: 'string',
          description: 'Log level filter: ERROR | WARN | INFO | ALL. Default: ERROR'
        },
        lastMinutes: {
          type: 'number',
          description: 'Get logs from the last N minutes. Default: 30'
        }
      },
      required: ['serviceName']
    }
  },

  {
    name: 'check_all_services',
    description: `Get health overview of ALL services at once.
Use this for a system-wide health check or when user reports
multiple services are having issues.`,
    parameters: {
      type: 'object',
      properties: {}
    }
  },

  {
    name: 'restart_service',
    description: `Restart a service instance to recover from failures.
IMPORTANT: Only call this AFTER human approval has been given.
This is a destructive operation that causes brief downtime.`,
    parameters: {
      type: 'object',
      properties: {
        serviceName: {
          type: 'string',
          description: 'Service to restart'
        },
        reason: {
          type: 'string',
          description: 'Reason for restart — for audit log'
        }
      },
      required: ['serviceName', 'reason']
    }
  },

  {
    name: 'scale_service',
    description: `Scale a service up or down by changing instance count.
Use when service is healthy but overloaded (high CPU/memory).
IMPORTANT: Requires human approval before execution.`,
    parameters: {
      type: 'object',
      properties: {
        serviceName: { type: 'string', description: 'Service to scale' },
        targetInstances: {
          type: 'number',
          description: 'Target number of instances (1-10)'
        },
        reason: { type: 'string', description: 'Reason for scaling' }
      },
      required: ['serviceName', 'targetInstances', 'reason']
    }
  },

  {
    name: 'create_incident_report',
    description: `Create a structured incident report after resolving an issue.
Always call this as the LAST step after an incident is resolved.`,
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short incident title' },
        severity: {
          type: 'string',
          description: 'P1 | P2 | P3 | P4'
        },
        affectedService: { type: 'string' },
        rootCause: { type: 'string', description: 'Root cause identified' },
        resolution: { type: 'string', description: 'What was done to fix it' },
        duration: { type: 'string', description: 'How long the incident lasted' }
      },
      required: ['title', 'severity', 'affectedService', 'rootCause', 'resolution']
    }
  }

];

export const devopsToolExecutors = {

  check_service_health: async ({ serviceName }) => {
    const service = SERVICES[serviceName];
    if (!service) {
      return {
        success: false,
        error: `Service "${serviceName}" not found. Available: ${Object.keys(SERVICES).join(', ')}`
      };
    }

    // Simulate slight delay like a real health check API
    await new Promise(r => setTimeout(r, 100));

    return {
      success: true,
      serviceName,
      ...service,
      recommendation: service.status === 'down'
        ? 'Service is completely down. Immediate action required.'
        : service.status === 'degraded'
        ? 'Service is degraded. Check logs for root cause.'
        : 'Service is healthy. No action needed.'
    };
  },

  get_service_logs: async ({ serviceName, level = 'ERROR', lastMinutes = 30 }) => {
    const logs = SERVICE_LOGS[serviceName];
    if (!logs) {
      return {
        success: true,
        serviceName,
        logs: [],
        message: 'No logs found for this service in the specified time range'
      };
    }

    const cutoff = new Date(Date.now() - lastMinutes * 60 * 1000);
    let filtered = logs.filter(log =>
      new Date(log.timestamp) >= cutoff
    );

    if (level !== 'ALL') {
      filtered = filtered.filter(log => log.level === level);
    }

    return {
      success: true,
      serviceName,
      logLevel: level,
      timeRange: `Last ${lastMinutes} minutes`,
      count: filtered.length,
      logs: filtered
    };
  },

  check_all_services: async () => {
    await new Promise(r => setTimeout(r, 150));

    const overview = Object.entries(SERVICES).map(([key, svc]) => ({
      serviceName: key,
      status: svc.status,
      healthyInstances: svc.healthyInstances,
      totalInstances: svc.instances,
      cpu: svc.cpu,
      memory: svc.memory
    }));

    const summary = {
      total: overview.length,
      healthy: overview.filter(s => s.status === 'healthy').length,
      degraded: overview.filter(s => s.status === 'degraded').length,
      down: overview.filter(s => s.status === 'down').length
    };

    return {
      success: true,
      summary,
      services: overview,
      criticalIssues: overview
        .filter(s => s.status !== 'healthy')
        .map(s => `${s.serviceName}: ${s.status}`)
    };
  },

  restart_service: async ({ serviceName, reason }) => {
    const service = SERVICES[serviceName];
    if (!service) {
      return {
        success: false,
        error: `Service "${serviceName}" not found`
      };
    }

    // Simulate restart time
    await new Promise(r => setTimeout(r, 500));

    // Update simulated state
    SERVICES[serviceName] = {
      ...service,
      status: 'healthy',
      healthyInstances: service.instances,
      cpu: 35,
      memory: 55
    };

    return {
      success: true,
      serviceName,
      action: 'restart',
      previousStatus: service.status,
      currentStatus: 'healthy',
      message: `${serviceName} restarted successfully. All ${service.instances} instances are now healthy.`,
      auditLog: {
        action: 'SERVICE_RESTART',
        reason,
        timestamp: new Date().toISOString(),
        performedBy: 'AI Agent (with human approval)'
      }
    };
  },

  scale_service: async ({ serviceName, targetInstances, reason }) => {
    const service = SERVICES[serviceName];
    if (!service) {
      return { success: false, error: `Service "${serviceName}" not found` };
    }

    if (targetInstances < 1 || targetInstances > 10) {
      return {
        success: false,
        error: 'Target instances must be between 1 and 10'
      };
    }

    await new Promise(r => setTimeout(r, 300));
    const previous = service.instances;
    SERVICES[serviceName].instances = targetInstances;
    SERVICES[serviceName].healthyInstances = targetInstances;

    return {
      success: true,
      serviceName,
      previousInstances: previous,
      currentInstances: targetInstances,
      action: targetInstances > previous ? 'scaled_up' : 'scaled_down',
      auditLog: {
        action: 'SERVICE_SCALE',
        reason,
        timestamp: new Date().toISOString(),
        performedBy: 'AI Agent (with human approval)'
      }
    };
  },

  create_incident_report: async ({
    title, severity, affectedService,
    rootCause, resolution, duration
  }) => {
    const report = {
      incidentId: `INC-${Date.now()}`,
      title,
      severity,
      affectedService,
      rootCause,
      resolution,
      duration: duration || 'Unknown',
      createdAt: new Date().toISOString(),
      status: 'resolved'
    };

    // In production: save to MongoDB, send to PagerDuty, Slack, etc.
    console.log('\n[INCIDENT REPORT CREATED]', JSON.stringify(report, null, 2));

    return {
      success: true,
      incidentId: report.incidentId,
      message: `Incident report ${report.incidentId} created successfully`,
      report
    };
  }

};