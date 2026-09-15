// Partnerin yaptığı anlamlı bir değişikliği (ruh hali, anı, plan, birikim,
// günün sorusu, buluşma planı, dokunuş...) karşı tarafa iletmek için tek
// merkezi yardımcı. İki şeyi birden yapar:
//   1) Uygulama içi kalıcı bildirim kaydı oluşturur (notifications tablosu) --
//      partner uygulamayı açtığında zil ikonundan görür.
//   2) Partnerin cihazında Expo push jetonu kayıtlıysa gerçek zamanlı push
//      bildirimi (ve titreşim) gönderir.
// Push gönderimi başarısız olsa bile (jeton yok, Expo servisine ulaşılamadı
// vb.) uygulama içi bildirim kaydı her zaman oluşur.

import db from './db';
import { newId } from './util';
import { sendPushNotification } from './push';

export type NotificationType =
  | 'touch'
  | 'mood'
  | 'memory'
  | 'plan_add'
  | 'plan_done'
  | 'savings_goal'
  | 'savings_contribution'
  | 'savings_withdrawal'
  | 'question_answer'
  | 'reunion_update'
  | 'message'
  | 'milestone'
  | 'love_language';

interface NotifyPartnerInput {
  coupleId: string;
  actorId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export function notifyPartner({ coupleId, actorId, type, title, body, data }: NotifyPartnerInput): void {
  const partner: any = db
    .prepare('SELECT id, push_token FROM users WHERE couple_id = ? AND id != ?')
    .get(coupleId, actorId);
  if (!partner) return;

  db.prepare(
    `INSERT INTO notifications (id, couple_id, recipient_id, actor_id, type, title, body)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(newId(), coupleId, partner.id, actorId, type, title, body ?? null);

  if (partner.push_token) {
    sendPushNotification(partner.push_token, { title, body, data: { type, ...(data ?? {}) } }).then(
      ({ shouldClearToken }) => {
        // Expo "bu cihaz artık kayıtlı değil" derse (uygulama kaldırılmış
        // vb.), geçersiz jetona sonsuza dek sessizce başarısız push denemesi
        // yapmamak için DB'deki kaydı temizliyoruz -- kullanıcı uygulamayı
        // tekrar açtığında yeni bir jetonla otomatik olarak yeniden kaydolur.
        if (shouldClearToken) {
          db.prepare('UPDATE users SET push_token = NULL WHERE id = ? AND push_token = ?').run(
            partner.id,
            partner.push_token,
          );
        }
      },
    ).catch(() => {});
  }
}

// notifyPartner'dan farklı olarak burada tek bir "yapan" taraf yok -- bir
// yıldönümü/kilometre taşı (bkz. routes/me.ts checkAnniversaryMilestone)
// İKİ tarafı da aynı anda kutlar. Her iki kullanıcı da hem uygulama içi
// bildirim kaydı hem de (varsa) push bildirimi alır; her birinin "actorName"
// olarak DİĞERİ görünür (ör. partnerin ekranında "Ayşe: 100. gününüz! 🎉"),
// tamamen kozmetik bir seçim -- gerçek bir "gönderen" olmadığı için en
// doğal okunan sonuç bu.
export function notifyCoupleMilestone(coupleId: string, title: string, body: string): void {
  const users = db.prepare('SELECT id, push_token FROM users WHERE couple_id = ?').all(coupleId) as {
    id: string;
    push_token: string | null;
  }[];
  if (users.length < 2) return;

  for (const recipient of users) {
    const other = users.find((u) => u.id !== recipient.id)!;
    db.prepare(
      `INSERT INTO notifications (id, couple_id, recipient_id, actor_id, type, title, body)
       VALUES (?, ?, ?, ?, 'milestone', ?, ?)`,
    ).run(newId(), coupleId, recipient.id, other.id, title, body);

    if (recipient.push_token) {
      sendPushNotification(recipient.push_token, { title, body, data: { type: 'milestone' } })
        .then(({ shouldClearToken }) => {
          if (shouldClearToken) {
            db.prepare('UPDATE users SET push_token = NULL WHERE id = ? AND push_token = ?').run(
              recipient.id,
              recipient.push_token,
            );
          }
        })
        .catch(() => {});
    }
  }
}
