// Base Agent — reusable agentic loop logic
// All specific agents extend this

import fetch from 'node-fetch';
import { buildGeminiFunctionDeclarations } from '../mcp/tool-registry.js';
import { executeTool } from '../mcp/tool-executor.js';

const MODEL = 'gemini-2.5-flash';
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

export class BaseAgent {

  constructor(options = {}) {
    this.name = options.name || 'BaseAgent';
    this.systemPrompt = options.systemPrompt || 'You are a helpful AI assistant.';
    this.maxToolRounds = options.maxToolRounds || 10;
    this.temperature = options.temperature || 0.2;
    this.availableTools = options.tools || [];  // subset of all tools

    // Approval gates — tool names that require human approval
    this.requiresApproval = options.requiresApproval || [];

    // Callbacks
    this.onToolCall = options.onToolCall || null;
    this.onStatus = options.onStatus || null;
    this.onApprovalNeeded = options.onApprovalNeeded || null;
  }

  // ── Core agentic loop ─────────────────────────────────────────
  async run(userMessage, conversationHistory = []) {
    console.log(`\n[${this.name}] Starting run`);
    console.log(`[${this.name}] User: ${userMessage}`);

    const apiKey = process.env.GEMINI_API_KEY;
    const url = `${BASE_URL}/${MODEL}:generateContent?key=${apiKey}`;
    const toolConfig = buildGeminiFunctionDeclarations(this.availableTools);

    const contents = [
      ...conversationHistory,
      { role: 'user', parts: [{ text: userMessage }] }
    ];

    const executionLog = [];   // track all steps for audit
    let toolCallCount = 0;
    let pendingApproval = null;

    while (toolCallCount < this.maxToolRounds) {

      // ── Call Gemini ──────────────────────────────────────────
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: this.systemPrompt }] },
          contents,
          ...toolConfig,
          generationConfig: {
            temperature: this.temperature,
            maxOutputTokens: 2000
          }
        })
      });

      const data = await response.json();
      if (data.error) throw new Error(`Gemini error: ${data.error.message}`);

      const parts = data.candidates?.[0]?.content?.parts || [];
      const functionCallPart = parts.find(p => p.functionCall);
      const textPart = parts.find(p => p.text);

      // ── Tool call requested ──────────────────────────────────
      if (functionCallPart) {
        const { name, args } = functionCallPart.functionCall;
        toolCallCount++;

        console.log(`\n[${this.name}] Tool requested: ${name}`);
        this.onStatus?.(`Checking ${name.replace(/_/g, ' ')}...`);

        // ── Check if this tool needs human approval ────────────
        if (this.requiresApproval.includes(name)) {
          console.log(`[${this.name}] ⚠️  APPROVAL REQUIRED for: ${name}`);

          pendingApproval = { toolName: name, toolArgs: args };

          // Fire approval callback — caller must handle this
          if (this.onApprovalNeeded) {
            return {
              status: 'awaiting_approval',
              pendingApproval,
              toolCallCount,
              executionLog,
              contents,  // conversation state for resuming
              message: `I need your approval before proceeding with: ${name.replace(/_/g, ' ')}`,
              toolDescription: this.availableTools.find(t => t.name === name)?.description
            };
          }

          // No approval handler — skip this tool and continue
          console.log(`[${this.name}] No approval handler — skipping ${name}`);
          contents.push({
            role: 'model',
            parts: [{ functionCall: { name, args } }]
          });
          contents.push({
            role: 'user',
            parts: [{
              functionResponse: {
                name,
                response: {
                  success: false,
                  error: 'Action requires human approval. Please confirm first.'
                }
              }
            }]
          });
          continue;
        }

        // ── Execute tool ───────────────────────────────────────
        this.onToolCall?.({ name, args });
        const toolResult = await executeTool(name, args);

        // Log execution
        executionLog.push({
          step: toolCallCount,
          tool: name,
          args,
          success: toolResult.success,
          timestamp: new Date().toISOString()
        });

        // Add to conversation
        contents.push({
          role: 'model',
          parts: [{ functionCall: { name, args } }]
        });
        contents.push({
          role: 'user',
          parts: [{ functionResponse: { name, response: toolResult } }]
        });

        continue;
      }

      // ── Final text response from AI ───────────────────────────
      if (textPart) {
        console.log(`[${this.name}] ✓ Completed. Tool calls: ${toolCallCount}`);

        contents.push({
          role: 'model',
          parts: [{ text: textPart.text }]
        });

        return {
          status: 'complete',
          answer: textPart.text,
          toolCallCount,
          executionLog,
          contents,
          usage: data.usageMetadata
        };
      }

      throw new Error('Unexpected: Gemini returned neither tool call nor text');
    }

    return {
      status: 'max_rounds_reached',
      answer: `I reached the maximum number of steps (${this.maxToolRounds}) without completing the task. Please try a more specific request.`,
      toolCallCount,
      executionLog,
      contents
    };
  }

  // ── Resume after human approval ───────────────────────────────
  async resumeAfterApproval(approvalState, approved, userFeedback = '') {
    const { pendingApproval, contents } = approvalState;
    const { toolName, toolArgs } = pendingApproval;

    console.log(`[${this.name}] Resuming after approval: ${approved ? 'APPROVED' : 'DENIED'}`);

    let toolResult;

    if (approved) {
      this.onStatus?.(`Executing ${toolName.replace(/_/g, ' ')}...`);
      toolResult = await executeTool(toolName, toolArgs);
    } else {
      toolResult = {
        success: false,
        error: `Action denied by user. ${userFeedback || 'No reason given.'}`
      };
    }

    // Add result to conversation and continue
    contents.push({
      role: 'model',
      parts: [{ functionCall: { name: toolName, args: toolArgs } }]
    });
    contents.push({
      role: 'user',
      parts: [{
        functionResponse: {
          name: toolName,
          response: toolResult
        }
      }]
    });

    // Continue the agent run with updated conversation
    return this.run(
      approved
        ? 'Continue with the next steps.'
        : `The action was denied. ${userFeedback} Please suggest alternatives.`,
      contents
    );
  }
}