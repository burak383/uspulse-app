import path from 'node:path';
import fs from 'node:fs';
import { Router } from 'express';
import db from '../db';
import { requireAuth, requireCouple } from '../middleware/auth';
import { newId } from '../util';
import { notifyPartner } from '../notify';
import { uploadMemoryMedia, mediaRuleFor, deleteUploadedMediaByUrl, UPLOADS_DIR } from '../uploads';

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
// Bu tipler gerçek bir medya dosyası (multipart/form-data, "media" alanı) gerektirir.
const MEDIA_TYPES = ['photo', 'video', 'audio'];

// "MÜHÜRLÜ" zaman kapsülleri gerçekten mühürlü olsun: açılma tarihi henüz
// gelmediyse, kapsülü OLUŞTURAN kişi dışında kimse (yani partner) note/
// media_url alanlarını göremez -- API'yi doğrudan çağırsa bile. Kapsülü
// oluşturan kendi yazdığını her zaman görür/düzenleyebilir (bir sürpriz
// kendinden saklanmaz, sadece partnerden saklanır).
function isCapsuleLockedFor(row: any, viewerId: string): boolean {
  if (row.type !== 'capsule' || !row.unlock_at || row.author_id === viewerId) return false;
  const unlockTime = Date.parse(row.unlock_at);
  return !Number.isNaN(unlockTime) && unlockTime > Date.now();
}

function decorateMemory(row: any, viewerId: string) {
  if (isCapsuleLockedFor(row, viewerId)) {
    return { ...row, note: null, media_url: null, locked: true };
  }
  return { ...row, locked: false };
}

router.get('/', (req, res) => {
  const rows = db
    .prepare(
      `SELECT m.*, u.name as authorName FROM memories m
       JOIN users u ON u.id = m.author_id
       WHERE m.couple_id = ? ORDER BY m.created_at DESC`,
    )
    .all(req.user!.coupleId) as any[];
  res.json(rows.map((row) => decorateMemory(row, req.user!.id)));
});

// multer'ı elle sarmalıyoruz ki dosya-boyutu gibi hataları (LIMIT_FILE_SIZE)
// genel 500 hata sayfası yerine düzgün bir 413/400 yanıtına çevirebilelim.
function handleMediaUpload(req: any, res: any, next: any) {
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

router.post('/', handleMediaUpload, (req, res) => {
  const { type, title, note, unlockAt, mediaUrl: rawMediaUrl } = req.body ?? {};
  const file = (req as any).file as Express.Multer.File | undefined;

  const cleanupFile = () => {
    if (file) fs.promises.unlink(file.path).catch(() => {});
  };

  if (!type || !TYPES.includes(type) || !title || !String(title).trim()) {
    cleanupFile();
    return res.status(400).json({ error: `type (${TYPES.join('/')}) ve title alanları gerekli.` });
  }

  let mediaUrl: string | null = null;

  if (MEDIA_TYPES.includes(type)) {
    if (!file) {
      return res.status(400).json({ error: `${type} tipi bir anı için bir medya dosyası (media) gerekli.` });
    }
    const rule = mediaRuleFor(type)!;
    if (!file.mimetype.startsWith(rule.mimePrefix)) {
      cleanupFile();
      return res
        .status(400)
        .json({ error: `Geçersiz dosya türü. ${type} için ${rule.mimePrefix}* bekleniyor.` });
    }
    if (file.size > rule.maxBytes) {
      cleanupFile();
      return res
        .status(413)
        .json({ error: `Dosya çok büyük (azami ${Math.round(rule.maxBytes / 1024 / 1024)}MB).` });
    }
    const relative = path.relative(UPLOADS_DIR, file.path).split(path.sep).join('/');
    mediaUrl = `${req.protocol}://${req.get('host')}/uploads/${relative}`;
  } else {
    // note/capsule/drawing bir dosya beklemez; yanlışlıkla gönderildiyse temizle.
    cleanupFile();
    if (typeof rawMediaUrl === 'string' && rawMediaUrl.trim()) {
      mediaUrl = rawMediaUrl.trim();
    }
  }

  const id = newId();
  db.prepare(
    `INSERT INTO memories (id, couple_id, author_id, type, title, note, media_url, unlock_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    req.user!.coupleId,
    req.user!.id,
    type,
    String(title).trim(),
    note ? String(note).trim() || null : null,
    mediaUrl,
    unlockAt || null,
  );
  const row = db.prepare('SELECT * FROM memories WHERE id = ?').get(id);
  res.status(201).json(decorateMemory(row, req.user!.id));

  notifyPartner({
    coupleId: req.user!.coupleId!,
    actorId: req.user!.id,
    type: 'memory',
    title: `${req.user!.name} yeni bir anı ekledi`,
    body: `${TYPE_LABELS[type] ?? 'Yeni bir anı'}: "${title}"`,
  });
});

router.patch('/:id', (req, res) => {
  const { title, unlockAt } = req.body ?? {};
  let { note } = req.body ?? {};
  const row: any = db
    .prepare('SELECT * FROM memories WHERE id = ? AND couple_id = ?')
    .get(req.params.id, req.user!.coupleId);
  if (!row) return res.status(404).json({ error: 'Bulunamadı.' });
  if (title !== undefined && !String(title).trim()) {
    return res.status(400).json({ error: 'title boş olamaz.' });
  }

  // Kapsül henüz kilitliyse (bkz. isCapsuleLockedFor) -- yani bu isteği yapan
  // kişi kapsülü oluşturan değilse ve açılma tarihi gelmediyse -- gizli
  // içeriği ne görebilir ne de üzerine yazabilir. İstek gövdesinde ne
  // gönderilirse gönderilsin note güncellemesini yok sayıyoruz; yoksa
  // mobil tarafta "görünmeyen" boş bir alanı kaydetmek gerçek içeriği
  // sessizce silebilir.
  if (isCapsuleLockedFor(row, req.user!.id)) {
    note = undefined;
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
  res.json(decorateMemory(db.prepare('SELECT * FROM memories WHERE id = ?').get(row.id), req.user!.id));
});

router.delete('/:id', (req, res) => {
  const row: any = db
    .prepare('SELECT * FROM memories WHERE id = ? AND couple_id = ?')
    .get(req.params.id, req.user!.coupleId);
  if (!row) return res.status(404).json({ error: 'Bulunamadı.' });
  db.prepare('DELETE FROM memories WHERE id = ?').run(row.id);
  // Anı satırıyla birlikte, varsa diskteki gerçek medya dosyasını da temizle.
  deleteUploadedMediaByUrl(row.media_url);
  res.status(204).end();
});

export default router;
