import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db';
import { newId, newInviteCode, newResetCode } from '../util';
import { requireAuth, signToken } from '../middleware/auth';

const router = Router();

// Google Cloud Console'da oluşturulan OAuth istemci kimlikleri (iOS/Android/Web),
// virgülle ayrılmış olarak GOOGLE_CLIENT_IDS ortam değişkeninde tutulur. Boşsa
// Google ile giriş bu sunucuda kapalı kabul edilir.
const GOOGLE_CLIENT_IDS = (process.env.GOOGLE_CLIENT_IDS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// Meta for Developers > uygulaman > Settings > Basic üzerinden alınan Uygulama
// Kimliği ve Uygulama Gizli Anahtarı. İkisi de boşsa Facebook ile giriş bu
// sunucuda kapalı kabul edilir. Gizli anahtar SADECE burada, sunucuda kalır;
// mobil tarafa (mobile/.env) hiçbir zaman kopyalanmaz.
const FACEBOOK_APP_ID = (process.env.FACEBOOK_APP_ID || '').trim();
const FACEBOOK_APP_SECRET = (process.env.FACEBOOK_APP_SECRET || '').trim();

// Şifre sıfırlama kodu 6 haneli (10^6 olasılık) ve 15 dakika geçerli, ama
// deneme sayısını sınırlayan bir mekanizma olmazsa bu süre içinde sınırsız
// tahmin denenebilir. Tek instance'lı bir Render dağıtımı için bellek içi
// basit bir pencere-sayaç yeterli (Redis gibi ek bir servise gerek yok) --
// süreç yeniden başlarsa sayaçlar sıfırlanır, bu güvenlik ağı için kabul
// edilebilir bir sınırlama.
const rateLimitWindows = new Map<string, { count: number; windowStart: number }>();

function checkRateLimit(key: string, maxAttempts: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitWindows.get(key);
  if (!entry || now - entry.windowStart > windowMs) {
    rateLimitWindows.set(key, { count: 1, windowStart: now });
    return true;
  }
  entry.count += 1;
  return entry.count <= maxAttempts;
}

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

router.post('/register', (req, res) => {
  const { name, email, password } = req.body ?? {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'İsim, e-posta ve şifre gerekli.' });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: 'Şifre en az 6 karakter olmalı.' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(String(email).toLowerCase());
  if (existing) {
    return res.status(409).json({ error: 'Bu e-posta zaten kayıtlı.' });
  }

  const id = newId();
  let inviteCode = newInviteCode();
  // guarantee uniqueness of invite code
  while (db.prepare('SELECT 1 FROM users WHERE invite_code = ?').get(inviteCode)) {
    inviteCode = newInviteCode();
  }
  const passwordHash = bcrypt.hashSync(String(password), 10);

  db.prepare(
    `INSERT INTO users (id, name, email, password_hash, invite_code) VALUES (?, ?, ?, ?, ?)`,
  ).run(id, name, String(email).toLowerCase(), passwordHash, inviteCode);

  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  const token = signToken(id);
  res.status(201).json({ token, user: publicUser(row) });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ error: 'E-posta ve şifre gerekli.' });
  }
  const row: any = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email).toLowerCase());
  if (!row) {
    return res.status(401).json({ error: 'E-posta veya şifre hatalı.' });
  }
  if (!row.password_hash) {
    return res
      .status(401)
      .json({ error: 'Bu hesap Google ile oluşturulmuş. Google ile giriş yapmayı deneyin ya da şifremi unuttum ile bir şifre belirleyin.' });
  }
  if (!bcrypt.compareSync(String(password), row.password_hash)) {
    return res.status(401).json({ error: 'E-posta veya şifre hatalı.' });
  }
  const token = signToken(row.id);
  res.json({ token, user: publicUser(row) });
});

router.post('/forgot-password', (req, res) => {
  const { email } = req.body ?? {};
  if (!email) {
    return res.status(400).json({ error: 'E-posta gerekli.' });
  }
  const normalizedEmail = String(email).toLowerCase().trim();

  // Bir e-posta adresi için saatte en fazla 5 kod isteği -- sınırsız kod
  // üretimini (log/gelecekteki SMS-e-posta sağlayıcı maliyeti) önler.
  if (!checkRateLimit(`forgot:${normalizedEmail}`, 5, 60 * 60 * 1000)) {
    return res.status(429).json({ error: 'Çok fazla istek. Lütfen bir süre sonra tekrar dene.' });
  }

  const row: any = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);

  // The status code and message are the same whether or not the account
  // exists, so this endpoint can't be used to probe which emails are
  // registered. The dev-mode `devCode` field is the one exception: it can
  // only be returned when there's actually a code to return, which itself
  // reveals whether the account exists -- acceptable for local/dev testing
  // (it's gone entirely once NODE_ENV=production), not for a real deployment.
  if (row) {
    const code = newResetCode();
    const codeHash = bcrypt.hashSync(code, 10);
    const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    db.prepare('UPDATE users SET reset_code_hash = ?, reset_code_expires = ? WHERE id = ?').run(
      codeHash,
      expires,
      row.id,
    );

    // There is no email/SMS provider wired up in this demo backend, so the
    // code can't actually be delivered anywhere yet. It's logged here (and,
    // outside production, echoed back in the response) so the reset flow is
    // testable end to end. Wire up a real provider (Postmark, SendGrid,
    // Twilio, etc.) before using this with real users.
    console.log(`[şifre sıfırlama] ${normalizedEmail} için kod: ${code} (15 dakika geçerli)`);
    return res.json({
      ok: true,
      message: 'Hesap bulunduysa sıfırlama kodu gönderildi.',
      ...(process.env.NODE_ENV === 'production' ? {} : { devCode: code }),
    });
  }

  res.json({ ok: true, message: 'Hesap bulunduysa sıfırlama kodu gönderildi.' });
});

