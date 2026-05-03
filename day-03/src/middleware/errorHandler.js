// Global error handler — last middleware in Express
// Handles AI-specific errors differently from general errors

export function errorHandler(err, req, res, next) {
  // Always log the full error server-side
  console.error(`[${new Date().toISOString()}] ERROR:`, {
    message: err.message,
    type: err.type,
    stack: err.stack,
    path: req.path,
    body: req.body
  });

  // AI provider errors
  if (err.type === 'AI_PROVIDER_ERROR') {
    return res.status(503).json({
      success: false,
      error: 'AI service error. Please try again shortly.',
      code: 'AI_PROVIDER_ERROR'
    });
  }

  if (err.type === 'AI_SERVICE_UNAVAILABLE') {
    return res.status(503).json({
      success: false,
      error: 'AI service is currently unavailable.',
      code: 'AI_UNAVAILABLE'
    });
  }

  if (err.type === 'AI_BLOCKED_RESPONSE') {
    return res.status(422).json({
      success: false,
      error: 'Your input could not be processed by the AI.',
      code: 'AI_BLOCKED'
    });
  }

  // JSON parse failures from AI
  if (err.message.includes('AI returned invalid JSON')) {
    return res.status(500).json({
      success: false,
      error: 'AI returned unexpected format. Please retry.',
      code: 'AI_PARSE_ERROR'
    });
  }

  // Generic server error
  res.status(err.statusCode || 500).json({
    success: false,
    error: 'Something went wrong. Please try again.',
    code: 'INTERNAL_ERROR'
  });
}