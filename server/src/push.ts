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
 */
export async function sendPushNotification(
  token: string | null | undefined,
  message: Omit<PushMessage, 'to'>,
): Promise<void> {
  if (!token || !token.startsWith('ExponentPushToken')) return;
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
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
  } catch {
    // ağ hatası ya da Expo servisi geçici olarak erişilemez -- yutuyoruz.
  }
}
