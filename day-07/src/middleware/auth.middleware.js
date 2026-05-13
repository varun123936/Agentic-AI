import jwt from 'jsonwebtoken';
import { User } from '../models/user.model.js';

// ── Main auth middleware ──────────────────────────────────────
export async function authenticate(req, res, next) {
  try {
    // 1. Extract token from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Access denied. No token provided.',
        code: 'NO_TOKEN'
      });
    }

    const token = authHeader.split(' ')[1];

    // 2. Verify token signature and expiry
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: 'Token expired. Please login again.',
          code: 'TOKEN_EXPIRED'
        });
      }
      return res.status(401).json({
        success: false,
        error: 'Invalid token.',
        code: 'INVALID_TOKEN'
      });
    }

    // 3. Check user still exists and is active
    // Important: user might be deactivated after token was issued
    const user = await User.findById(decoded.userId).select('-password');

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'User not found or deactivated.',
        code: 'USER_NOT_FOUND'
      });
    }

    // 4. Attach user to request — available in all next middleware
    req.user = {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      dailyTokenLimit: user.dailyTokenLimit,
      tokensUsedToday: user.tokensUsedToday
    };

    next();

  } catch (error) {
    console.error('[AUTH] Middleware error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Authentication error.',
      code: 'AUTH_ERROR'
    });
  }
}

// ── Admin only middleware ─────────────────────────────────────
// Use AFTER authenticate
export function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Admin access required.',
      code: 'FORBIDDEN'
    });
  }
  next();
}

// ── Token budget middleware ───────────────────────────────────
// Checks if user has remaining daily token budget
export async function checkTokenBudget(req, res, next) {
  try {
    const user = await User.findById(req.user.id);

    // Check if it's a new day and reset tokens if so
    const now = new Date();
    const resetDate = new Date(user.tokenResetDate);
    const isNewDay = now.toDateString() !== resetDate.toDateString();

    if (isNewDay) {
      // Persist the reset to DB so it's durable
      await User.findByIdAndUpdate(user._id, {
        tokensUsedToday: 0,
        tokenResetDate: now
      });
      user.tokensUsedToday = 0;
      user.tokenResetDate = now;
    }

    const budget = {
      allowed: user.tokensUsedToday < user.dailyTokenLimit,
      used: user.tokensUsedToday,
      limit: user.dailyTokenLimit,
      remaining: user.dailyTokenLimit - user.tokensUsedToday
    };

    if (!budget.allowed) {
      return res.status(429).json({
        success: false,
        error: 'Daily token limit reached. Resets at midnight.',
        code: 'TOKEN_BUDGET_EXCEEDED',
        data: {
          used: budget.used,
          limit: budget.limit,
          remaining: 0
        }
      });
    }

    // Attach budget info for use in routes
    req.tokenBudget = budget;
    next();

  } catch (error) {
    next(error);
  }
}
