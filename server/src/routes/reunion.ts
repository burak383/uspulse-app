import { Router } from 'express';
import db from '../db';
import { requireAuth, requireCouple } from '../middleware/auth';

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
  const row = db.prepare('SELECT * FROM couples WHERE id = ?').get(req.user!.coupleId);
  res.json(row);
});

export default router;
