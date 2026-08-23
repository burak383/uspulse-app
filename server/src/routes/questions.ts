import { Router } from 'express';
import db from '../db';
import { requireAuth, requireCouple } from '../middleware/auth';
import { newId, today } from '../util';

const router = Router();
router.use(requireAuth, requireCouple);

function questionForDay(day: string): { id: string; text: string } {
  const bank = db.prepare('SELECT id, text FROM questions_bank ORDER BY id').all() as {
    id: string;
    text: string;
  }[];
  // Deterministic pick based on the date so everyone sees the same question on the same day.
  const epochDays = Math.floor(new Date(`${day}T00:00:00Z`).getTime() / 86400000);
  const index = ((epochDays % bank.length) + bank.length) % bank.length;
  return bank[index];
}

router.get('/today', (req, res) => {
  const me = req.user!;
  const day = today();
  const question = questionForDay(day);

  const partner: any = db
    .prepare('SELECT id, name FROM users WHERE couple_id = ? AND id != ?')
    .get(me.coupleId, me.id);

  const myAnswer: any = db
    .prepare('SELECT text, created_at as at FROM answers WHERE couple_id = ? AND user_id = ? AND day = ?')
    .get(me.coupleId, me.id, day);

  const partnerAnswerRow: any = partner
    ? db
        .prepare('SELECT text, created_at as at FROM answers WHERE couple_id = ? AND user_id = ? AND day = ?')
        .get(me.coupleId, partner.id, day)
    : null;

  const bothAnswered = Boolean(myAnswer) && Boolean(partnerAnswerRow);

  res.json({
    day,
    question: question.text,
    myAnswer: myAnswer ?? null,
    partnerAnswered: Boolean(partnerAnswerRow),
    partnerAnswer: bothAnswered ? partnerAnswerRow : null,
    partnerName: partner?.name ?? null,
  });
});

router.post('/today/answer', (req, res) => {
  const { text } = req.body ?? {};
  if (!text || !String(text).trim()) {
    return res.status(400).json({ error: 'Cevap metni gerekli.' });
  }
  const me = req.user!;
  const day = today();
  const question = questionForDay(day);

  const existing = db
    .prepare('SELECT id FROM answers WHERE couple_id = ? AND user_id = ? AND day = ?')
    .get(me.coupleId, me.id, day);

  if (existing) {
    db.prepare('UPDATE answers SET text = ? WHERE id = ?').run(String(text).trim(), (existing as any).id);
  } else {
    db.prepare(
      `INSERT INTO answers (id, couple_id, user_id, day, question_id, text) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(newId(), me.coupleId, me.id, day, question.id, String(text).trim());
  }

  res.status(201).json({ day, text: String(text).trim() });
});

export default router;
