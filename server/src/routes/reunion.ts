import { Router } from 'express';
import db from '../db';
import { requireAuth, requireCouple } from '../middleware/auth';
import { requireEntitlement } from '../middleware/subscription';
import { rateLimitPerUser } from '../middleware/rateLimit';
import { notifyPartner } from '../notify';

const router = Router();
router.use(requireAuth, requireCouple, requireEntitlement);

const MAX_TEXT_LENGTH = 200;
// YYYY-MM-DD -- mobil taraf tarihi bu biçimde gönderiyor; herhangi bir
// string (hatta obje/array) kabul edip doğrudan SQLite'a yazmak hem
// better-sqlite3'te bind hatasına (500) hem de mobildeki geri sayımın
// bozulmasına yol açabiliyordu.
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

router.get('/', (req, res) => {
  const row = db.prepare('SELECT * FROM couples WHERE id = ?').get(req.user!.coupleId);
  res.json(row);
});

router.put('/', rateLimitPerUser('reunion', 10, 60 * 1000), (req, res) => {
  const { title, location, date } = req.body ?? {};
  if (title !== undefined && title !== null && (typeof title !== 'string' || title.length > MAX_TEXT_LENGTH)) {
    return res.status(400).json({ error: `title en fazla ${MAX_TEXT_LENGTH} karakterlik bir metin olmalı.` });
  }
  if (location !== undefined && location !== null && (typeof location !== 'string' || location.length > MAX_TEXT_LENGTH)) {
    return res.status(400).json({ error: `location en fazla ${MAX_TEXT_LENGTH} karakterlik bir metin olmalı.` });
  }
  if (date !== undefined && date !== null && (typeof date !== 'string' || !DATE_RE.test(date))) {
    return res.status(400).json({ error: 'date, YYYY-MM-DD biçiminde bir metin olmalı.' });
  }
  db.prepare(
    'UPDATE couples SET reunion_title = ?, reunion_location = ?, reunion_date = ? WHERE id = ?',
  ).run(title ?? null, location ?? null, date ?? null, req.user!.coupleId);
  const row: any = db.prepare('SELECT * FROM couples WHERE id = ?').get(req.user!.coupleId);
  res.json(row);

  notifyPartner({
    coupleId: req.user!.coupleId!,
    actorId: req.user!.id,
    type: 'reunion_update',
    title: `${req.user!.name} buluşma planını güncelledi`,
    body: row.reunion_date
      ? `${row.reunion_title ?? 'Buluşma'} · ${row.reunion_date}`
      : 'Yeni bir buluşma detayı eklendi.',
  });
});

export default router;
