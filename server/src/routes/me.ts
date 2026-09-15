import { Router } from 'express';
import db from '../db';
import { requireAuth } from '../middleware/auth';
import { getEntitlement } from '../middleware/subscription';
import { deleteUploadedMediaByUrl } from '../uploads';
import { notifyCoupleMilestone } from '../notify';

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

// Bkz. mobile/screens/Biz.tsx daysSince (ve src/utils/date.ts
// parseSqliteTimestamp) -- birlikte olma süresi, çiftin eşleştiği an
// (couples.created_at) ile şimdi arasındaki TAM gün sayısı. Sunucu
// tarafında da AYNI hesaplamayı kullanıyoruz ki aşağıdaki "100. gününüz"
// bildirimi, Biz ekranında görünen sayıyla birebir tutarlı olsun.
function daysSinceCoupleStart(createdAt: string): number {
  const isoLike = createdAt.includes('T') ? createdAt : `${createdAt.replace(' ', 'T')}Z`;
  const start = new Date(isoLike);
  if (Number.isNaN(start.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - start.getTime()) / 86400000));
}

// Kutlanacak "kilometre taşı" günleri: birkaç özel eşik + sonrasında her
// tam yıl dönümü. Listeye yeni bir özel gün eklemek tek satırlık bir iş.
function milestoneLabelFor(days: number): string | null {
  if (days === 7) return '1 haftanız doldu';
  if (days === 30) return '1 ayınız doldu';
  if (days === 100) return '100. gününüz';
  if (days === 500) return '500. gününüz';
  if (days === 1000) return '1000. gününüz';
  if (days > 0 && days % 365 === 0) {
    const years = days / 365;
    return years === 1 ? '1. yıl dönümünüz' : `${years}. yıl dönümünüz`;
  }
  return null;
}

// GET /me neredeyse her ekran açılışında/odaklanmasında çağrıldığı için bu
// kontrol pratikte "uygulama her açıldığında" çalışır -- ayrı bir
// zamanlanmış görev (cron) KURULMADI çünkü Render'ın ücretsiz planındaki
// servis kullanılmadığında uyur; bir cron'un uyanık bir dyno beklemesi
// yerine, zaten olan bir istekle (GET /me) "bugün tam o güne denk geldik
// mi?" diye bakmak daha güvenilir. Uygulama o gün hiç açılmazsa o günün
// kutlaması hiç gönderilmez (geriye dönük telafi YOK) -- ama
// last_milestone_check_days bugüne güncellendiği için ertesi gün tekrar
// gecikmeli bir bildirim de gitmez.
function checkAnniversaryMilestone(couple: any) {
  if (!couple?.created_at) return;
  const days = daysSinceCoupleStart(couple.created_at);
  if (days === (couple.last_milestone_check_days ?? 0)) return;
  db.prepare('UPDATE couples SET last_milestone_check_days = ? WHERE id = ?').run(days, couple.id);
  const label = milestoneLabelFor(days);
  if (label) {
    notifyCoupleMilestone(couple.id, `${label}! 🎉`, "Aşkınızı kutlamak için UsPulse'u açın.");
  }
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
    checkAnniversaryMilestone(couple);
  }

  // Konum paylaşımı KARŞILIKLI: ikisi de açtığında hem mesafe hem de
  // partnerin canlı enlem/boylamı (haritada göstermek için) döner. Sadece
  // biri paylaşıyorsa (ya da hiçbiri paylaşmıyorsa) ne mesafe ne de ham
  // konum döner -- mobil taraf bunu "henüz paylaşılmadı" olarak gösterir.
  let distance: number | null = null;
  const iShared = row.lat != null && row.lng != null;
  const partnerShared = Boolean(partner && partner.lat != null && partner.lng != null);
  const mutualShare = iShared && partnerShared;
  if (mutualShare) {
    distance = Math.round(distanceKm(row.lat, row.lng, partner.lat, partner.lng));
  }

  // Abonelik/deneme durumu -- mobil taraf bunu okuyup Paywall'u göstermeyi
  // gerektirip gerektirmediğine karar verir (bkz. middleware/subscription.ts).
  const entitlement = me.coupleId ? getEntitlement(me.coupleId) : null;

  res.json({
    user: publicUser(row),
    partner: partner ? publicUser(partner) : null,
    couple,
    distanceKm: distance,
    locationSharedByMe: iShared,
    locationSharedByPartner: partnerShared,
    partnerLat: mutualShare ? partner.lat : null,
    partnerLng: mutualShare ? partner.lng : null,
    // Konum paylaşımıyla aynı karşılıklılık şartına tabi -- bkz. db.ts'teki
    // battery_level/battery_charging açıklaması.
    partnerBatteryLevel: mutualShare && partner.battery_level != null ? partner.battery_level : null,
    partnerBatteryCharging: mutualShare && partner.battery_level != null ? Boolean(partner.battery_charging) : null,
    // Partnerin şu anki konumunda ne zamandır olduğu -- Konum sekmesinde
    // avatarına dokununca gösteriliyor (bkz. mobile/screens/PartnerKonum.tsx).
    // Aynı karşılıklılık şartına tabi.
    partnerStationarySince: mutualShare ? partner.stationary_since : null,
    // Sürüş takibi paylaşımı (bkz. routes/driving.ts) diğer cihazlarla
    // senkron kalması için sunucu tarafında (AsyncStorage değil) tutulur.
    drivingShareEnabled: Boolean(row.driving_share_enabled),
    entitlement,
  });
});

