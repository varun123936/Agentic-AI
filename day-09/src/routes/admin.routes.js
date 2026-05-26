import express from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.middleware.js';
import { User } from '../models/user.model.js';
import { AiUsage } from '../models/aiUsage.model.js';
import { Conversation } from '../models/conversation.model.js';

const router = express.Router();

// All admin routes require authentication + admin role
router.use(authenticate, requireAdmin);

// ── GET /api/admin/users ──────────────────────────────────────
router.get('/users', async (req, res) => {
  try {
    const users = await User.find()
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── GET /api/admin/usage ──────────────────────────────────────
// Overall token usage across all users
router.get('/usage', async (req, res) => {
  try {
    const usage = await AiUsage.aggregate([
      {
        $group: {
          _id: {
            provider: '$provider',
            model: '$model'
          },
          totalTokens: { $sum: '$totalTokens' },
          totalCostUsd: { $sum: '$estimatedCostUsd' },
          requestCount: { $sum: 1 }
        }
      },
      { $sort: { totalTokens: -1 } }
    ]);

    // Daily usage trend (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const dailyTrend = await AiUsage.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          totalTokens: { $sum: '$totalTokens' },
          totalCostUsd: { $sum: '$estimatedCostUsd' },
          requests: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      data: { byProvider: usage, dailyTrend }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── GET /api/admin/stats ──────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const [totalUsers, totalConversations, usageSummary] = await Promise.all([
      User.countDocuments(),
      Conversation.countDocuments(),
      AiUsage.aggregate([{
        $group: {
          _id: null,
          totalTokens: { $sum: '$totalTokens' },
          totalCostUsd: { $sum: '$estimatedCostUsd' },
          totalRequests: { $sum: 1 }
        }
      }])
    ]);

    res.json({
      success: true,
      data: {
        totalUsers,
        totalConversations,
        totalTokens: usageSummary[0]?.totalTokens || 0,
        totalCostUsd: usageSummary[0]?.totalCostUsd || 0,
        totalRequests: usageSummary[0]?.totalRequests || 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── PATCH /api/admin/users/:id/token-limit ────────────────────
router.patch('/users/:id/token-limit', async (req, res) => {
  try {
    const { dailyTokenLimit } = req.body;

    if (!dailyTokenLimit || dailyTokenLimit < 1000) {
      return res.status(400).json({
        success: false,
        error: 'dailyTokenLimit must be at least 1000'
      });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { dailyTokenLimit },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;