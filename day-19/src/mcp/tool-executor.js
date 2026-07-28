import { ALL_TOOL_EXECUTORS } from './tool-registry.js';

export async function executeTool(name, args = {}) {
  console.log(`\n[TOOL] ▶ ${name} | ${JSON.stringify(args)}`);
  const fn = ALL_TOOL_EXECUTORS[name];
  if (!fn) return { success:false, error:`Unknown tool: "${name}"` };
  try {
    const r = await fn(args);
    console.log(`[TOOL] ✓ ${name}`);
    return r;
  } catch(e) { return { success:false, error:e.message }; }
}