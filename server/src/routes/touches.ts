import { Router } from 'express';
import db from '../db';
import { requireAuth, requireCouple } from '../middleware/auth';
import { newId } from '../util';

const router = Router();
router.use(requireAuth, requireCouple);

router.post('/', (req, res) => {
  const { durationMs } = req.body ?? {};
  const id = newId();
  db.prepare('INSERT INTO touches (id, couple_id, sender_id, duration_ms) VALUES (?, ?, ?, ?)').run(
    id,
    req.user!.coupleId,
    req.user!.id,
    Number(durationMs) || 0,
  );
  const row = db.prepare('SELECT * FROM touches WHERE id = ?').get(id);
  res.status(201).json(row);
});

router.get('/', (req, res) => {
  const coupleId = req.user!.coupleId;

  const days = db
    .prepare(
      `SELECT DISTINCT date(created_at) as day FROM touches WHERE couple_id = ? ORDER BY day DESC`,
    )
    .all(coupleId) as { day: string }[];

  let streak = 0;
  const cursor = new Date();
  for (let i = 0; i < 3650; i++) {
    const key = cursor.toISOString().slice(0, 10);
    const hit = days.some((d) => d.day === key);
    if (hit) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else if (i === 0) {
      // today has no touch yet - streak may still be alive via yesterday
      cursor.setDate(cursor.getDate() - 1);
      continue;
    } else {
      break;
    }
  }

  const total = db.prepare('SELECT COUNT(*) as c FROM touches WHERE couple_id = ?').get(coupleId) as {
    c: number;
  };

  const recent = db
    .prepare(
      `SELECT t.id, t.duration_ms as durationMs, t.created_at as at, u.name as senderName
       FROM touches t JOIN users u ON u.id = t.sender_id
       WHERE t.couple_id = ? ORDER BY t.created_at DESC LIMIT 10`,
    )
    .all(coupleId);

  res.json({ streakDays: streak, totalCount: total.c, recent });
});

export default router;
