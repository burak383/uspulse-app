import { NextFunction, Request, Response } from 'express';

// Basit bellek-içi pencere sayaç tabanlı rate limiter. Tek instance'lı bir
// Render dağıtımı için yeterli (Redis gibi ek bir servise gerek yok) --
// süreç yeniden başlarsa sayaçlar sıfırlanır, bu güvenlik ağı için kabul
// edilebilir bir sınırlama. Aynı deseni ilk kullanan yer routes/auth.ts'teki
// forgot/reset-password uçlarıydı; burada kimliği doğrulanmış herhangi bir
// route için genelleştiriyoruz.
const rateLimitWindows = new Map<string, { count: number; windowStart: number }>();

export function checkRateLimit(key: string, maxAttempts: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitWindows.get(key);
  if (!entry || now - entry.windowStart > windowMs) {
    rateLimitWindows.set(key, { count: 1, windowStart: now });
    return true;
  }
  entry.count += 1;
  return entry.count <= maxAttempts;
}

// Kimliği doğrulanmış bir kullanıcı için express middleware'i: verilen isim
// altında, kullanıcı başına pencere içinde en fazla maxAttempts istek kabul
// eder. requireAuth'tan SONRA kullanılmalı (req.user'a ihtiyaç duyar) --
// yoksa req.ip'ye düşer, bu da NAT arkasındaki birden çok kullanıcıyı
// birbirine karıştırabilir.
export function rateLimitPerUser(name: string, maxAttempts: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.id;
    const key = `${name}:${userId ?? req.ip}`;
    if (!checkRateLimit(key, maxAttempts, windowMs)) {
      return res.status(429).json({ error: 'Çok fazla istek. Lütfen bir süre sonra tekrar dene.' });
    }
    next();
  };
}
