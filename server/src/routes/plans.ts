import { Router } from 'express';
import db from '../db';
import { requireAuth, requireCouple } from '../middleware/auth';
import { newId } from '../util';

const router = Router();
router.use(requireAuth, requireCouple);

const CATEGORIES = ['city', 'movie', 'place', 'plan'];

router.get('/', (req, res) => {
  const { category } = req.query;
  const coupleId = req.user!.coupleId;
  const rows = category
    ? db
        .prepare(
          `SELECT p.*, u.name as addedByName FROM plan_items p
           JOIN users u ON u.id = p.added_by
           WHERE p.couple_id = ? AND p.category = ? ORDER BY p.created_at DESC`,
        )
        .all(coupleId, String(category))
    : db
        .prepare(
          `SELECT p.*, u.name as addedByName FROM plan_items p
           JOIN users u ON u.id = p.added_by
           WHERE p.couple_id = ? ORDER BY p.created_at DESC`,
        )
        .all(coupleId);
  res.json(rows);
});

router.post('/', (req, res) => {
  const { category, title, subtitle } = req.body ?? {};
  if (!category || !CATEGORIES.includes(category) || !title) {
    return res.status(400).json({ error: `category (${CATEGORIES.join('/')}) ve title gerekli.` });
  }
  const id = newId();
  db.prepare(
    `INSERT INTO plan_items (id, couple_id, category, title, subtitle, added_by) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, req.user!.coupleId, category, title, subtitle ?? null, req.user!.id);
  const row = db.prepare('SELECT * FROM plan_items WHERE id = ?').get(id);
  res.status(201).json(row);
});

router.patch('/:id', (req, res) => {
  const { done, title, subtitle, category } = req.body ?? {};
  const row: any = db
    .prepare('SELECT * FROM plan_items WHERE id = ? AND couple_id = ?')
    .get(req.params.id, req.user!.coupleId);
  if (!row) return res.status(404).json({ error: 'Bulunamadı.' });

  if (category !== undefined && !CATEGORIES.includes(category)) {
    return res.status(400).json({ error: `category ${CATEGORIES.join('/')} olmalı.` });
  }
  if (title !== undefined && !String(title).trim()) {
    return res.status(400).json({ error: 'title boş olamaz.' });
  }

  db.prepare(
    `UPDATE plan_items SET
       done = COALESCE(?, done),
       title = COALESCE(?, title),
       subtitle = CASE WHEN ? THEN ? ELSE subtitle END,
       category = COALESCE(?, category)
     WHERE id = ?`,
  ).run(
    done === undefined ? null : done ? 1 : 0,
    title === undefined ? null : String(title).trim(),
    subtitle !== undefined ? 1 : 0,
    subtitle === undefined ? null : String(subtitle).trim() || null,
    category === undefined ? null : category,
    row.id,
  );
  res.json(db.prepare('SELECT * FROM plan_items WHERE id = ?').get(row.id));
});

router.delete('/:id', (req, res) => {
  const row: any = db
    .prepare('SELECT * FROM plan_items WHERE id = ? AND couple_id = ?')
    .get(req.params.id, req.user!.coupleId);
  if (!row) return res.status(404).json({ error: 'Bulunamadı.' });
  db.prepare('DELETE FROM plan_items WHERE id = ?').run(row.id);
  res.status(204).end();
});

export default router;
