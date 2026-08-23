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

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: '30d' });
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Yetkilendirme gerekli.' });
  }
  const token = header.slice('Bearer '.length);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string };
    const row = db
      .prepare(
        'SELECT id, name, email, couple_id as coupleId, avatar_url as avatarUrl FROM users WHERE id = ?',
      )
      .get(payload.sub) as AuthedUser | undefined;
    if (!row) {
      return res.status(401).json({ error: 'Kullanıcı bulunamadı.' });
    }
    req.user = row;
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
