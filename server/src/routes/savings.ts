import { Router } from 'express';
import db from '../db';
import { requireAuth, requireCouple } from '../middleware/auth';
import { newId } from '../util';

const router = Router();
router.use(requireAuth, requireCouple);

function serializeGoal(goal: any) {
  const contributions = db
    .prepare(
      `SELECT c.*, u.name as userName FROM savings_contributions c
       JOIN users u ON u.id = c.user_id
       WHERE c.goal_id = ? ORDER BY c.created_at DESC`,
    )
    .all(goal.id) as any[];
  const saved = contributions.reduce((sum, c) => sum + c.amount, 0);
  return {
    ...goal,
    savedAmount: saved,
    progress: goal.target_amount > 0 ? Math.min(1, saved / goal.target_amount) : 0,
    contributions,
  };
}

router.get('/', (req, res) => {
  const goals = db
    .prepare('SELECT * FROM savings_goals WHERE couple_id = ? ORDER BY created_at DESC')
    .all(req.user!.coupleId) as any[];
  res.json(goals.map(serializeGoal));
});

router.post('/', (req, res) => {
  const { title, targetAmount, note } = req.body ?? {};
  if (!title || !targetAmount) {
    return res.status(400).json({ error: 'title ve targetAmount gerekli.' });
  }
  const id = newId();
  db.prepare(
    `INSERT INTO savings_goals (id, couple_id, title, target_amount, note) VALUES (?, ?, ?, ?, ?)`,
  ).run(id, req.user!.coupleId, title, Number(targetAmount), note ?? null);
  const row = db.prepare('SELECT * FROM savings_goals WHERE id = ?').get(id);
  res.status(201).json(serializeGoal(row));
});

router.post('/:id/contribute', (req, res) => {
  const { amount, note } = req.body ?? {};
  if (!amount || Number(amount) <= 0) {
    return res.status(400).json({ error: 'Geçerli bir tutar gerekli.' });
  }
  const goal: any = db
    .prepare('SELECT * FROM savings_goals WHERE id = ? AND couple_id = ?')
    .get(req.params.id, req.user!.coupleId);
  if (!goal) return res.status(404).json({ error: 'Bulunamadı.' });

  db.prepare(
    `INSERT INTO savings_contributions (id, goal_id, user_id, amount, note) VALUES (?, ?, ?, ?, ?)`,
  ).run(newId(), goal.id, req.user!.id, Number(amount), note ?? null);

  res.status(201).json(serializeGoal(goal));
});

router.patch('/:id', (req, res) => {
  const { title, targetAmount, note } = req.body ?? {};
  const goal: any = db
    .prepare('SELECT * FROM savings_goals WHERE id = ? AND couple_id = ?')
    .get(req.params.id, req.user!.coupleId);
  if (!goal) return res.status(404).json({ error: 'Bulunamadı.' });
  if (title !== undefined && !String(title).trim()) {
    return res.status(400).json({ error: 'title boş olamaz.' });
  }
  if (targetAmount !== undefined && Number(targetAmount) <= 0) {
    return res.status(400).json({ error: 'targetAmount geçerli bir sayı olmalı.' });
  }

  db.prepare(
    `UPDATE savings_goals SET
       title = COALESCE(?, title),
       target_amount = COALESCE(?, target_amount),
       note = CASE WHEN ? THEN ? ELSE note END
     WHERE id = ?`,
  ).run(
    title === undefined ? null : String(title).trim(),
    targetAmount === undefined ? null : Number(targetAmount),
    note !== undefined ? 1 : 0,
    note === undefined ? null : String(note).trim() || null,
    goal.id,
  );
  res.json(serializeGoal(db.prepare('SELECT * FROM savings_goals WHERE id = ?').get(goal.id)));
});

router.delete('/:id', (req, res) => {
  const goal: any = db
    .prepare('SELECT * FROM savings_goals WHERE id = ? AND couple_id = ?')
    .get(req.params.id, req.user!.coupleId);
  if (!goal) return res.status(404).json({ error: 'Bulunamadı.' });
  db.prepare('DELETE FROM savings_contributions WHERE goal_id = ?').run(goal.id);
  db.prepare('DELETE FROM savings_goals WHERE id = ?').run(goal.id);
  res.status(204).end();
});

router.delete('/:id/contribute/:contributionId', (req, res) => {
  const goal: any = db
    .prepare('SELECT * FROM savings_goals WHERE id = ? AND couple_id = ?')
    .get(req.params.id, req.user!.coupleId);
  if (!goal) return res.status(404).json({ error: 'Bulunamadı.' });
  const contribution = db
    .prepare('SELECT id FROM savings_contributions WHERE id = ? AND goal_id = ?')
    .get(req.params.contributionId, goal.id);
  if (!contribution) return res.status(404).json({ error: 'Katkı bulunamadı.' });
  db.prepare('DELETE FROM savings_contributions WHERE id = ?').run(req.params.contributionId);
  res.json(serializeGoal(db.prepare('SELECT * FROM savings_goals WHERE id = ?').get(goal.id)));
});

export default router;
