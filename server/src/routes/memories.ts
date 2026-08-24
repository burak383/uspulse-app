import { Router } from 'express';
import db from '../db';
import { requireAuth, requireCouple } from '../middleware/auth';
import { newId } from '../util';
import { notifyPartner } from '../notify';

const TYPE_LABELS: Record<string, string> = {
  photo: 'bir fotoğraf',
  video: 'bir video',
  audio: 'bir ses notu',
  drawing: 'bir çizim',
  note: 'bir not',
  capsule: 'bir zaman kapsülü',
};

const router = Router();
router.use(requireAuth, requireCouple);

const TYPES = ['photo', 'video', 'audio', 'drawing', 'note', 'capsule'];

router.get('/', (req, res) => {
  const rows = db
    .prepare(
      `SELECT m.*, u.name as authorName FROM memories m
       JOIN users u ON u.id = m.author_id
       WHERE m.couple_id = ? ORDER BY m.created_at DESC`,
    )
    .all(req.user!.coupleId);
  res.json(rows);
});

router.post('/', (req, res) => {
  const { type, title, note, mediaUrl, unlockAt } = req.body ?? {};
  if (!type || !TYPES.includes(type) || !title) {
    return res.status(400).json({ error: `type (${TYPES.join('/')}) ve title alanları gerekli.` });
  }
  const id = newId();
  db.prepare(
    `INSERT INTO memories (id, couple_id, author_id, type, title, note, media_url, unlock_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, req.user!.coupleId, req.user!.id, type, title, note ?? null, mediaUrl ?? null, unlockAt ?? null);
  const row = db.prepare('SELECT * FROM memories WHERE id = ?').get(id);
  res.status(201).json(row);

  notifyPartner({
    coupleId: req.user!.coupleId!,
    actorId: req.user!.id,
    type: 'memory',
    title: `${req.user!.name} yeni bir anı ekledi`,
    body: `${TYPE_LABELS[type] ?? 'Yeni bir anı'}: "${title}"`,
  });
});

router.patch('/:id', (req, res) => {
  const { title, note, unlockAt } = req.body ?? {};
  const row: any = db
    .prepare('SELECT * FROM memories WHERE id = ? AND couple_id = ?')
    .get(req.params.id, req.user!.coupleId);
  if (!row) return res.status(404).json({ error: 'Bulunamadı.' });
  if (title !== undefined && !String(title).trim()) {
    return res.status(400).json({ error: 'title boş olamaz.' });
  }

  db.prepare(
    `UPDATE memories SET
       title = COALESCE(?, title),
       note = CASE WHEN ? THEN ? ELSE note END,
       unlock_at = CASE WHEN ? THEN ? ELSE unlock_at END
     WHERE id = ?`,
  ).run(
    title === undefined ? null : String(title).trim(),
    note !== undefined ? 1 : 0,
    note === undefined ? null : String(note).trim() || null,
    unlockAt !== undefined ? 1 : 0,
    unlockAt === undefined ? null : unlockAt || null,
    row.id,
  );
  res.json(db.prepare('SELECT * FROM memories WHERE id = ?').get(row.id));
});

router.delete('/:id', (req, res) => {
  const row: any = db
    .prepare('SELECT * FROM memories WHERE id = ? AND couple_id = ?')
    .get(req.params.id, req.user!.coupleId);
  if (!row) return res.status(404).json({ error: 'Bulunamadı.' });
  db.prepare('DELETE FROM memories WHERE id = ?').run(row.id);
  res.status(204).end();
});

export default router;
