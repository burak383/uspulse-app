import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

// Render'ın ücretsiz planında dosya sistemi kalıcı değil -- servis her
// uyanışta/yeniden başlayışta bu SQLite dosyası (ve UPLOADS_DIR altındaki
// anı medyaları) sıfırlanır. Kalıcı disk (Render'ın ücretli eklentisi)
// eklenirse DB_PATH'i o diskteki bir yola ayarlamak yeterli -- kod tarafında
// başka bir değişiklik gerekmez.
const DB_PATH = process.env.DB_PATH || './data/uspulse.db';

const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS couples (
  id TEXT PRIMARY KEY,
  reunion_title TEXT,
  reunion_location TEXT,
  reunion_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  invite_code TEXT NOT NULL UNIQUE,
  couple_id TEXT REFERENCES couples(id),
  avatar_url TEXT,
  google_id TEXT,
  reset_code_hash TEXT,
  reset_code_expires TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS moods (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  mood TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS touches (
  id TEXT PRIMARY KEY,
  couple_id TEXT NOT NULL REFERENCES couples(id),
  sender_id TEXT NOT NULL REFERENCES users(id),
  duration_ms INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  couple_id TEXT NOT NULL REFERENCES couples(id),
  author_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL CHECK(type IN ('photo','video','audio','drawing','note','capsule')),
  title TEXT NOT NULL,
  note TEXT,
  media_url TEXT,
  unlock_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS questions_bank (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS answers (
  id TEXT PRIMARY KEY,
  couple_id TEXT NOT NULL REFERENCES couples(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  day TEXT NOT NULL,
  question_id TEXT NOT NULL REFERENCES questions_bank(id),
  text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(couple_id, user_id, day)
);

CREATE TABLE IF NOT EXISTS plan_items (
  id TEXT PRIMARY KEY,
  couple_id TEXT NOT NULL REFERENCES couples(id),
  category TEXT NOT NULL CHECK(category IN ('city','movie','place','plan')),
  title TEXT NOT NULL,
  subtitle TEXT,
  added_by TEXT NOT NULL REFERENCES users(id),
  done INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS savings_goals (
  id TEXT PRIMARY KEY,
  couple_id TEXT NOT NULL REFERENCES couples(id),
  title TEXT NOT NULL,
  target_amount REAL NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS savings_contributions (
  id TEXT PRIMARY KEY,
  goal_id TEXT NOT NULL REFERENCES savings_goals(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  amount REAL NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Partnerin yaptığı anlamlı değişikliklerin (ruh hali, anı, plan, birikim,
-- günün sorusu, buluşma planı, dokunuş) uygulama içi bildirim akışı. Push
-- bildirimi ayrıca gönderilir (bkz. notify.ts) ama bu tablo, uygulama
-- açıkken/geçmişe bakarken görülecek kalıcı listeyi tutar.
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  couple_id TEXT NOT NULL REFERENCES couples(id),
  recipient_id TEXT NOT NULL REFERENCES users(id),
  actor_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Sürüş takibi: kullanıcı hızı bir eşiğin üstünde seyrederken ("sürüş
-- halinde") anlık hızı ve izlediği yolu (rota noktaları) partnerine
-- GERÇEK ZAMANLI ve TEK TARAFLI gösterir (users.lat/lng'deki karşılıklı
-- paylaşım şartı burada aranmaz) -- bkz. routes/driving.ts. Bilinçli
-- olarak GEÇMİŞ tutulmuyor: sürüş bittiğinde (ya da bir süre güncelleme
-- gelmediğinde) satır tamamen silinir, sadece o an aktif olan seyahat
-- var olur (bkz. users.driving_share_enabled).
CREATE TABLE IF NOT EXISTS driving_trips (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  couple_id TEXT NOT NULL REFERENCES couples(id),
  started_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  speed_kmh REAL NOT NULL DEFAULT 0,
  points TEXT NOT NULL
);
`);

// Lightweight migration for databases created before Google sign-in /
// password reset existed: add the new columns if they're missing. (SQLite
// can't relax an existing NOT NULL constraint via ALTER TABLE, so a users
// table created before this change will keep requiring password_hash --
// only newly created databases get Google-only accounts with a null hash.)
function ensureColumn(table: string, column: string, ddl: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}
ensureColumn('users', 'google_id', 'google_id TEXT');
ensureColumn('users', 'facebook_id', 'facebook_id TEXT');
ensureColumn('users', 'reset_code_hash', 'reset_code_hash TEXT');
ensureColumn('users', 'reset_code_expires', 'reset_code_expires TEXT');
// Konum: karşılıklı paylaşım şartıyla tutulur -- ikisi de paylaştığında
// hem hesaplanmış mesafe (km) hem de partnerin kesin enlem/boylamı diğerine
// döner (haritada göstermek için); sadece biri paylaşırsa hiçbiri döner,
// bkz. routes/me.ts.
ensureColumn('users', 'lat', 'lat REAL');
ensureColumn('users', 'lng', 'lng REAL');
ensureColumn('users', 'location_updated_at', 'location_updated_at TEXT');
// Partnerin telefonuna gerçek zamanlı "dokunuş" bildirimi (ve titreşim)
// gönderebilmek için Expo push jetonu -- bkz. routes/touches.ts.
ensureColumn('users', 'push_token', 'push_token TEXT');
// Ruh hali paylaşımını kapatabilme: açık (0/varsayılan) olduğunda partner
// her zamanki gibi en güncel ruh halini görür; kapatıldığında (1) partnerin
// GET /mood yanıtında bu kullanıcının ruh hali gizlenir -- bkz. routes/mood.ts.
ensureColumn('users', 'mood_hidden', 'mood_hidden INTEGER NOT NULL DEFAULT 0');
// Abonelik (RevenueCat) alanları -- çift bazlı: appUserID olarak coupleId
// kullanılıyor, böylece iki partnerin de erişimi tek bir RevenueCat
// müşterisinden otomatik senkronize oluyor. bkz. middleware/subscription.ts.
// trial_started_at: çift oluşturulduğunda (routes/auth.ts POST /pair) set
// edilir -- App/Play Store'un native "free trial" (ödeme bilgisi gerektiren)
// mekanizması DEĞİL, uygulama seviyesinde otomatik 7 günlük deneme.
ensureColumn('couples', 'trial_started_at', 'trial_started_at TEXT');
// subscription_active/expires_at/product_id/platform: RevenueCat webhook'u
// (routes/webhooks.ts) tarafından güncellenir -- gerçek abonelik durumunu
// yansıtır, deneme süresinden bağımsızdır.
ensureColumn('couples', 'subscription_active', 'subscription_active INTEGER NOT NULL DEFAULT 0');
ensureColumn('couples', 'subscription_expires_at', 'subscription_expires_at TEXT');
ensureColumn('couples', 'subscription_product_id', 'subscription_product_id TEXT');
ensureColumn('couples', 'subscription_platform', 'subscription_platform TEXT');
// Şifre sıfırlandığında artırılır ve JWT payload'ına gömülür (bkz.
// middleware/auth.ts) -- böylece parola sıfırlamadan ÖNCE verilmiş eski
// token'lar (30 gün geçerli) parola sıfırlandığı anda hemen geçersiz olur,
// süresinin dolmasını beklemez. "Hesabım ele geçirildi" senaryosunda gerçek
// bir korumadır.
ensureColumn('users', 'token_version', 'token_version INTEGER NOT NULL DEFAULT 0');
// Sürüş takibini partnere açma onayı -- varsayılan kapalı (0). Kapatıldığında
// (bkz. routes/driving.ts DELETE /driving/share) aktif seyahat satırı da
// hemen silinir, böylece partnerin ekranında hayalet bir rota kalmaz.
ensureColumn('users', 'driving_share_enabled', 'driving_share_enabled INTEGER NOT NULL DEFAULT 0');
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL;');
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_facebook_id ON users(facebook_id) WHERE facebook_id IS NOT NULL;');
db.exec('CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id, created_at DESC);');
// Neredeyse her route bir couple_id (ya da user_id) filtresiyle sorgu
// çalıştırıyor (ör. "WHERE couple_id = ?") -- bu indeksler olmadan her
// istek, çift/kullanıcı sayısı arttıkça yavaşlayan tam tablo taraması
// gerektirir. Küçük demo verisinde fark edilmez ama gerçek kullanıcı
// tabanında önemli hale gelir.
db.exec('CREATE INDEX IF NOT EXISTS idx_memories_couple ON memories(couple_id);');
db.exec('CREATE INDEX IF NOT EXISTS idx_plan_items_couple ON plan_items(couple_id);');
db.exec('CREATE INDEX IF NOT EXISTS idx_savings_goals_couple ON savings_goals(couple_id);');
db.exec('CREATE INDEX IF NOT EXISTS idx_savings_contributions_goal ON savings_contributions(goal_id);');
db.exec('CREATE INDEX IF NOT EXISTS idx_touches_couple ON touches(couple_id);');
db.exec('CREATE INDEX IF NOT EXISTS idx_moods_user ON moods(user_id);');
db.exec('CREATE INDEX IF NOT EXISTS idx_users_couple ON users(couple_id);');
db.exec('CREATE INDEX IF NOT EXISTS idx_driving_trips_couple ON driving_trips(couple_id);');

const questionCount = (db.prepare('SELECT COUNT(*) as c FROM questions_bank').get() as { c: number }).c;
if (questionCount === 0) {
  const defaultQuestions = [
    'İkimizin en komik anı neydi?',
    'Bende en sevdiğin huy hangisi?',
    'Birlikte gitmek istediğimiz ama henüz gidemediğimiz yer neresi?',
    'Seni bugün ne mutlu etti?',
    'Birbirimizden öğrendiğimiz en güzel şey ne?',
    'Bir sonraki buluşmamızda ilk ne yapmak istersin?',
    'Seni bana aşık eden küçük bir an anlat.',
    'Uzaktayken seni bana en çok yaklaştıran şey ne?',
    'Birlikte kurmak istediğimiz bir gelenek olsa ne olurdu?',
    'Bugün beni gülümseten bir anını anlatır mısın?',
  ];
  const insert = db.prepare('INSERT INTO questions_bank (id, text) VALUES (?, ?)');
  const insertMany = db.transaction((rows: string[]) => {
    for (const text of rows) {
      insert.run(`q_${Buffer.from(text).toString('base64url').slice(0, 12)}_${Math.random().toString(36).slice(2, 6)}`, text);
    }
  });
  insertMany(defaultQuestions);
}

export default db;
