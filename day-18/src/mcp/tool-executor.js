// Tool Executor — runs the right tool when AI requests it
// This is the bridge between AI tool call requests
// and your actual Node.js business logic

import { ALL_TOOL_EXECUTORS } from './tool-registry.js';

export async function executeTool(toolName, toolArguments) {
  console.log(`[TOOL] Executing: ${toolName}`);
  console.log(`[TOOL] Arguments:`, JSON.stringify(toolArguments));

  const executor = ALL_TOOL_EXECUTORS[toolName];

  if (!executor) {
    const error = `Unknown tool: ${toolName}`;
    console.error(`[TOOL] ${error}`);
    return { success: false, error };
  }

  try {
    const startTime = Date.now();
    const result = await executor(toolArguments);
    const latencyMs = Date.now() - startTime;

    console.log(`[TOOL] ${toolName} completed in ${latencyMs}ms`);
    console.log(`[TOOL] Result:`, JSON.stringify(result).substring(0, 200));

    return result;

  } catch (error) {
    console.error(`[TOOL] ${toolName} failed:`, error.message);
    return {
      success: false,
      error: `Tool execution failed: ${error.message}`
    };
  }
}