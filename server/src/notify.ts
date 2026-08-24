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
  | 'question_answer'
  | 'reunion_update';

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
    sendPushNotification(partner.push_token, { title, body, data: { type, ...(data ?? {}) } });
  }
}
