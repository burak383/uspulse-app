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

// Hesap ve tüm kişisel verilerin silinmesi (KVKK/GDPR ve Facebook'un "User
// Data Deletion" gereksinimi için gerekli): kullanıcının kendi yazdığı
// ruh hali, dokunuş, anı, günün sorusu cevabı ve plan/birikim katkılarını,
// ardından kullanıcı kaydının kendisini siler. Partnerin hesabına ve ortak
// couple kaydına dokunmaz -- sadece silinen kullanıcının kendi verileri gider.
const deleteMyData = db.transaction((userId: string) => {
  db.prepare('DELETE FROM moods WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM touches WHERE sender_id = ?').run(userId);
  db.prepare('DELETE FROM memories WHERE author_id = ?').run(userId);
  db.prepare('DELETE FROM answers WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM savings_contributions WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM plan_items WHERE added_by = ?').run(userId);
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
});

router.delete('/', requireAuth, (req, res) => {
  deleteMyData(req.user!.id);
  res.status(204).end();
});

export default router;
