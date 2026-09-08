import { Router } from 'express';
import db from '../db';
import { requireAuth, requireCouple } from '../middleware/auth';
import { requireEntitlement } from '../middleware/subscription';
import { rateLimitPerUser } from '../middleware/rateLimit';
import { newId } from '../util';
import { notifyPartner } from '../notify';

const router = Router();
router.use(requireAuth, requireCouple, requireEntitlement);

// Bir dakikada en fazla 20 dokunuş -- her biri partnerin telefonunu titreten
// gerçek zamanlı bir push bildirimi tetiklediği için, limit olmadan bu uç
// partneri sonsuz bildirim/titreşimle taciz etmek için kötüye kullanılabilirdi.
router.post('/', rateLimitPerUser('touches', 20, 60 * 1000), (req, res) => {
  const { durationMs } = req.body ?? {};
  const duration = Number(durationMs);
  if (durationMs !== undefined && (!Number.isFinite(duration) || duration < 0 || duration > 24 * 60 * 60 * 1000)) {
    return res.status(400).json({ error: 'Geçerli bir durationMs gerekli.' });
  }
  const id = newId();
  db.prepare('INSERT INTO touches (id, couple_id, sender_id, duration_ms) VALUES (?, ?, ?, ?)').run(
    id,
    req.user!.coupleId,
    req.user!.id,
    Number.isFinite(duration) ? duration : 0,
  );
  const row = db.prepare('SELECT * FROM touches WHERE id = ?').get(id);
  res.status(201).json(row);

  // Partnerin telefonunu o anda titret -- yanıtı bu yüzden burada, önce
  // gönderiyoruz; bildirim gönderimi yavaş ya da başarısız olsa bile isteği
  // beklemesin/başarısız etmesin (bkz. notify.ts).
  notifyPartner({
    coupleId: req.user!.coupleId!,
    actorId: req.user!.id,
    type: 'touch',
    title: `${req.user!.name} sana bir kalp gönderdi 💗`,
    body: 'Uzaklığı bir anlığına kapatın -- dokun ve hisset.',
  });
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