// Konum her güncellemede (birkaç dakikada bir) tazelenir, hareket edilmese
// bile -- bu yüzden "ne zamandır buradasın" sorusuna cevap vermek için ayrı
// bir eşik gerekiyor. GPS'in kendi ölçüm sapması (bina içi/dışı, sokak
// kenarı vs.) birkaç metre ile birkaç on metre arasında değişebildiğinden,
// gerçekten "başka bir yere gitti" sayılması için bundan daha büyük bir
// hareket arıyoruz.
const STATIONARY_MOVE_THRESHOLD_KM = 0.12; // ~120 metre

router.put('/location', requireAuth, (req, res) => {
  const { lat, lng, batteryLevel, charging } = req.body ?? {};
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
  // batteryLevel/charging isteğe bağlı -- eski istemci sürümleri (ya da
  // expo-battery'nin -1 döndürdüğü iOS simülatörü gibi durumlar) bunları hiç
  // göndermeyebilir; o zaman ilgili sütun mevcut değerinde kalır (COALESCE),
  // partnerin ekranında "eski ama yanlış olmayan" bir yüzde görünür.
  const batteryNum = Number(batteryLevel);
  const hasBattery = Number.isFinite(batteryNum) && batteryNum >= 0 && batteryNum <= 100;

  // Yeni konum, mevcut kayıtlı konumdan anlamlı ölçüde uzaksa (ya da hiç
  // konum yoksa) "buradasın" sayacı şimdi'den başlıyor; aksi halde eski
  // başlangıç zamanı korunuyor.
  const current: any = db
    .prepare('SELECT lat, lng, stationary_since FROM users WHERE id = ?')
    .get(req.user!.id);
  const hasPreviousLocation = current?.lat != null && current?.lng != null;
  const moved =
    !hasPreviousLocation ||
    !current.stationary_since ||
    distanceKm(current.lat, current.lng, latNum, lngNum) > STATIONARY_MOVE_THRESHOLD_KM;
  const stationarySince = moved ? new Date().toISOString().slice(0, 19).replace('T', ' ') : current.stationary_since;

  db.prepare(
    `UPDATE users SET lat = ?, lng = ?, location_updated_at = datetime('now'),
     stationary_since = ?,
     battery_level = COALESCE(?, battery_level),
     battery_charging = COALESCE(?, battery_charging)
     WHERE id = ?`,
  ).run(
    latNum,
    lngNum,
    stationarySince,
    hasBattery ? Math.round(batteryNum) : null,
    typeof charging === 'boolean' ? (charging ? 1 : 0) : null,
    req.user!.id,
  );
  res.status(204).end();
});

