import { Router } from 'express';
import db from '../db';
import { requireAuth } from '../middleware/auth';

const router = Router();

function publicUser(row: any) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    inviteCode: row.invite_code,
    coupleId: row.couple_id,
    avatarUrl: row.avatar_url,
  };
}

// Haversine formülü: iki enlem/boylam noktası arasındaki kuş uçuşu mesafe (km).
function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Dünya yarıçapı (km)
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

router.get('/', requireAuth, (req, res) => {
  const me = req.user!;
  const row: any = db.prepare('SELECT * FROM users WHERE id = ?').get(me.id);
  let partner: any = null;
  let couple = null;
  if (me.coupleId) {
    couple = db.prepare('SELECT * FROM couples WHERE id = ?').get(me.coupleId);
    partner = db
      .prepare('SELECT * FROM users WHERE couple_id = ? AND id != ?')
      .get(me.coupleId, me.id);
  }

  // Gizlilik: partnere ASLA kendi enlem/boylamını ya da benim enlem/
  // boylamımı döndürmüyoruz -- sadece ikisi de konum paylaştıysa hesaplanan
  // mesafeyi (km) paylaşıyoruz. Hiçbiri paylaşmadıysa/tek biri paylaştıysa
  // distanceKm null döner ve mobil taraf bunu "henüz paylaşılmadı" olarak gösterir.
  let distance: number | null = null;
  const iShared = row.lat != null && row.lng != null;
  const partnerShared = Boolean(partner && partner.lat != null && partner.lng != null);
  if (iShared && partnerShared) {
    distance = Math.round(distanceKm(row.lat, row.lng, partner.lat, partner.lng));
  }

  res.json({
    user: publicUser(row),
    partner: partner ? publicUser(partner) : null,
    couple,
    distanceKm: distance,
    locationSharedByMe: iShared,
    locationSharedByPartner: partnerShared,
  });
});

router.put('/location', requireAuth, (req, res) => {
  const { lat, lng } = req.body ?? {};
  const latNum = Number(lat);
  const lngNum = Number(lng);
  if (
    !Number.isFinite(latNum) ||
    !Number.isFinite(lngNum) ||
    latNum < -90 ||
    latNum > 90 ||
    lngNum < -180 ||
    lngNum > 180
  ) {
    return res.status(400).json({ error: 'Geçerli bir lat/lng gerekli.' });
  }
  db.prepare(
    "UPDATE users SET lat = ?, lng = ?, location_updated_at = datetime('now') WHERE id = ?",
  ).run(latNum, lngNum, req.user!.id);
  res.status(204).end();
});

router.delete('/location', requireAuth, (req, res) => {
  db.prepare('UPDATE users SET lat = NULL, lng = NULL, location_updated_at = NULL WHERE id = ?').run(
    req.user!.id,
  );
  res.status(204).end();
});

// Bu cihazın Expo push jetonunu kaydeder ki partnerin "Kalbimi Gönder"e
// bastığında bu cihaza gerçek zamanlı bir bildirim (ve titreşim) gidebilsin.
router.put('/push-token', requireAuth, (req, res) => {
  const { token } = req.body ?? {};
  if (!token || typeof token !== 'string' || !token.startsWith('ExponentPushToken')) {
    return res.status(400).json({ error: 'Geçerli bir Expo push jetonu gerekli.' });
  }
  db.prepare('UPDATE users SET push_token = ? WHERE id = ?').run(token, req.user!.id);
  res.status(204).end();
});

router.delete('/push-token', requireAuth, (req, res) => {
  db.prepare('UPDATE users SET push_token = NULL WHERE id = ?').run(req.user!.id);
  res.status(204).end();
});

// Profil fotoğrafı: Render'da kalıcı dosya sistemi olmadığı için (bkz.
// index.ts'teki AUTO_SEED açıklaması) ayrı bir dosya depolama servisi
// kurmak yerine, mobil tarafta küçültülüp (512x512) sıkıştırılmış JPEG'i
// doğrudan base64 data URI olarak users.avatar_url'e yazıyoruz -- diğer
// tüm kullanıcı verisiyle aynı kalıcılık garantisine sahip, ekstra servis/
// API anahtarı gerekmiyor.
const MAX_AVATAR_BASE64_LENGTH = 2_800_000; // ~2MB base64 (~1.5MB ham veri) -- 512x512 bir JPEG için bolca yeterli.

router.put('/avatar', requireAuth, (req, res) => {
  const { image } = req.body ?? {};
  if (typeof image !== 'string' || !/^data:image\/(jpeg|jpg|png|webp);base64,/.test(image)) {
    return res.status(400).json({ error: 'Geçerli bir resim (data:image/...;base64,...) gerekli.' });
  }
  if (image.length > MAX_AVATAR_BASE64_LENGTH) {
    return res.status(413).json({ error: 'Fotoğraf çok büyük. Daha küçük bir fotoğraf dene.' });
  }
  db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(image, req.user!.id);
  res.status(204).end();
});

router.delete('/avatar', requireAuth, (req, res) => {
  db.prepare('UPDATE users SET avatar_url = NULL WHERE id = ?').run(req.user!.id);
  res.status(204).end();
});

// Hesap ve tüm kişisel verilerin silinmesi (KVKK/GDPR ve Facebook'un "User
// Data Deletion" gereksinimi için gerekli): kullanıcının kendi yazdığı
// ruh hali, dokunuş, anı, günün sorusu cevabı ve plan/birikim katkılarını,
// ardından kullanıcı kaydının kendisini siler. Partnerin hesabına ve ortak
// couple kaydına dokunmaz -- sadece silinen kullanıcının kendi verileri gider.
const deleteMyData = db.transaction((userId: string) => {
  db.prepare('DELETE FROM moods WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM touches WHERE sender_id = ?').run(userId);
  db.prepare('DELETE FROM memories WHERE author_id = ?').run(userId);
  db.prepare('DELETE FROM answers WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM savings_contributions WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM plan_items WHERE added_by = ?').run(userId);
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
});

router.delete('/', requireAuth, (req, res) => {
  deleteMyData(req.user!.id);
  res.status(204).end();
});

export default router;
