import {
  orderToolDefinitions,
  orderToolExecutors
} from './tools/order.tool.js';
import {
  productToolDefinitions,
  productToolExecutors
} from './tools/product.tool.js';
import {
  weatherToolDefinitions,
  weatherToolExecutors
} from './tools/weather.tool.js';
import {
  devopsToolDefinitions,
  devopsToolExecutors
} from './tools/devops.tool.js';

export const ALL_TOOL_DEFINITIONS = [
  ...orderToolDefinitions,
  ...productToolDefinitions,
  ...weatherToolDefinitions,
  ...devopsToolDefinitions
];

export const ALL_TOOL_EXECUTORS = {
  ...orderToolExecutors,
  ...productToolExecutors,
  ...weatherToolExecutors,
  ...devopsToolExecutors
};

export function buildGeminiFunctionDeclarations(
  tools = ALL_TOOL_DEFINITIONS
) {
  return {
    tools: [{
      functionDeclarations: tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      }))
    }]
  };
}

export function getToolNames() {
  return ALL_TOOL_DEFINITIONS.map(t => t.name);
}