router.delete('/location', requireAuth, (req, res) => {
  db.prepare(
    'UPDATE users SET lat = NULL, lng = NULL, location_updated_at = NULL, stationary_since = NULL WHERE id = ?',
  ).run(
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
// db.ts'teki DB_PATH deseni) ayrı bir dosya depolama servisi
// kurmak yerine, mobil tarafta küçültülüp (512x512) sıkıştırılmış JPEG'i
// doğrudan base64 data URI olarak users.avatar_url'e yazıyoruz -- diğer
// tüm kullanıcı verisiyle aynı kalıcılık garantisine sahip, ekstra servis/
// API anahtarı gerekmiyor.
const MAX_AVATAR_BASE64_LENGTH = 2_800_000; // ~2MB base64 (~1.5MB ham veri) -- 512x512 bir JPEG için bolca yeterli.

// data: URI'nin beyan ettiği MIME türüne güvenmek yerine, gerçek dosya
// imzasını (magic bytes) kontrol ediyoruz -- uploads.ts'teki multipart
// yükleme yolunda zaten yapılan MIME whitelist kontrolüyle aynı savunma
// derinliği. Aksi halde biri "image/png" beyan edip aslında farklı/zararlı
// bir içerik gönderebilirdi.
const MAGIC_BYTES: { prefix: string; signatures: number[][] }[] = [
  { prefix: 'data:image/jpeg;base64,', signatures: [[0xff, 0xd8, 0xff]] },
  { prefix: 'data:image/jpg;base64,', signatures: [[0xff, 0xd8, 0xff]] },
  { prefix: 'data:image/png;base64,', signatures: [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]] },
  // WebP: "RIFF"...."WEBP" -- ilk 4 ve 9-12. baytlar arasında boyut alanı var,
  // bu yüzden imzayı iki parça olarak kontrol ediyoruz (aşağıdaki özel dal).
];

function isValidAvatarImage(dataUri: string): boolean {
  const match = /^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/]+=*)$/.exec(dataUri);
  if (!match) return false;
  let buf: Buffer;
  try {
    buf = Buffer.from(match[2], 'base64');
  } catch {
    return false;
  }
  if (buf.length < 12) return false;
  const mime = match[1];
  if (mime === 'webp') {
    return (
      buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP'
    );
  }
  const rule = MAGIC_BYTES.find((r) => r.prefix === `data:image/${mime};base64,`);
  if (!rule) return false;
  return rule.signatures.some((sig) => sig.every((byte, i) => buf[i] === byte));
}

// Eşleştikten sonraki avatar seçim ekranındaki hazır (kadın/erkek) avatarlar
// (bkz. mobile/src/avatars/presets.ts) gerçek bir fotoğraf YÜKLEMİYOR --
// sadece "preset:<kategori>:<ikon-adı>" biçiminde küçük bir metin
// gönderiyor, biz de bunu diğer fotoğraflarla aynı avatar_url sütununda
// saklıyoruz. Buradaki doğrulama kasıtlı olarak sadece BİÇİMİ kontrol
// ediyor (belirli bir ikon listesine karşı DEĞİL) -- ikon/renk anlamı tümüyle
// istemci tarafında yaşıyor (uygulamadaki diğer ikon adları gibi), burada
// sadece rastgele/uzun bir string'in bu sütuna yazılmasını engelliyoruz.
const PRESET_AVATAR_PATTERN = /^preset:(kadin|erkek):[a-z0-9-]{1,40}$/;

router.put('/avatar', requireAuth, (req, res) => {
  const { image } = req.body ?? {};
  if (typeof image !== 'string' || image.length > MAX_AVATAR_BASE64_LENGTH) {
    if (typeof image === 'string' && image.length > MAX_AVATAR_BASE64_LENGTH) {
      return res.status(413).json({ error: 'Fotoğraf çok büyük. Daha küçük bir fotoğraf dene.' });
    }
    return res.status(400).json({ error: 'Geçerli bir resim (data:image/...;base64,...) gerekli.' });
  }
  if (!PRESET_AVATAR_PATTERN.test(image) && !isValidAvatarImage(image)) {
    return res.status(400).json({ error: 'Geçerli bir resim (data:image/...;base64,...) gerekli.' });
  }
  db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(image, req.user!.id);
  res.status(204).end();
});

router.delete('/avatar', requireAuth, (req, res) => {
  db.prepare('UPDATE users SET avatar_url = NULL WHERE id = ?').run(req.user!.id);
  res.status(204).end();
});

