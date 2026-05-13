// Global error handler
// Must be the LAST middleware registered in app.js
// Signature must have 4 params — Express detects this as error handler

export function errorHandler(err, req, res, next) {

  // Always log full error server-side
  // In production: send to CloudWatch / Datadog / Sentry
  console.error(`[ERROR] ${new Date().toISOString()}`, {
    message: err.message,
    type: err.type,
    statusCode: err.statusCode,
    path: req.path,
    method: req.method,
    userId: req.user?.id || 'unauthenticated',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });

  // ── AI Provider errors ──────────────────────────────────────
  if (err.type === 'AI_PROVIDER_ERROR') {
    return res.status(503).json({
      success: false,
      error: 'AI service is temporarily unavailable. Please try again.',
      code: 'AI_PROVIDER_ERROR'
    });
  }

  if (err.type === 'AI_SERVICE_UNAVAILABLE') {
    return res.status(503).json({
      success: false,
      error: 'AI service is not reachable. Please try again shortly.',
      code: 'AI_UNAVAILABLE'
    });
  }

  if (err.type === 'AI_BLOCKED_RESPONSE') {
    return res.status(422).json({
      success: false,
      error: 'Your request could not be processed by the AI.',
      code: 'AI_BLOCKED'
    });
  }

  // ── JSON parse failure from AI output ──────────────────────
  if (err.message?.includes('AI returned invalid JSON')) {
    return res.status(500).json({
      success: false,
      error: 'AI returned an unexpected format. Please retry.',
      code: 'AI_PARSE_ERROR'
    });
  }

  // ── Mongoose validation errors ──────────────────────────────
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({
      success: false,
      error: 'Validation failed.',
      errors,
      code: 'VALIDATION_ERROR'
    });
  }

  // ── Mongoose duplicate key error ────────────────────────────
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return res.status(409).json({
      success: false,
      error: `${field} already exists.`,
      code: 'DUPLICATE_ERROR'
    });
  }

  // ── Mongoose cast error (invalid ObjectId) ──────────────────
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      error: 'Invalid ID format.',
      code: 'INVALID_ID'
    });
  }

  // ── JWT errors (shouldn't reach here — caught in middleware) ─
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: 'Invalid token.',
      code: 'INVALID_TOKEN'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: 'Token expired. Please login again.',
      code: 'TOKEN_EXPIRED'
    });
  }

  // ── Custom app errors with statusCode ──────────────────────
  if (err.statusCode) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code || 'APP_ERROR'
    });
  }

  // ── Fallback: generic 500 ───────────────────────────────────
  res.status(500).json({
    success: false,
    error: 'Something went wrong. Please try again.',
    code: 'INTERNAL_ERROR'
  });
}