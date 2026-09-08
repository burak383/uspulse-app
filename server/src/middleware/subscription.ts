import { NextFunction, Request, Response } from 'express';
import db from '../db';

// Uygulama seviyesinde otomatik deneme süresi: çift eşleştiğinde
// (routes/auth.ts POST /pair) couples.trial_started_at set edilir ve bu
// tarihten itibaren TRIAL_DAYS gün boyunca tüm özellikler ücretsiz kullanılır.
// Bu, App Store/Play Store'un ödeme bilgisi gerektiren native "free trial"
// (intro offer) mekanizmasından FARKLIDIR -- kullanıcı hiçbir ödeme bilgisi
// girmeden otomatik başlar.
const TRIAL_DAYS = 7;

export interface Entitlement {
  trialing: boolean;
  trialEndsAt: string | null;
  trialDaysLeft: number;
  subscriptionActive: boolean;
  subscriptionExpiresAt: string | null;
  subscriptionProductId: string | null;
  subscriptionPlatform: string | null;
  hasAccess: boolean;
}

interface CoupleSubscriptionRow {
  trial_started_at: string | null;
  subscription_active: number;
  subscription_expires_at: string | null;
  subscription_product_id: string | null;
  subscription_platform: string | null;
}

/**
 * Bir çiftin abonelik/deneme durumunu hesaplar. Çift bazlıdır: partnerlerden
 * biri abone olduğunda ya da deneme süresi devam ettiğinde ikisi de tam
 * erişime sahip olur (RevenueCat tarafında appUserID = coupleId olduğu için
 * bu zaten iki cihaz arasında otomatik senkronize -- bkz. mobile RevenueCat
 * init). Bu fonksiyon sunucu tarafındaki ikinci savunma katmanıdır (bkz.
 * requireEntitlement).
 */
// SQLite'ın datetime('now') fonksiyonu her zaman UTC üretir ama saat dilimi
// eki (ör. "Z") EKLEMEZ (ör. "2026-08-24 12:00:00"). JS'in Date.parse'ı bu
// biçimi (boşluklu, ekli değil) standart-dışı kabul edip YEREL saat dilimi
// olarak yorumlar -- sunucu UTC'de çalışmıyorsa bu, deneme süresini
// saatlerce kaydırabilir. Bu yardımcı, SQLite'ın "YYYY-MM-DD HH:MM:SS"
// biçimini açıkça UTC olarak ayrıştırır.
function parseSqliteUtcDate(value: string): number {
  const isoLike = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
  return Date.parse(isoLike);
}

export function getEntitlement(coupleId: string): Entitlement {
  const row = db
    .prepare(
      'SELECT trial_started_at, subscription_active, subscription_expires_at, subscription_product_id, subscription_platform FROM couples WHERE id = ?',
    )
    .get(coupleId) as CoupleSubscriptionRow | undefined;

  if (!row) {
    return {
      trialing: false,
      trialEndsAt: null,
      trialDaysLeft: 0,
      subscriptionActive: false,
      subscriptionExpiresAt: null,
      subscriptionProductId: null,
      subscriptionPlatform: null,
      hasAccess: false,
    };
  }

  // İkinci güvenlik ağı: subscription_active bayrağı true olsa bile (bkz.
  // routes/webhooks.ts -- CANCELLATION/BILLING_ISSUE bunu false yapmaz,
  // sadece expires_at'i günceller), saklanan bitiş tarihi geçmişte kaldıysa
  // erişim burada kapanır. Bu, bir EXPIRATION webhook'unun hiç ulaşmadığı
  // (kaçırıldığı) durumlarda bile aboneliğin süresiz aktif kalmasını önler.
  let subscriptionActive = Boolean(row.subscription_active);
  if (subscriptionActive && row.subscription_expires_at) {
    const expiresMs = parseSqliteUtcDate(row.subscription_expires_at);
    if (!Number.isNaN(expiresMs) && expiresMs <= Date.now()) {
      subscriptionActive = false;
    }
  }

  let trialing = false;
  let trialEndsAt: string | null = null;
  let trialDaysLeft = 0;
  if (row.trial_started_at) {
    const startMs = parseSqliteUtcDate(row.trial_started_at);
    if (!Number.isNaN(startMs)) {
      const endMs = startMs + TRIAL_DAYS * 24 * 60 * 60 * 1000;
      trialEndsAt = new Date(endMs).toISOString();
      const msLeft = endMs - Date.now();
      trialing = msLeft > 0;
      trialDaysLeft = trialing ? Math.max(1, Math.ceil(msLeft / (24 * 60 * 60 * 1000))) : 0;
    }
  }

  return {
    trialing,
    trialEndsAt,
    trialDaysLeft,
    subscriptionActive,
    subscriptionExpiresAt: row.subscription_expires_at,
    subscriptionProductId: row.subscription_product_id,
    subscriptionPlatform: row.subscription_platform,
    hasAccess: trialing || subscriptionActive,
  };
}

/**
 * requireAuth + requireCouple'dan SONRA kullanılmalı. Deneme süresi bitmiş
 * ve aktif aboneliği olmayan çiftler için 402 döner -- mobil taraf bunu
 * yakalayıp Paywall ekranını gösterir. auth/me/legal route'larına
 * UYGULANMAZ (kullanıcı her zaman kendi profiline/abonelik durumuna
 * erişebilmeli ve hesabını yönetebilmeli).
 */
export function requireEntitlement(req: Request, res: Response, next: NextFunction) {
  const coupleId = req.user?.coupleId;
  if (!coupleId) {
    return res.status(409).json({ error: 'Önce bir partnerle eşleşmelisin.' });
  }
  const entitlement = getEntitlement(coupleId);
  if (!entitlement.hasAccess) {
    return res.status(402).json({ error: 'Deneme süren doldu. Devam etmek için abone ol.', entitlement });
  }
  next();
}
