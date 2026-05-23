import { Router } from 'express';
import { loadUser, requireAuth } from '../authMiddleware.js';
import { getHistory } from './chatRepo.js';

const router = Router();

// GET /api/chat/history?room=general&limit=50
// Returns the last N messages for a room (auth required).
router.get('/history', loadUser, requireAuth, async (req, res) => {
  const roomId = req.query.room || 'general';
  const limit  = Math.min(Number(req.query.limit) || 50, 200);
  const msgs   = await getHistory(roomId, limit);
  res.json(msgs);
});

export default router;
