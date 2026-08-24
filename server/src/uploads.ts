import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { newId } from './util';

// Render'ın ücretsiz planında dosya sistemi kalıcı değil (bkz. index.ts'teki
// AUTO_SEED açıklaması ve db.ts'teki DB_PATH deseni) -- bu yüzden yüklenen
// anı medyalarını (fotoğraf/video/ses) da SQLite dosyasıyla aynı mantıkla,
// UPLOADS_DIR altında gerçek dosyalar olarak saklıyoruz. Kullanıcı Render'ın
// ücretli planına (kalıcı disk) geçtiğinde bu klasörü o diske bağlaması
// yeterli olacak -- kod tarafında hiçbir değişiklik gerekmeyecek.
export const UPLOADS_DIR = process.env.UPLOADS_DIR || './data/uploads';

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Anı tipine göre kabul edilen MIME türleri ve azami dosya boyutu.
const MEDIA_RULES: Record<string, { mimePrefix: string; maxBytes: number }> = {
  photo: { mimePrefix: 'image/', maxBytes: 8 * 1024 * 1024 }, // ~8MB
  video: { mimePrefix: 'video/', maxBytes: 50 * 1024 * 1024 }, // ~50MB
  audio: { mimePrefix: 'audio/', maxBytes: 15 * 1024 * 1024 }, // ~15MB
};

export function mediaRuleFor(type: string) {
  return MEDIA_RULES[type];
}

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/heic': '.heic',
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/3gpp': '.3gp',
  'audio/mp4': '.m4a',
  'audio/aac': '.m4a',
  'audio/mpeg': '.mp3',
  'audio/wav': '.wav',
  'audio/x-wav': '.wav',
  'audio/webm': '.webm',
};

function extFor(mimetype: string, originalname: string) {
  if (EXT_BY_MIME[mimetype]) return EXT_BY_MIME[mimetype];
  const fromName = path.extname(originalname);
  return fromName || '';
}

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    // req.user, requireAuth middleware'i multer'dan ÖNCE çalıştığı için burada
    // her zaman dolu -- bkz. routes/memories.ts'teki router.use(requireAuth, ...)
    const coupleId = (req as any).user?.coupleId || 'misc';
    const dir = path.join(UPLOADS_DIR, coupleId);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    cb(null, `${newId()}${extFor(file.mimetype, file.originalname)}`);
  },
});

// En büyük olası dosya (video, 50MB) baz alınarak genel bir üst sınır -- tipe
// özgü asıl sınır (fileFilter sonrası) route içinde ayrıca kontrol ediliyor.
export const uploadMemoryMedia = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
});

// UPLOADS_DIR altındaki bir dosyayı, verilen public medya URL'sinden
// (ör. https://.../uploads/<coupleId>/<dosya>) yola çevirip siler. URL bizim
// kendi /uploads yolumuza ait değilse (örn. eski/harici bir bağlantıysa)
// hiçbir şey yapmaz.
export function deleteUploadedMediaByUrl(mediaUrl: string | null | undefined) {
  if (!mediaUrl) return;
  const marker = '/uploads/';
  const idx = mediaUrl.indexOf(marker);
  if (idx === -1) return;
  const relative = decodeURIComponent(mediaUrl.slice(idx + marker.length).split('?')[0]);
  if (!relative) return;
  const uploadsRoot = path.resolve(UPLOADS_DIR);
  const filePath = path.resolve(uploadsRoot, relative);
  // Yol birleştirme sonrası hâlâ UPLOADS_DIR altında mı diye kontrol et
  // (ör. "../../etc/passwd" gibi bir relative ile dışarı çıkmayı engeller).
  if (filePath !== uploadsRoot && !filePath.startsWith(uploadsRoot + path.sep)) return;
  fs.promises.unlink(filePath).catch(() => {
    // Dosya zaten yoksa (ör. ücretsiz planda restart sonrası silinmiş) sorun değil.
  });
}
