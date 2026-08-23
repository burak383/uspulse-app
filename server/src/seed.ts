import 'dotenv/config';
import bcrypt from 'bcryptjs';
import db from './db';
import { newId, newInviteCode } from './util';

function upsertUser(name: string, email: string, password: string, coupleId: string) {
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return (existing as any).id as string;

  const id = newId();
  let inviteCode = newInviteCode();
  while (db.prepare('SELECT 1 FROM users WHERE invite_code = ?').get(inviteCode)) {
    inviteCode = newInviteCode();
  }
  db.prepare(
    `INSERT INTO users (id, name, email, password_hash, invite_code, couple_id) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, name, email, bcrypt.hashSync(password, 10), inviteCode, coupleId);
  return id;
}

function run() {
  console.log('Demo verisi oluşturuluyor (Elif + Deniz)...');

  let couple: any = db.prepare('SELECT * FROM couples LIMIT 1').get();
  const coupleId = couple?.id ?? newId();
  if (!couple) {
    db.prepare(
      `INSERT INTO couples (id, reunion_title, reunion_location, reunion_date) VALUES (?, ?, ?, ?)`,
    ).run(coupleId, 'İstanbul Buluşması', 'İstanbul', '2026-09-14');
  }

  const elifId = upsertUser('Elif', 'elif@uspulse.app', 'uspulse1234', coupleId);
  const denizId = upsertUser('Deniz', 'deniz@uspulse.app', 'uspulse1234', coupleId);

  const moodCount = (db.prepare('SELECT COUNT(*) as c FROM moods').get() as any).c;
  if (moodCount === 0) {
    db.prepare('INSERT INTO moods (id, user_id, mood) VALUES (?, ?, ?)').run(newId(), denizId, 'Özlemli');
    db.prepare('INSERT INTO moods (id, user_id, mood) VALUES (?, ?, ?)').run(newId(), elifId, 'Modunda');
  }

  const touchCount = (db.prepare('SELECT COUNT(*) as c FROM touches').get() as any).c;
  if (touchCount === 0) {
    const insertTouch = db.prepare(
      `INSERT INTO touches (id, couple_id, sender_id, duration_ms, created_at) VALUES (?, ?, ?, ?, ?)`,
    );
    const now = new Date();
    for (let i = 0; i < 27; i++) {
      const day = new Date(now);
      day.setDate(day.getDate() - i);
      insertTouch.run(newId(), coupleId, i % 2 === 0 ? elifId : denizId, 3000, day.toISOString());
    }
  }

  const memoryCount = (db.prepare('SELECT COUNT(*) as c FROM memories').get() as any).c;
  if (memoryCount === 0) {
    db.prepare(
      `INSERT INTO memories (id, couple_id, author_id, type, title, note) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      newId(),
      coupleId,
      elifId,
      'note',
      'İlk görüntülü kahvaltımız',
      'Kahvaltı aynı masada olmasa da aynı anda güzelmiş.',
    );
    db.prepare(
      `INSERT INTO memories (id, couple_id, author_id, type, title, note, unlock_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(newId(), coupleId, elifId, 'capsule', '1 Yıl Sonra Açılacak Not', null, '2027-02-14');
  }

  const planCount = (db.prepare('SELECT COUNT(*) as c FROM plan_items').get() as any).c;
  if (planCount === 0) {
    const insertPlan = db.prepare(
      `INSERT INTO plan_items (id, couple_id, category, title, subtitle, added_by, done) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    insertPlan.run(newId(), coupleId, 'city', 'Lizbon', 'Elif ekledi', elifId, 0);
    insertPlan.run(newId(), coupleId, 'city', 'Kyoto', 'Deniz ekledi', denizId, 0);
    insertPlan.run(newId(), coupleId, 'movie', 'Perfect Days', 'Elif ekledi', elifId, 0);
    insertPlan.run(newId(), coupleId, 'place', 'Mürver', 'Deniz ekledi', denizId, 0);
    insertPlan.run(newId(), coupleId, 'plan', 'Boğaz turu', 'Elif tamamladı', elifId, 1);
    insertPlan.run(newId(), coupleId, 'plan', 'Cihangir kahvaltısı', 'Deniz bekliyor', denizId, 0);
  }

  const goalCount = (db.prepare('SELECT COUNT(*) as c FROM savings_goals').get() as any).c;
  if (goalCount === 0) {
    const goalId = newId();
    db.prepare(
      `INSERT INTO savings_goals (id, couple_id, title, target_amount, note) VALUES (?, ?, ?, ?, ?)`,
    ).run(goalId, coupleId, 'Kaş Kaçamağı', 15000, 'Gün batımında uzun bir masa için.');
    db.prepare(
      `INSERT INTO savings_contributions (id, goal_id, user_id, amount) VALUES (?, ?, ?, ?)`,
    ).run(newId(), goalId, denizId, 600);
    db.prepare(
      `INSERT INTO savings_contributions (id, goal_id, user_id, amount) VALUES (?, ?, ?, ?)`,
    ).run(newId(), goalId, elifId, 7800);
  }

  const elif = db.prepare('SELECT invite_code FROM users WHERE id = ?').get(elifId) as any;
  const deniz = db.prepare('SELECT invite_code FROM users WHERE id = ?').get(denizId) as any;

  console.log('\nHazır! Demo giriş bilgileri:');
  console.log('  Elif  -> elif@uspulse.app  / uspulse1234  (davet kodu: ' + elif.invite_code + ')');
  console.log('  Deniz -> deniz@uspulse.app / uspulse1234  (davet kodu: ' + deniz.invite_code + ')');
  console.log('İkisi de aynı couple kaydına eşleşmiş durumda, ayrıca eşleşme akışını denemek için birini silip /api/auth/pair ile tekrar bağlayabilirsin.\n');
}

run();
