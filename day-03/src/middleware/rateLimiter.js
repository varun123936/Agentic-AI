import rateLimit from 'express-rate-limit';

// Per-user rate limit on AI endpoints
// Prevents one user from draining your entire API budget

export const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000,   // 1 minute window
  max: 10,               // max 10 AI requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests. Please wait before trying again.',
    retryAfter: '60 seconds'
  },
  // In production: use Redis store so limit works across multiple servers
  // import { RedisStore } from 'rate-limit-redis'
});

// Stricter limit for expensive operations
export const strictAiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  message: {
    success: false,
    error: 'This operation is limited to 3 requests per minute.'
  }
});