import { Router } from 'express';
import db from '../db';
import { requireAuth } from '../middleware/auth';

const router = Router();

function publicUser(row: any) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    inviteCode: row.invite_code,
    coupleId: row.couple_id,
    avatarUrl: row.avatar_url,
  };
}

router.get('/', requireAuth, (req, res) => {
  const me = req.user!;
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(me.id);
  let partner = null;
  let couple = null;
  if (me.coupleId) {
    couple = db.prepare('SELECT * FROM couples WHERE id = ?').get(me.coupleId);
    partner = db
      .prepare('SELECT * FROM users WHERE couple_id = ? AND id != ?')
      .get(me.coupleId, me.id);
  }
  res.json({
    user: publicUser(row),
    partner: partner ? publicUser(partner) : null,
    couple,
  });
});

export default router;