// Hesap ve tüm kişisel verilerin silinmesi (KVKK/GDPR ve Google'ın "User
// Data Deletion" gereksinimi için gerekli): kullanıcının kendi yazdığı
// ruh hali, dokunuş, anı, günün sorusu cevabı ve plan/birikim katkılarını,
// ardından kullanıcı kaydının kendisini siler. Partnerin hesabına ve ortak
// couple kaydına dokunmaz -- sadece silinen kullanıcının kendi verileri gider.
const deleteMyData = db.transaction((userId: string) => {
  const before = db.prepare('SELECT couple_id FROM users WHERE id = ?').get(userId) as
    | { couple_id: string | null }
    | undefined;
  const coupleId = before?.couple_id ?? null;

  db.prepare('DELETE FROM moods WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM touches WHERE sender_id = ?').run(userId);
  // Satırları silmeden önce, varsa diskteki gerçek fotoğraf/video/ses
  // dosyalarını da temizle -- yoksa DB kaydı gider ama dosya diskte öksüz kalır.
  const myMemories = db
    .prepare('SELECT media_url FROM memories WHERE author_id = ?')
    .all(userId) as { media_url: string | null }[];
  for (const m of myMemories) deleteUploadedMediaByUrl(m.media_url);
  db.prepare('DELETE FROM memories WHERE author_id = ?').run(userId);
  db.prepare('DELETE FROM answers WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM savings_contributions WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM plan_items WHERE added_by = ?').run(userId);
  // Bildirimler tablosu recipient_id/actor_id ile users'a FOREIGN KEY ile
  // bağlı -- bunlar silinmeden users satırı silinirse FK ihlali oluşur.
  db.prepare('DELETE FROM notifications WHERE recipient_id = ? OR actor_id = ?').run(userId, userId);
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);

  // Kalan partner "sahipsiz" bir çifte bağlı kalıp sonsuza dek kilitlenmesin
  // diye: bu kullanıcı bir çiftteyse ve silindikten sonra o çiftte tam
  // olarak bir kişi kaldıysa (yani partner), onu da çiftten çıkarıyoruz ki
  // dilediğinde yeni biriyle yeniden eşleşebilsin (routes/auth.ts POST /pair,
  // zaten dolu couple_id'li kullanıcıların eşleşmesini reddediyor). Eski
  // çiftin paylaşılan verileri (anılar, dokunuşlar, planlar vb.) dokunulmadan
  // kalır -- yalnızca kimsenin artık erişemeyeceği bir kayıt hâline gelir.
  if (coupleId) {
    const remaining = db.prepare('SELECT id FROM users WHERE couple_id = ?').all(coupleId) as { id: string }[];
    if (remaining.length === 1) {
      db.prepare('UPDATE users SET couple_id = NULL WHERE id = ?').run(remaining[0].id);
    }
  }
});

// İlişkiyi sonlandırma: hesabı silmeden, sadece eşleşmeyi kaldırır --
// hesabı silme akışındaki (yukarıdaki deleteMyData) "kalan partneri
// çiftten çıkar" mantığıyla aynı: her iki tarafı da couple_id = NULL
// yapıyoruz, ikisi de dilediğinde yeni biriyle yeniden eşleşebilsin diye
// (routes/auth.ts POST /pair, zaten dolu couple_id'li kullanıcıların
// eşleşmesini reddediyor). Paylaşılan içerikler (anılar, planlar,
// birikimler vb.) SİLİNMEZ -- yalnızca kimsenin artık erişemeyeceği bir
// kayda dönüşür, tıpkı hesap silme akışındaki gibi.
router.post('/couple/end', requireAuth, (req, res) => {
  const me = req.user!;
  if (!me.coupleId) {
    return res.status(400).json({ error: 'Şu an bir ilişkin yok.' });
  }
  const members = db.prepare('SELECT id FROM users WHERE couple_id = ?').all(me.coupleId) as { id: string }[];
  const endCouple = db.transaction(() => {
    for (const m of members) {
      db.prepare('UPDATE users SET couple_id = NULL WHERE id = ?').run(m.id);
    }
  });
  endCouple();
  res.status(204).end();
});

router.delete('/', requireAuth, (req, res) => {
  deleteMyData(req.user!.id);
  res.status(204).end();
});

export default router;
