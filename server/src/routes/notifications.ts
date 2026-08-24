import { Router } from 'express';
import db from '../db';
import { requireAuth, requireCouple } from '../middleware/auth';

const router = Router();
router.use(requireAuth, requireCouple);

router.get('/', (req, res) => {
  const me = req.user!;
  const items = db
    .prepare(
      `SELECT n.id, n.type, n.title, n.body, n.read_at as readAt, n.created_at as at, u.name as actorName
       FROM notifications n JOIN users u ON u.id = n.actor_id
       WHERE n.recipient_id = ? ORDER BY n.created_at DESC LIMIT 50`,
    )
    .all(me.id);
  const unread = db
    .prepare('SELECT COUNT(*) as c FROM notifications WHERE recipient_id = ? AND read_at IS NULL')
    .get(me.id) as { c: number };
  res.json({ items, unreadCount: unread.c });
});

// Zil ikonu açıldığında görülen bildirimler okunmuş sayılır.
router.post('/read-all', (req, res) => {
  db.prepare(
    `UPDATE notifications SET read_at = datetime('now') WHERE recipient_id = ? AND read_at IS NULL`,
  ).run(req.user!.id);
  res.status(204).end();
});

export default router;
