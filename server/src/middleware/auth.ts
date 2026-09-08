import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import db from '../db';

export interface AuthedUser {
  id: string;
  name: string;
  email: string;
  coupleId: string | null;
  avatarUrl: string | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthedUser;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

// token'ın imzalandığı andaki users.token_version'ı payload'a gömüyoruz.
// Parola sıfırlandığında token_version artırılır (bkz. routes/auth.ts
// POST /reset-password) -- bu sayede o andan önce verilmiş 30 günlük
// token'lar süresi dolmadan hemen geçersiz olur (requireAuth'taki eşleşme
// kontrolüyle), "hesabım ele geçirildi" senaryosunda gerçek bir koruma sağlar.
export function signToken(userId: string): string {
  const row = db.prepare('SELECT token_version FROM users WHERE id = ?').get(userId) as
    | { token_version: number }
    | undefined;
  return jwt.sign({ sub: userId, tokenVersion: row?.token_version ?? 0 }, JWT_SECRET, { expiresIn: '30d' });
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Yetkilendirme gerekli.' });
  }
  const token = header.slice('Bearer '.length);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string; tokenVersion?: number };
    const row = db
      .prepare(
        'SELECT id, name, email, couple_id as coupleId, avatar_url as avatarUrl, token_version as tokenVersion FROM users WHERE id = ?',
      )
      .get(payload.sub) as (AuthedUser & { tokenVersion: number }) | undefined;
    if (!row) {
      return res.status(401).json({ error: 'Kullanıcı bulunamadı.' });
    }
    if ((payload.tokenVersion ?? 0) !== row.tokenVersion) {
      return res.status(401).json({ error: 'Bu oturum artık geçerli değil. Lütfen tekrar giriş yap.' });
    }
    const { tokenVersion, ...user } = row;
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Geçersiz veya süresi dolmuş oturum.' });
  }
}

/** Requires the authenticated user to already be paired with a partner. */
export function requireCouple(req: Request, res: Response, next: NextFunction) {
  if (!req.user?.coupleId) {
    return res.status(409).json({ error: 'Önce bir partnerle eşleşmelisin.' });
  }
  next();
}
