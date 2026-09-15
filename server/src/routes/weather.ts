import { Router } from 'express';
import db from '../db';
import { requireAuth, requireCouple } from '../middleware/auth';
import { requireEntitlement } from '../middleware/subscription';
import { describeWeatherCode, getWeatherSnapshot } from '../weather';

const router = Router();
router.use(requireAuth, requireCouple, requireEntitlement);

// Konum paylaşımıyla AYNI karşılıklılık şartı (bkz. routes/me.ts GET / ve
// db.ts'teki lat/lng açıklaması): partnerin bulunduğu yerin hava durumunu
// göstermek, önce partnerin KONUMUNU görebiliyor olmayı gerektiriyor --
// ayrı bir izin anahtarı eklemek yerine mevcut karşılıklı konum onayına
// bindirildi (Konum sekmesindeki aynı ekranda gösterildiği için doğal).
router.get('/partner', async (req, res) => {
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
