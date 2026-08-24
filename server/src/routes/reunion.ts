import { Router } from 'express';
import db from '../db';
import { requireAuth, requireCouple } from '../middleware/auth';
import { notifyPartner } from '../notify';

const router = Router();
router.use(requireAuth, requireCouple);

router.get('/', (req, res) => {
  const row = db.prepare('SELECT * FROM couples WHERE id = ?').get(req.user!.coupleId);
  res.json(row);
});

router.put('/', (req, res) => {
  const { title, location, date } = req.body ?? {};
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
