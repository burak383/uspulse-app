import { Router } from 'express';
import db from '../db';
import { requireAuth, requireCouple } from '../middleware/auth';
import { requireEntitlement } from '../middleware/subscription';

const router = Router();
router.use(requireAuth, requireCouple, requireEntitlement);

// Bir seyahatte tutulan en fazla nokta sayısı -- 15 saniyelik aralıkla bu,
// yaklaşık 6+ saatlik kesintisiz sürüşe karşılık gelir, günlük kullanım için
// fazlasıyla yeterli. Sınır olmadan çok uzun bir seyahat, points sütununu
// (ve her /driving/partner yanıtını) gereksiz yere şişirebilir.
const MAX_POINTS = 1500;
// Bu süre boyunca yeni bir nokta gelmezse seyahat "durmuş" sayılır (bkz.
// GET /partner) -- istemci normalde POST /stop ile açıkça bildirir, ama
// uygulama aniden kapanır/öldürülürse bu, partnerin ekranında donmuş bir
// rotanın süresiz kalmasını önleyen bir güvenlik ağıdır.
const STALE_MS = 3 * 60 * 1000;

interface TripRow {
  user_id: string;
  couple_id: string;
  started_at: string;
  updated_at: string;
  speed_kmh: number;
  points: string;
}

interface Point {
  lat: number;
  lng: number;
  t: number;
}

// Sürüş takibini partnere açma onayı. Varsayılan kapalı -- bu, uygulamanın
// geri kalanındaki "kesin konum asla partnere gösterilmez" ilkesinin
// bilinçli tek istisnası olduğu için ayrı bir aç/kapa gerektiriyor (bkz.
// mobile AuthContext.enableDrivingShare / Biz.tsx).
router.put('/share', (req, res) => {
  db.prepare('UPDATE users SET driving_share_enabled = 1 WHERE id = ?').run(req.user!.id);
  res.status(204).end();
});

router.delete('/share', (req, res) => {
  db.prepare('UPDATE users SET driving_share_enabled = 0 WHERE id = ?').run(req.user!.id);
  db.prepare('DELETE FROM driving_trips WHERE user_id = ?').run(req.user!.id);
  res.status(204).end();
});

// Mobil taraftaki sürüş algılama görevi (drivingLocationTask.ts), hız bir
// eşiğin üstünde kaldığı sürece bunu periyodik olarak çağırır.
router.put('/point', (req, res) => {
  const shareRow = db.prepare('SELECT driving_share_enabled FROM users WHERE id = ?').get(req.user!.id) as
    | { driving_share_enabled: number }
    | undefined;
  // İkinci savunma katmanı: paylaşım ayarı başka bir cihazdan kapatıldıysa
  // (ya da hiç açılmadıysa), eski/gecikmiş bir istemci çağrısı yine de
  // reddedilir -- bkz. db.ts users.driving_share_enabled yorumu.
  if (!shareRow?.driving_share_enabled) {
    return res.status(403).json({ error: 'Sürüş takibi paylaşımı açık değil.' });
  }

  const { lat, lng, speedKmh } = req.body ?? {};
  const latNum = Number(lat);
  const lngNum = Number(lng);
  const speedNum = Number(speedKmh);
  if (
    !Number.isFinite(latNum) ||
    !Number.isFinite(lngNum) ||
    latNum < -90 ||
    latNum > 90 ||
    lngNum < -180 ||
    lngNum > 180 ||
    !Number.isFinite(speedNum) ||
    speedNum < 0
  ) {
    return res.status(400).json({ error: 'Geçerli bir lat/lng/speedKmh gerekli.' });
  }

  const now = new Date().toISOString();
  const coupleId = req.user!.coupleId!;
  const existing = db.prepare('SELECT * FROM driving_trips WHERE user_id = ?').get(req.user!.id) as
    | TripRow
    | undefined;

  let points: Point[] = [];
  let startedAt = now;
  if (existing) {
    startedAt = existing.started_at;
    try {
      points = JSON.parse(existing.points);
    } catch {
      points = [];
    }
  }
  points.push({ lat: latNum, lng: lngNum, t: Date.now() });
  if (points.length > MAX_POINTS) {
    points = points.slice(points.length - MAX_POINTS);
  }

  db.prepare(
    `INSERT INTO driving_trips (user_id, couple_id, started_at, updated_at, speed_kmh, points)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET updated_at = excluded.updated_at, speed_kmh = excluded.speed_kmh, points = excluded.points`,
  ).run(req.user!.id, coupleId, startedAt, now, speedNum, JSON.stringify(points));

  res.status(204).end();
});

// İstemci hız eşiğinin sürekli altına düştüğünde (sürüş bitti) ya da
// paylaşım kapatıldığında çağrılır -- geçmiş tutulmadığı için satır
// tamamen silinir.
router.post('/stop', (req, res) => {
  db.prepare('DELETE FROM driving_trips WHERE user_id = ?').run(req.user!.id);
  res.status(204).end();
});

// Partnerin şu an sürüş halinde olup olmadığını, hızını ve izlediği yolu
// döndürür. Sadece EŞLEŞMİŞ partner görebilir, başka hiç kimse değil.
router.get('/partner', (req, res) => {
  const coupleId = req.user!.coupleId!;
  const row = db
    .prepare('SELECT * FROM driving_trips WHERE couple_id = ? AND user_id != ?')
    .get(coupleId, req.user!.id) as TripRow | undefined;

  if (!row) {
    return res.json({ active: false });
  }

  const updatedMs = Date.parse(row.updated_at.includes('T') ? row.updated_at : `${row.updated_at}Z`);
  if (Number.isNaN(updatedMs) || Date.now() - updatedMs > STALE_MS) {
    // Bayat seyahat -- muhtemelen uygulama aniden kapandı/öldürüldü ve
    // POST /stop hiç gelmedi. Temizleyip "aktif değil" döndür.
    db.prepare('DELETE FROM driving_trips WHERE user_id = ?').run(row.user_id);
    return res.json({ active: false });
  }

  let points: Point[] = [];
  try {
    points = JSON.parse(row.points);
  } catch {
    points = [];
  }

  res.json({
    active: true,
    startedAt: row.started_at,
    speedKmh: Math.round(row.speed_kmh),
    points: points.map((p) => ({ lat: p.lat, lng: p.lng })),
  });
});

export default router;
