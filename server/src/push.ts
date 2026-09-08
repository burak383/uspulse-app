// Expo'nun push bildirim servisine (exp.host) istek atan küçük yardımcı.
// Native FCM/APNs kimlik bilgileriyle uğraşmadan, Expo push jetonu olan her
// cihaza bildirim gönderebiliriz. Bkz. https://docs.expo.dev/push-notifications/sending-notifications/

interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/**
 * Bir kullanıcıya push bildirimi göndermeyi dener. Jeton yoksa, geçersizse ya
 * da Expo'nun servisine ulaşılamazsa sessizce vazgeçer -- çağıran kodun asıl
 * işlemini (ör. dokunuş kaydını) ASLA engellememeli veya başarısız etmemeli.
 *
 * Dönüş değeri: Expo'nun "bu jeton artık geçersiz, bir daha gönderme" (cihaz
 * kaydı silinmiş/uygulama kaldırılmış) bilgisini bildirdiği durumda `true`
 * -- çağıran (notify.ts) bunu görürse DB'deki push_token'ı temizler. Aksi
 * halde `false` (başarılı ya da geçici bir hata -- jetonu silme).
 */
export async function sendPushNotification(
  token: string | null | undefined,
  message: Omit<PushMessage, 'to'>,
): Promise<{ shouldClearToken: boolean }> {
  if (!token || !token.startsWith('ExponentPushToken')) return { shouldClearToken: false };
  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: token,
        title: message.title,
        body: message.body,
        data: message.data ?? {},
        sound: 'default',
        priority: 'high',
        channelId: 'touches',
      }),
    });
    const json: any = await res.json().catch(() => null);
    // Expo, tek mesaj için tek elemanlı bir "ticket" dizisi döner. Cihaz
    // kaydı artık geçersizse ticket.details.error === 'DeviceNotRegistered'
    // olur -- bkz. https://docs.expo.dev/push-notifications/sending-notifications/#individual-errors
    const ticket = json?.data?.[0] ?? json?.data;
    if (ticket?.status === 'error' && ticket?.details?.error === 'DeviceNotRegistered') {
      return { shouldClearToken: true };
    }
    return { shouldClearToken: false };
  } catch {
    // ağ hatası ya da Expo servisi geçici olarak erişilemez -- yutuyoruz,
    // bu geçici bir durum olabileceğinden jetonu SİLMİYORUZ.
    return { shouldClearToken: false };
  }
}
