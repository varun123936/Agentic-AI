import express from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { User } from '../models/user.model.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = express.Router();

// Strict rate limit on auth endpoints — prevents brute force attacks
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 minutes
  max: 10,                     // 10 attempts per 15 min per IP
  standardHeaders: true,
  legacyHeaders: false,
  // ipKeyGenerator(ip) normalises IPv6 to /56 subnet to prevent bypass via address rotation
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? '127.0.0.1'),
  message: {
    success: false,
    error: 'Too many attempts. Try again in 15 minutes.',
    code: 'AUTH_RATE_LIMIT_EXCEEDED'
  }
});

// Helper: generate a signed JWT for a user ID
function generateToken(userId) {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

// ── POST /api/auth/register ───────────────────────────────────
router.post('/register', authLimiter, async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const errors = [];
    if (!name?.trim()) errors.push('name is required');
    if (!email?.trim()) errors.push('email is required');
    if (!password) errors.push('password is required');
    if (password && password.length < 8) errors.push('password must be at least 8 characters');

    if (errors.length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'Email already registered.'
      });
    }

    // password is hashed automatically via pre-save hook in user.model.js
    const user = await User.create({ name, email, password });
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'Registration successful.',
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      }
    });

  } catch (error) {
    console.error('[AUTH] Register error:', error.message);
    res.status(500).json({ success: false, error: 'Registration failed.' });
  }
});

// ── POST /api/auth/login ──────────────────────────────────────
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required.'
      });
    }

    // select('+password') because password field has select: false in schema
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password.'
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password.'
      });
    }

    user.lastLoginAt = new Date();
    await user.save({ validateBeforeSave: false });

    const token = generateToken(user._id);

    res.json({
      success: true,
      message: 'Login successful.',
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          dailyTokenLimit: user.dailyTokenLimit,
          tokensUsedToday: user.tokensUsedToday
        }
      }
    });

  } catch (error) {
    console.error('[AUTH] Login error:', error.message);
    res.status(500).json({ success: false, error: 'Login failed.' });
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }
    res.json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        dailyTokenLimit: user.dailyTokenLimit,
        tokensUsedToday: user.tokensUsedToday,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── POST /api/auth/logout ─────────────────────────────────────
// JWT is stateless — actual logout happens client-side by deleting the token.
// For production: maintain a token blacklist in Redis with TTL = token expiry.
router.post('/logout', authenticate, (req, res) => {
  res.json({
    success: true,
    message: 'Logged out. Please delete your token on the client side.'
  });
});

export default router;
