import { Router } from 'express';
import db from '../db';
import { requireAuth, requireCouple } from '../middleware/auth';
import { newId } from '../util';
import { notifyPartner } from '../notify';

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

  notifyPartner({
    coupleId: req.user!.coupleId!,
    actorId: req.user!.id,
    type: 'mood',
    title: `${req.user!.name} ruh halini güncelledi`,
    body: `Şimdi "${mood}" hissediyor.`,
  });
});

router.get('/', (req, res) => {
  const me = req.user!;
  const meRow: any = db.prepare('SELECT mood_hidden FROM users WHERE id = ?').get(me.id);
  const partner: any = db
    .prepare('SELECT id, name, mood_hidden FROM users WHERE couple_id = ? AND id != ?')
    .get(me.coupleId, me.id);

  const latestFor = (userId: string) =>
    db
      .prepare('SELECT mood, created_at as at FROM moods WHERE user_id = ? ORDER BY created_at DESC LIMIT 1')
      .get(userId) as { mood: string; at: string } | undefined;

  // Partner ruh hali paylaşımını kapattıysa (mood_hidden), gerçek son ruh
  // halini partnere ASLA döndürmüyoruz -- sadece "paylaşmıyor" durumunu.
  const partnerSharing = partner ? !partner.mood_hidden : true;

  res.json({
    me: latestFor(me.id) ?? null,
    sharedByMe: !meRow?.mood_hidden,
    partner:
      partner && partnerSharing
        ? { name: partner.name, ...(latestFor(partner.id) ?? {}) }
        : partner
          ? { name: partner.name }
          : null,
    partnerSharing,
    availableMoods: ALLOWED_MOODS,
  });
});

// Ruh hali paylaşımını aç/kapat. Kapatınca geçmiş ruh hali kayıtları
// silinmez -- yalnızca partnerin GET /mood yanıtında görünmez olur, tıpkı
// konum paylaşımının kesin koordinatları hiç göstermemesi gibi.
router.put('/sharing', (req, res) => {
  const { shared } = req.body ?? {};
  if (typeof shared !== 'boolean') {
    return res.status(400).json({ error: 'shared (true/false) gerekli.' });
  }
  db.prepare('UPDATE users SET mood_hidden = ? WHERE id = ?').run(shared ? 0 : 1, req.user!.id);
  res.status(204).end();
});

export default router;
