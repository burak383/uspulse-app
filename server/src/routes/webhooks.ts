import crypto from 'node:crypto';
import { Router } from 'express';
import db from '../db';

const router = Router();

// RevenueCat Dashboard > Project > Integrations > Webhooks bölümünde bu
// sunucunun /api/webhooks/revenuecat adresi eklenirken "Authorization
// header" alanına TAM OLARAK `Bearer <bu değer>` yazılmalı. Render'da aynı
// değeri REVENUECAT_WEBHOOK_SECRET ortam değişkeni olarak ayarla. Boşsa bu
// uç nokta tüm istekleri reddeder (güvenli varsayılan) -- yani abonelik
// webhook'u çalışmadan önce bu env var mutlaka ayarlanmalı.
const REVENUECAT_WEBHOOK_SECRET = (process.env.REVENUECAT_WEBHOOK_SECRET || '').trim();

// Zamanlamaya dayalı (timing) saldırılara karşı sabit-zamanlı karşılaştırma
// -- pratikte bu uç nokta yalnızca sunucu-sunucu HTTPS çağrısı aldığından
// gerçek risk düşük, ama ek maliyeti yok.
function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// RevenueCat'in app_user_id'si -- couples.id (çift bazlı abonelik tasarımı,
// bkz. middleware/subscription.ts başındaki açıklama). Mobil tarafta
// Purchases.logIn(coupleId) ile eşleniyor.
//
// ÖNEMLİ: RevenueCat'te CANCELLATION, kullanıcının erişimini ANINDA
// kaybettiği anlamına GELMEZ -- yalnızca otomatik yenilemeyi kapattığı
// anlamına gelir; ödediği dönemin sonuna kadar erişimi sürer (bkz.
// legal.ts'teki abonelik koşulları). Aynı şekilde BILLING_ISSUE de genelde
// bir "grace period" ile birlikte gelir, anında kesmemeli. Bu yüzden bu iki
// olay (ve RENEWAL/PRODUCT_CHANGE/UNCANCELLATION/INITIAL_PURCHASE gibi
// "abonelik hâlâ var" olayları) yalnızca expires_at'i günceller;
// subscription_active bayrağını false yapmazlar. Gerçek erişim kesme
// yalnızca EXPIRATION (dönem gerçekten bitti) ve SUBSCRIPTION_PAUSED
// (Android'de abonelik duraklatıldı, erişim yok) ile olur. Ayrıca
// getEntitlement() ikinci bir güvenlik ağı olarak expires_at'in geçmişte
// kalıp kalmadığını da kontrol eder -- bir EXPIRATION webhook'u kaçırılsa
// bile erişim, saklanan bitiş tarihi geçince kendiliğinden kapanır.
const EVENTS_WITH_EXPIRY = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'PRODUCT_CHANGE',
  'UNCANCELLATION',
  'CANCELLATION',
  'BILLING_ISSUE',
]);
const IMMEDIATE_INACTIVE_TYPES = new Set(['EXPIRATION', 'SUBSCRIPTION_PAUSED']);

router.post('/revenuecat', (req, res) => {
  if (!REVENUECAT_WEBHOOK_SECRET) {
    console.error('[revenuecat webhook] REVENUECAT_WEBHOOK_SECRET ayarlanmamış, istek reddedildi.');
    return res.status(501).json({ error: 'Webhook bu sunucuda yapılandırılmamış.' });
  }
  const authHeader = req.headers.authorization || '';
  if (!safeCompare(authHeader, `Bearer ${REVENUECAT_WEBHOOK_SECRET}`)) {
    return res.status(401).json({ error: 'Geçersiz webhook imzası.' });
  }

  const event = req.body?.event;
  if (!event || typeof event !== 'object') {
    return res.status(400).json({ error: 'Geçersiz gövde.' });
  }

  const coupleId: string | undefined = event.app_user_id;
  const type: string | undefined = event.type;
  if (!coupleId || !type) {
    // RevenueCat "TEST" gibi bazı olayları app_user_id olmadan gönderebilir
    // -- bunları sessizce kabul ediyoruz (200), aksi halde RC bu uç noktayı
    // arızalı sayıp devre dışı bırakabilir.
    return res.status(200).json({ ok: true, skipped: true });
  }

  const couple = db.prepare('SELECT id FROM couples WHERE id = ?').get(coupleId);
  if (!couple) {
    // Bilinmeyen bir app_user_id (ör. sandbox testinde farklı bir kimlik) --
    // 200 döndürüyoruz ki RC yeniden denemeye devam etmesin.
    return res.status(200).json({ ok: true, skipped: true, reason: 'unknown app_user_id' });
  }

  if (EVENTS_WITH_EXPIRY.has(type)) {
    const expiresAt = event.expiration_at_ms ? new Date(Number(event.expiration_at_ms)).toISOString() : null;
    db.prepare(
      `UPDATE couples
       SET subscription_active = 1,
           subscription_expires_at = ?,
           subscription_product_id = ?,
           subscription_platform = ?
       WHERE id = ?`,
    ).run(expiresAt, event.product_id ?? null, event.store ?? null, coupleId);
  } else if (IMMEDIATE_INACTIVE_TYPES.has(type)) {
    db.prepare('UPDATE couples SET subscription_active = 0 WHERE id = ?').run(coupleId);
  }
  // Diğer olay tipleri (TRANSFER, NON_RENEWING_PURCHASE, TEST, vb.) şimdilik
  // yok sayılıyor -- abonelik durumunu değiştirmiyorlar.

  res.status(200).json({ ok: true });
});

export default router;