router.post('/reset-password', (req, res) => {
  const { email, code, newPassword } = req.body ?? {};
  if (!email || !code || !newPassword) {
    return res.status(400).json({ error: 'E-posta, kod ve yeni şifre gerekli.' });
  }
  if (String(newPassword).length < 6) {
    return res.status(400).json({ error: 'Şifre en az 6 karakter olmalı.' });
  }
  const normalizedEmail = String(email).toLowerCase().trim();

  // 15 dakikalık pencerede e-posta başına en fazla 8 kod denemesi -- 6 haneli
  // (10^6 olasılık) kodu brute-force ile bulma ihtimalini pratikte imkansız
  // hale getirir.
  if (!checkRateLimit(`reset:${normalizedEmail}`, 8, 15 * 60 * 1000)) {
    return res
      .status(429)
      .json({ error: 'Çok fazla hatalı deneme. Lütfen bir süre sonra yeniden kod isteyip tekrar dene.' });
  }

  const row: any = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail);
  if (!row || !row.reset_code_hash || !row.reset_code_expires) {
    return res.status(400).json({ error: 'Geçersiz veya süresi dolmuş kod. Yeniden kod isteyin.' });
  }
  if (new Date(row.reset_code_expires).getTime() < Date.now()) {
    return res.status(400).json({ error: 'Kodun süresi dolmuş. Yeniden kod isteyin.' });
  }
  if (!bcrypt.compareSync(String(code), row.reset_code_hash)) {
    return res.status(400).json({ error: 'Kod hatalı.' });
  }

  const passwordHash = bcrypt.hashSync(String(newPassword), 10);
  db.prepare(
    'UPDATE users SET password_hash = ?, reset_code_hash = NULL, reset_code_expires = NULL WHERE id = ?',
  ).run(passwordHash, row.id);

  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(row.id);
  const token = signToken(row.id);
  res.json({ token, user: publicUser(updated) });
});

router.post('/google', async (req, res) => {
  if (GOOGLE_CLIENT_IDS.length === 0) {
    return res
      .status(501)
      .json({ error: 'Google ile giriş bu sunucuda yapılandırılmamış (GOOGLE_CLIENT_IDS eksik).' });
  }
  const { idToken } = req.body ?? {};
  if (!idToken) {
    return res.status(400).json({ error: 'idToken gerekli.' });
  }

  let payload: any;
  try {
    const verifyRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(String(idToken))}`,
    );
    if (!verifyRes.ok) throw new Error('invalid token');
    payload = await verifyRes.json();
  } catch {
    return res.status(401).json({ error: 'Google jetonu doğrulanamadı.' });
  }

  if (!payload?.aud || !GOOGLE_CLIENT_IDS.includes(payload.aud)) {
    return res.status(401).json({ error: 'Google jetonu bu uygulama için geçerli değil.' });
  }
  if (payload.email_verified !== 'true' && payload.email_verified !== true) {
    return res.status(401).json({ error: 'Google hesabının e-postası doğrulanmamış.' });
  }
  if (!payload.email || !payload.sub) {
    return res.status(401).json({ error: 'Google jetonundan e-posta/kimlik okunamadı.' });
  }

  const email = String(payload.email).toLowerCase();
  const googleId = String(payload.sub);
  const name = payload.name ? String(payload.name) : email.split('@')[0];

  let row: any = db.prepare('SELECT * FROM users WHERE google_id = ?').get(googleId);
  if (!row) {
    row = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (row) {
      db.prepare('UPDATE users SET google_id = ? WHERE id = ?').run(googleId, row.id);
      row = db.prepare('SELECT * FROM users WHERE id = ?').get(row.id);
    }
  }

  if (!row) {
    const id = newId();
    let inviteCode = newInviteCode();
    while (db.prepare('SELECT 1 FROM users WHERE invite_code = ?').get(inviteCode)) {
      inviteCode = newInviteCode();
    }
    db.prepare(
      `INSERT INTO users (id, name, email, password_hash, invite_code, google_id, avatar_url) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, name, email, null, inviteCode, googleId, payload.picture ?? null);
    row = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  }

  const token = signToken(row.id);
  res.json({ token, user: publicUser(row) });
});

