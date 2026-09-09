// Sürüş takibi: kullanıcı "Sürüş takibini paylaş" ayarını açtığında,
// otomobille sürüş halindeyken (hız bir eşiğin üstünde kaldığı sürece)
// partnerine GERÇEK ZAMANLI ve TEK TARAFLI hızını ve izlediği yolu (rota)
// gösterir -- normal "Konum" paylaşımından (backgroundLocationTask.ts)
// farklı olarak partnerin karşılık olarak konum paylaşmasına gerek yoktur.
// Bilinçli ve AYRI onay gerektiren bir özelliktir -- bkz.
// AuthContext.enableDrivingShare ve Biz.tsx'teki uyarı metni.
//
// backgroundLocationTask.ts'ten (mesafe paylaşımı, 5dk/250m) BİLEREK ayrı
// bir görev: sürüş takibi çok daha sık güncelleme (yaklaşık 15sn) ister,
// bunu mesafe paylaşımının varsayılan aralığına uygulamak tüm kullanıcılar
// için gereksiz pil/veri tüketimine yol açardı. Bu görev sadece "Sürüş
// takibini paylaş" açıkken çalışır.
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { API_URL } from '../api/client';
import { getSecureItemAsync } from '../storage/secureStorage';

export const DRIVING_LOCATION_TASK = 'uspulse-driving-location-task';

// bkz. AuthContext.tsx'teki TOKEN_KEY ile aynı olmalı -- bu görev headless
// (uygulama arka planda/kapalıyken) çalışabildiği için bellekteki auth
// durumuna güvenilemez, jetonu her seferinde diskten okuyoruz.
const TOKEN_KEY = 'uspulse_token';

// Sürüş sayılması için ulaşılması gereken hız eşiği (km/s) -- hızlı
// yürüyüş/koşu ya da yavaş şehir trafiğini "sürüş" saymamak için seçildi.
const DRIVE_SPEED_THRESHOLD_KMH = 28;
// Hız bu değerin altına düştükten sonra sürüşün "bittiği" kabul edilmesi
// için geçmesi gereken süre -- kısa bir kırmızı ışıkta/trafikte durma
// sürüşü bitirmiş saymasın diye bir tolerans payı.
const STOP_GRACE_MS = 3 * 60 * 1000;

// Bu görev aynı uygulama süreci ayaktayken arka arkaya çağrıldığı için basit
// bir modül-seviyesi durum yeterli (headless bir yeniden başlatmada sıfırlanır,
// bu kabul edilebilir bir sınırlama -- en kötü ihtimalle bir sonraki hızlı
// güncellemede sürüş yeniden "başlamış" gibi algılanır).
let isDriving = false;
let belowThresholdSince: number | null = null;

async function getToken(): Promise<string | null> {
  return getSecureItemAsync(TOKEN_KEY).catch(() => null);
}

async function postStop(token: string) {
  await fetch(`${API_URL}/driving/stop`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {});
}

TaskManager.defineTask(DRIVING_LOCATION_TASK, async ({ data, error }) => {
  if (error) return;
  const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations;
  const last = locations?.[locations.length - 1];
  if (!last) return;

  const speedMs = last.coords.speed;
  const speedKmh = speedMs != null && speedMs >= 0 ? speedMs * 3.6 : 0;
  const now = Date.now();

  try {
    const token = await getToken();
    if (!token) return;

    if (speedKmh >= DRIVE_SPEED_THRESHOLD_KMH) {
      belowThresholdSince = null;
      isDriving = true;
      await fetch(`${API_URL}/driving/point`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          lat: last.coords.latitude,
          lng: last.coords.longitude,
          speedKmh: Math.round(speedKmh),
        }),
      });
    } else if (isDriving) {
      if (belowThresholdSince == null) {
        belowThresholdSince = now;
      } else if (now - belowThresholdSince >= STOP_GRACE_MS) {
        isDriving = false;
        belowThresholdSince = null;
        await postStop(token);
      }
    }
  } catch {
    // ağ hatası ya da sunucu geçici erişilemez -- bir sonraki güncellemede
    // zaten tekrar denenecek, sessizce geç.
  }
});

/**
 * Sürüş konum takibini başlatır. "Her zaman izin ver" konum izni daha önce
 * alınmış olmalı (mesafe paylaşımıyla aynı izin, ayrıca istenmez).
 */
export async function startDrivingLocationTracking(): Promise<boolean> {
  try {
    const already = await Location.hasStartedLocationUpdatesAsync(DRIVING_LOCATION_TASK).catch(
      () => false,
    );
    if (already) return true;
    await Location.startLocationUpdatesAsync(DRIVING_LOCATION_TASK, {
      accuracy: Location.Accuracy.High,
      timeInterval: 15 * 1000,
      distanceInterval: 30,
      showsBackgroundLocationIndicator: false,
      pausesUpdatesAutomatically: false,
      foregroundService: {
        notificationTitle: 'UsPulse sürüş takibi açık',
        notificationBody: 'Sürüş halindeyken hızın ve rotan partnerine gösteriliyor.',
        notificationColor: '#FF8F82',
      },
    });
    return true;
  } catch {
    return false;
  }
}

export async function stopDrivingLocationTracking(): Promise<void> {
  isDriving = false;
  belowThresholdSince = null;
  try {
    const started = await Location.hasStartedLocationUpdatesAsync(DRIVING_LOCATION_TASK);
    if (started) {
      await Location.stopLocationUpdatesAsync(DRIVING_LOCATION_TASK);
    }
  } catch {
    // zaten durmuş olabilir, sorun değil.
  }
  // Görev durdurulunca sunucudaki aktif seyahati de temizle ki partnerin
  // ekranında eski/hayalet bir rota kalmasın.
  const token = await getToken();
  if (token) {
    await postStop(token);
  }
}

export async function isDrivingLocationTrackingActive(): Promise<boolean> {
  try {
    return await Location.hasStartedLocationUpdatesAsync(DRIVING_LOCATION_TASK);
  } catch {
    return false;
  }
}
