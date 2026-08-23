import { Router } from 'express';
import db from '../db';
import { requireAuth, requireCouple } from '../middleware/auth';
import { newId } from '../util';

const router = Router();
router.use(requireAuth, requireCouple);

const ALLOWED_MOODS = ['Neşeli', 'Sakin', 'Özlemli', 'Yorgun', 'Modunda', 'Heyecanlı'];

router.post('/', (req, res) => {
  const { mood } = req.body ?? {};
  if (!mood || !ALLOWED_MOODS.includes(mood)) {
    return res.status(400).json({ error: `Ruh hali şunlardan biri olmalı: ${ALLOWED_MOODS.join(', ')}` });
  }
  db.prepare('INSERT INTO moods (id, user_id, mood) VALUES (?, ?, ?)').run(newId(), req.user!.id, mood);
  res.status(201).json({ mood, at: new Date().toISOString() });
});

router.get('/', (req, res) => {
  const me = req.user!;
  const partner: any = db
    .prepare('SELECT id, name FROM users WHERE couple_id = ? AND id != ?')
    .get(me.coupleId, me.id);

  const latestFor = (userId: string) =>
    db
      .prepare('SELECT mood, created_at as at FROM moods WHERE user_id = ? ORDER BY created_at DESC LIMIT 1')
      .get(userId) as { mood: string; at: string } | undefined;

  res.json({
    me: latestFor(me.id) ?? null,
    partner: partner ? { name: partner.name, ...(latestFor(partner.id) ?? {}) } : null,
    availableMoods: ALLOWED_MOODS,
  });
});

export default router;