router.post('/facebook', async (req, res) => {
  if (!FACEBOOK_APP_ID || !FACEBOOK_APP_SECRET) {
    return res
      .status(501)
      .json({ error: 'Facebook ile giriş bu sunucuda yapılandırılmamış (FACEBOOK_APP_ID/FACEBOOK_APP_SECRET eksik).' });
  }
  const { accessToken } = req.body ?? {};
  if (!accessToken) {
    return res.status(400).json({ error: 'accessToken gerekli.' });
  }

  let payload: any;
  try {
    // debug_token, jetonu bize ait "uygulama jetonu" (app_id|app_secret) ile
    // doğrular: jetonun gerçekten bizim Facebook uygulamamız için, geçerli ve
    // süresi dolmamış olarak üretildiğini teyit eder -- Google akışındaki
    // `aud` kontrolünün Facebook karşılığı.
    const appToken = `${FACEBOOK_APP_ID}|${FACEBOOK_APP_SECRET}`;
    const debugRes = await fetch(
      `https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(String(accessToken))}&access_token=${encodeURIComponent(appToken)}`,
    );
    if (!debugRes.ok) throw new Error('debug_token request failed');
    const debug: any = await debugRes.json();
    const info = debug?.data;
    if (!info?.is_valid || String(info?.app_id) !== FACEBOOK_APP_ID) {
      return res.status(401).json({ error: 'Facebook jetonu bu uygulama için geçerli değil.' });
    }

    const profileRes = await fetch(
      `https://graph.facebook.com/me?fields=id,name,email&access_token=${encodeURIComponent(String(accessToken))}`,
    );
    if (!profileRes.ok) throw new Error('profile request failed');
    payload = await profileRes.json();
  } catch {
    return res.status(401).json({ error: 'Facebook jetonu doğrulanamadı.' });
  }

  if (!payload?.id) {
    return res.status(401).json({ error: 'Facebook jetonundan kimlik okunamadı.' });
  }
  if (!payload.email) {
    // Facebook hesapları e-posta eklemeden de oluşturulabiliyor; e-posta
    // izni verilmediyse ya da hesapta e-posta yoksa buraya düşer.
    return res
      .status(401)
      .json({ error: 'Facebook hesabından e-posta alınamadı. Hesabında bir e-posta olduğundan ve izin verdiğinden emin ol.' });
  }

  const email = String(payload.email).toLowerCase();
  const facebookId = String(payload.id);
  const name = payload.name ? String(payload.name) : email.split('@')[0];

  let row: any = db.prepare('SELECT * FROM users WHERE facebook_id = ?').get(facebookId);
  if (!row) {
    row = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (row) {
      db.prepare('UPDATE users SET facebook_id = ? WHERE id = ?').run(facebookId, row.id);
      row = db.prepare('SELECT * FROM users WHERE id = ?').get(row.id);
    }
  }

  if (!row) {
    const id = newId();
    let inviteCode = newInviteCode();
    while (db.prepare('SELECT 1 FROM users WHERE invite_code = ?').get(inviteCode)) {
      inviteCode = newInviteCode();
    }
    db.prepare(
      `INSERT INTO users (id, name, email, password_hash, invite_code, facebook_id) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(id, name, email, null, inviteCode, facebookId);
    row = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  }

  const token = signToken(row.id);
  res.json({ token, user: publicUser(row) });
});

router.post('/pair', requireAuth, (req, res) => {
  const { code } = req.body ?? {};
  if (!code) {
    return res.status(400).json({ error: 'Davet kodu gerekli.' });
  }
  const me = req.user!;
  if (me.coupleId) {
    return res.status(409).json({ error: 'Zaten bir partnerle eşleştin.' });
  }

  const partner: any = db
    .prepare('SELECT * FROM users WHERE invite_code = ?')
    .get(String(code).toUpperCase().trim());

  if (!partner) {
    return res.status(404).json({ error: 'Bu davet kodu bulunamadı.' });
  }
  if (partner.id === me.id) {
    return res.status(400).json({ error: 'Kendi kodunla eşleşemezsin.' });
  }

  let coupleId: string;
  if (partner.couple_id) {
    const memberCount = db
      .prepare('SELECT COUNT(*) as c FROM users WHERE couple_id = ?')
      .get(partner.couple_id) as { c: number };
    if (memberCount.c >= 2) {
      return res.status(409).json({ error: 'Bu davet kodu zaten kullanılmış.' });
    }
    coupleId = partner.couple_id;
  } else {
    coupleId = newId();
    db.prepare('INSERT INTO couples (id) VALUES (?)').run(coupleId);
    db.prepare('UPDATE users SET couple_id = ? WHERE id = ?').run(coupleId, partner.id);
  }

  db.prepare('UPDATE users SET couple_id = ? WHERE id = ?').run(coupleId, me.id);

  const couple = db.prepare('SELECT * FROM couples WHERE id = ?').get(coupleId);
  const updatedMe = db.prepare('SELECT * FROM users WHERE id = ?').get(me.id);
  res.json({ couple, user: publicUser(updatedMe), partner: publicUser(partner) });
});

export default router;
