import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

// ── General AI endpoint limiter ───────────────────────────────
// Applied to all /api/chat routes
export const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000,       // 1 minute window
  max: 20,                   // 20 requests per minute per user/IP
  standardHeaders: true,
  legacyHeaders: false,

  // keyGenerator receives (req, res) and must return a string key.
  // ipKeyGenerator(ip) converts an IPv6 address to its /56 subnet
  // so an entire IPv6 block doesn't bypass limits via address rotation.
  keyGenerator: (req) => {
    if (req.user?.id) return req.user.id;             // authenticated: key by user
    return ipKeyGenerator(req.ip ?? '127.0.0.1');     // anonymous: key by IP subnet
  },

  message: {
    success: false,
    error: 'Too many requests. Please wait before trying again.',
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter: '60 seconds'
  },

  skip: (req) => req.user?.role === 'admin'
});

// ── Strict limiter for streaming endpoints ────────────────────
export const streamRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,

  keyGenerator: (req) => {
    if (req.user?.id) return req.user.id;
    return ipKeyGenerator(req.ip ?? '127.0.0.1');
  },

  message: {
    success: false,
    error: 'Streaming limit reached. Maximum 10 AI requests per minute.',
    code: 'STREAM_RATE_LIMIT_EXCEEDED'
  },

  skip: (req) => req.user?.role === 'admin'
});

// ── Auth endpoint limiter ─────────────────────────────────────
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,

  keyGenerator: (req) => ipKeyGenerator(req.ip ?? '127.0.0.1'),

  message: {
    success: false,
    error: 'Too many authentication attempts. Try again in 15 minutes.',
    code: 'AUTH_RATE_LIMIT_EXCEEDED'
  }
});
