import { ALL_TOOL_EXECUTORS } from './tool-registry.js';

// ── Execute a single tool with retry logic ────────────────────
export async function executeTool(
  toolName,
  toolArguments,
  options = {}
) {
  const {
    maxRetries = 2,
    retryDelayMs = 1000,
    retryOnError = true
  } = options;

  console.log(`\n[TOOL] ▶ Executing: ${toolName}`);
  console.log(`[TOOL]   Args: ${JSON.stringify(toolArguments)}`);

  const executor = ALL_TOOL_EXECUTORS[toolName];

  if (!executor) {
    console.error(`[TOOL] ✗ Unknown tool: ${toolName}`);
    return {
      success: false,
      error: `Unknown tool: ${toolName}. Available tools: ${Object.keys(ALL_TOOL_EXECUTORS).join(', ')}`
    };
  }

  let lastError = null;
  const startTime = Date.now();

  // Retry loop
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      const result = await executor(toolArguments);
      const latencyMs = Date.now() - startTime;

      console.log(`[TOOL] ✓ ${toolName} completed in ${latencyMs}ms (attempt ${attempt})`);

      return result;

    } catch (error) {
      lastError = error;
      console.error(`[TOOL] ✗ ${toolName} attempt ${attempt} failed: ${error.message}`);

      // Don't retry if it's a business logic error (not a technical error)
      if (!retryOnError) break;
      if (attempt <= maxRetries) {
        const delay = retryDelayMs * attempt; // exponential backoff
        console.log(`[TOOL]   Retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  return {
    success: false,
    error: `Tool failed after ${maxRetries + 1} attempts: ${lastError?.message}`
  };
}

// ── Execute multiple tools in parallel ────────────────────────
export async function executeToolsParallel(toolCalls) {
  console.log(`\n[TOOL] ⚡ Running ${toolCalls.length} tools in parallel:`);
  toolCalls.forEach(t => console.log(`[TOOL]   - ${t.name}`));

  const results = await Promise.allSettled(
    toolCalls.map(({ name, args }) => executeTool(name, args))
  );

  return results.map((result, index) => ({
    toolName: toolCalls[index].name,
    success: result.status === 'fulfilled',
    result: result.status === 'fulfilled'
      ? result.value
      : { success: false, error: result.reason?.message }
  }));
}