import path from 'node:path';
import fs from 'node:fs';
import { Router } from 'express';
import db from '../db';
import { requireAuth, requireCouple } from '../middleware/auth';
import { requireEntitlement } from '../middleware/subscription';
import { rateLimitPerUser } from '../middleware/rateLimit';
import { newId } from '../util';
import { notifyPartner } from '../notify';
import { uploadMemoryMedia, mediaRuleFor, UPLOADS_DIR } from '../uploads';

const router = Router();
router.use(requireAuth, requireCouple, requireEntitlement);

const MAX_TEXT_LENGTH = 2000;
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

// multer'ı elle sarmalıyoruz ki dosya-boyutu gibi hataları (LIMIT_FILE_SIZE)
// genel 500 hata sayfası yerine düzgün bir 413/400 yanıtına çevirebilelim
// (bkz. routes/memories.ts'teki aynı desen).
function handleAudioUpload(req: any, res: any, next: any) {
  uploadMemoryMedia.single('media')(req, res, (err: any) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'Dosya çok büyük.' });
      }
      return res.status(400).json({ error: 'Dosya yüklenemedi.' });
    }
    next();
  });
}

// Mesaj geçmişi KRONOLOJİK sırayla (eski -> yeni) döner -- mobil taraf bunu
// doğrudan bir ters çevrilmiş (inverted) olmayan bir listeye basıp en alta
// kaydırabilsin diye. ?before=<mesaj id> ile geriye doğru sayfalama yapılır:
// o mesajdan daha eski olan bir sonraki sayfa gelir.
router.get('/', (req, res) => {
  const { before, limit } = req.query;
  const take = Math.min(Math.max(Number(limit) || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);

  let rows: any[];
  if (typeof before === 'string' && before) {
    const anchor: any = db
      .prepare('SELECT created_at FROM messages WHERE id = ? AND couple_id = ?')
      .get(before, req.user!.coupleId);
    if (!anchor) return res.status(404).json({ error: 'Bulunamadı.' });
    rows = db
      .prepare(
        `SELECT * FROM messages WHERE couple_id = ? AND created_at < ? ORDER BY created_at DESC LIMIT ?`,
      )
      .all(req.user!.coupleId, anchor.created_at, take);
  } else {
    rows = db
      .prepare(`SELECT * FROM messages WHERE couple_id = ? ORDER BY created_at DESC LIMIT ?`)
      .all(req.user!.coupleId, take);
  }

  res.json({
    messages: rows.reverse(),
    hasMore: rows.length === take,
  });
});

// Dakikada en fazla 30 mesaj -- her biri partnere gerçek zamanlı bir push
// bildirimi tetikliyor (bkz. touches.ts/mood.ts'teki aynı gerekçe); sohbet
// doğası gereği diğer uçlardan daha sık kullanılacağı için sınır biraz daha
// gevşek tutuldu.
router.post('/', rateLimitPerUser('messages', 30, 60 * 1000), (req, res) => {
  const { text } = req.body ?? {};
  if (!text || !String(text).trim()) {
    return res.status(400).json({ error: 'text gerekli.' });
  }
  if (String(text).length > MAX_TEXT_LENGTH) {
    return res.status(400).json({ error: `text en fazla ${MAX_TEXT_LENGTH} karakter olabilir.` });
  }
  const id = newId();
  const trimmed = String(text).trim();
  db.prepare(`INSERT INTO messages (id, couple_id, sender_id, type, text) VALUES (?, ?, ?, 'text', ?)`).run(
    id,
    req.user!.coupleId,
    req.user!.id,
    trimmed,
  );
  const row = db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
  res.status(201).json(row);

  notifyPartner({
    coupleId: req.user!.coupleId!,
    actorId: req.user!.id,
    type: 'message',
    title: req.user!.name,
    body: trimmed.length > 120 ? `${trimmed.slice(0, 117)}...` : trimmed,
  });
});

router.post('/audio', rateLimitPerUser('messages', 30, 60 * 1000), handleAudioUpload, (req, res) => {
  const file = (req as any).file as Express.Multer.File | undefined;
  const { durationMs } = req.body ?? {};

  const cleanupFile = () => {
    if (file) fs.promises.unlink(file.path).catch(() => {});
  };

  if (!file) {
    return res.status(400).json({ error: 'Bir ses dosyası (media) gerekli.' });
  }
  const rule = mediaRuleFor('audio')!;
  if (!rule.allowedMimes.includes(file.mimetype)) {
    cleanupFile();
    return res
      .status(400)
      .json({ error: `Geçersiz dosya türü. Desteklenen türler: ${rule.allowedMimes.join(', ')}.` });
  }
  if (file.size > rule.maxBytes) {
    cleanupFile();
    return res
      .status(413)
      .json({ error: `Dosya çok büyük (azami ${Math.round(rule.maxBytes / 1024 / 1024)}MB).` });
  }

  const relative = path.relative(UPLOADS_DIR, file.path).split(path.sep).join('/');
  const mediaUrl = `${req.protocol}://${req.get('host')}/uploads/${relative}`;
  const duration = Number(durationMs);

  const id = newId();
  db.prepare(
    `INSERT INTO messages (id, couple_id, sender_id, type, media_url, duration_ms) VALUES (?, ?, ?, 'audio', ?, ?)`,
  ).run(id, req.user!.coupleId, req.user!.id, mediaUrl, Number.isFinite(duration) ? Math.round(duration) : null);
  const row = db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
  res.status(201).json(row);

  notifyPartner({
    coupleId: req.user!.coupleId!,
    actorId: req.user!.id,
    type: 'message',
    title: req.user!.name,
    body: 'Sana bir sesli mesaj gönderdi 🎤',
  });
});

// Partnerin gönderdiği, henüz okunmamış mesajları okundu olarak işaretler --
// kendi gönderdiklerimizi asla "okundu" yapmıyoruz (sender_id != ?).
router.put('/read', (req, res) => {
  db.prepare(
    `UPDATE messages SET read_at = datetime('now') WHERE couple_id = ? AND sender_id != ? AND read_at IS NULL`,
  ).run(req.user!.coupleId, req.user!.id);
  res.status(204).end();
});

export default router;
