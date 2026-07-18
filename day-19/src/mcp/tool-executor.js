import { ALL_TOOL_EXECUTORS } from './tool-registry.js';

export async function executeTool(name, args = {}) {
  console.log(`\n[TOOL] ▶ ${name} | args: ${JSON.stringify(args)}`);

  const fn = ALL_TOOL_EXECUTORS[name];
  if (!fn) {
    const err = `Unknown tool: "${name}". Available: ${Object.keys(ALL_TOOL_EXECUTORS).join(', ')}`;
    console.error(`[TOOL] ✗ ${err}`);
    return { success: false, error: err };
  }

  const t0 = Date.now();
  try {
    const result = await fn(args);
    console.log(`[TOOL] ✓ ${name} in ${Date.now()-t0}ms`);
    return result;
  } catch (err) {
    console.error(`[TOOL] ✗ ${name} error: ${err.message}`);
    return { success: false, error: err.message };
  }
}

export async function executeToolsParallel(toolCalls) {
  const results = await Promise.allSettled(
    toolCalls.map(({ name, args }) => executeTool(name, args))
  );
  return results.map((r, i) => ({
    toolName: toolCalls[i].name,
    result:   r.status === 'fulfilled' ? r.value : { success: false, error: r.reason?.message }
  }));
}