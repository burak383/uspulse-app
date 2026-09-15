import { Router } from 'express';
import db from '../db';
import { requireAuth, requireCouple } from '../middleware/auth';
import { requireEntitlement } from '../middleware/subscription';
import { rateLimitPerUser } from '../middleware/rateLimit';
import { notifyPartner } from '../notify';

const router = Router();
router.use(requireAuth, requireCouple, requireEntitlement);

// Soru/seçenek metinleri istemcide yaşıyor (bkz. mobile/src/quiz/askDili.ts
// başındaki açıklama) -- sunucu yalnızca bu 5 kategori anahtarını ve
// puanlarını bilir. Sıra, eşit puan durumunda hangi kategorinin "baskın"
// sayılacağını belirleyen sabit bir tercih sırası olarak da kullanılıyor.
const LOVE_LANGUAGE_KEYS = ['words', 'time', 'gifts', 'acts', 'touch'] as const;
type LoveLanguageKey = (typeof LOVE_LANGUAGE_KEYS)[number];

const QUESTION_COUNT = 10;

function computeTopLanguage(scores: Record<LoveLanguageKey, number>): LoveLanguageKey {
  let best: LoveLanguageKey = LOVE_LANGUAGE_KEYS[0];
  for (const key of LOVE_LANGUAGE_KEYS) {
    if (scores[key] > scores[best]) best = key;
  }
  return best;
}

function rowToResult(row: any) {
  if (!row) return null;
  return {
    scores: JSON.parse(row.scores),
    topLanguage: row.top_language,
    at: row.created_at,
  };
}

router.get('/', (req, res) => {
  const me = req.user!;
  const meRow = db.prepare('SELECT scores, top_language, created_at FROM love_language_results WHERE user_id = ?').get(me.id);
  const partnerUser: any = db
    .prepare('SELECT id FROM users WHERE couple_id = ? AND id != ?')
    .get(me.coupleId, me.id);
  const partnerRow = partnerUser
    ? db
        .prepare('SELECT scores, top_language, created_at FROM love_language_results WHERE user_id = ?')
        .get(partnerUser.id)
    : null;

  res.json({
    me: rowToResult(meRow),
    partner: rowToResult(partnerRow),
  });
});

// Testi (yeniden) tamamlama -- dakikada 5 ile sınırlı, bu bir sohbet/ruh hali
// gibi sık tekrarlanan bir eylem değil, bu yüzden düşük bir eşik yeterli.
router.post('/', rateLimitPerUser('love-language', 5, 60 * 1000), (req, res) => {
  const { scores } = req.body ?? {};
  if (!scores || typeof scores !== 'object') {
    return res.status(400).json({ error: 'scores nesnesi gerekli.' });
  }

  const parsed: Partial<Record<LoveLanguageKey, number>> = {};
  let total = 0;
  for (const key of LOVE_LANGUAGE_KEYS) {
    const value = scores[key];
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > QUESTION_COUNT) {
      return res.status(400).json({ error: `scores.${key} 0-${QUESTION_COUNT} arası bir tam sayı olmalı.` });
    }
    parsed[key] = value;
    total += value;
  }
  if (total !== QUESTION_COUNT) {
    return res
      .status(400)
      .json({ error: `Puanların toplamı ${QUESTION_COUNT} olmalı (${QUESTION_COUNT} soru, her biri 1 puan).` });
  }

  const finalScores = parsed as Record<LoveLanguageKey, number>;
  const topLanguage = computeTopLanguage(finalScores);

  db.prepare(
    `INSERT INTO love_language_results (user_id, couple_id, scores, top_language, created_at)
     VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT(user_id) DO UPDATE SET
       scores = excluded.scores,
       top_language = excluded.top_language,
       created_at = excluded.created_at`,
  ).run(req.user!.id, req.user!.coupleId, JSON.stringify(finalScores), topLanguage);

  const row: any = db
    .prepare('SELECT scores, top_language, created_at FROM love_language_results WHERE user_id = ?')
    .get(req.user!.id);
  res.status(201).json(rowToResult(row));

  notifyPartner({
    coupleId: req.user!.coupleId!,
    actorId: req.user!.id,
    type: 'love_language',
    title: `${req.user!.name} aşk dili testini tamamladı`,
    body: 'Sonucunu görmek ve kendi testini yapmak için dokun.',
  });
});

export default router;
