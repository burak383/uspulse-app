import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

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
ensureColumn('users', 'reset_code_hash', 'reset_code_hash TEXT');
ensureColumn('users', 'reset_code_expires', 'reset_code_expires TEXT');
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL;');

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
