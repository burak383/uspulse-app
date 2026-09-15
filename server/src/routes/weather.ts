import { Router } from 'express';
import db from '../db';
import { requireAuth, requireCouple } from '../middleware/auth';
import { requireEntitlement } from '../middleware/subscription';
import { rateLimitPerUser } from '../middleware/rateLimit';
import { describeWeatherCode, getWeatherSnapshot } from '../weather';

const router = Router();
router.use(requireAuth, requireCouple, requireEntitlement);

// Konum paylaşımıyla AYNI karşılıklılık şartı (bkz. routes/me.ts GET / ve
// db.ts'teki lat/lng açıklaması): partnerin bulunduğu yerin hava durumunu
// göstermek, önce partnerin KONUMUNU görebiliyor olmayı gerektiriyor --
// ayrı bir izin anahtarı eklemek yerine mevcut karşılıklı konum onayına
// bindirildi (Konum sekmesindeki aynı ekranda gösterildiği için doğal).
// Diğer /me-benzeri uçlarla tutarlı olsun diye (bkz. middleware/rateLimit.ts):
// sunucu içi 10 dakikalık önbellek (bkz. weather.ts) koordinat başına
// gerçek dış istekleri zaten sınırlıyor ama bu sadece istemcinin normal
// 10 dakikalık polling'ine (PartnerKonum.tsx WEATHER_POLL_MS) güveniyordu --
// biri bu uca doğrudan sık sık istek atarsa (ör. hafifçe değişen konumla
// önbellek anahtarını her seferinde kaçırarak) Open-Meteo'ya karşı
// sınırsız istek atılabilirdi.
router.get('/partner', rateLimitPerUser('weather', 30, 60 * 1000), async (req, res) => {
  const me = req.user!;
  const meRow: any = db.prepare('SELECT lat, lng FROM users WHERE id = ?').get(me.id);
  const partner: any = db
    .prepare('SELECT lat, lng FROM users WHERE couple_id = ? AND id != ?')
    .get(me.coupleId, me.id);

  const iShared = meRow?.lat != null && meRow?.lng != null;
  const partnerShared = Boolean(partner && partner.lat != null && partner.lng != null);
  if (!iShared || !partnerShared) {
    return res.json({ shared: false });
  }

  const snapshot = await getWeatherSnapshot(partner.lat, partner.lng);
  if (!snapshot) {
    // Open-Meteo'ya ulaşılamadı ve önbellekte de veri yok -- geçici bir
    // durum, istemci bunu sessizce (kartı hiç göstermeyerek) ele alır.
    return res.json({ shared: true, available: false });
  }

  const { description, icon } = describeWeatherCode(snapshot.code, snapshot.isDay);
  res.json({
    shared: true,
    available: true,
    tempC: snapshot.tempC,
    description,
    icon,
    isDay: snapshot.isDay,
    at: snapshot.at,
  });
});

export default router;
