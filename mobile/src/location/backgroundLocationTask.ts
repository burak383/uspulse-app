// Uygulama arka plandayken/kapalıyken bile partnerinle aranızdaki mesafeyi
// güncel tutmak için sürekli konum takibi. "Konum (yaklaşık mesafe için)"
// açıldığında (bkz. AuthContext.shareLocationNow) hem ön plan hem "her zaman
// izin ver" (arka plan) konum izni istenir ve bu görev başlatılır.
//
// ÖNEMLİ: TaskManager.defineTask çağrısı modül YÜKLENİR YÜKLENMEZ (component
// mount'undan bağımsız, en üst seviyede) çalışmalı -- OS, uygulamayı arka
// planda "headless" biçimde (kullanıcı açmadan) yeniden başlatıp konum
// güncellemesi teslim edebilir; bu görev o an tanımlı değilse güncelleme
// sessizce kaybolur. Bu yüzden bu dosya AuthContext.tsx'in en üstünde import
// ediliyor.
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../api/client';

export const BACKGROUND_LOCATION_TASK = 'uspulse-background-location-task';

// AuthContext.tsx'teki TOKEN_KEY ile aynı olmalı. Burada bilerek tekrar
// tanımlanıyor: bu görev, uygulamanın normal JS bağlamından bağımsız
// (headless) çalışabildiği için bellekteki auth durumuna (in-memory
// authToken) güvenilemez -- jetonu her seferinde doğrudan diskten okuyoruz.
const TOKEN_KEY = 'uspulse_token';

TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) return;
  const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations;
  const last = locations?.[locations.length - 1];
  if (!last) return;
  try {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (!token) return;
    await fetch(`${API_URL}/me/location`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ lat: last.coords.latitude, lng: last.coords.longitude }),
    });
  } catch {
    // ağ hatası ya da sunucu geçici olarak erişilemez -- bir sonraki
    // güncellemede zaten tekrar denenecek, sessizce geç.
  }
});

/**
 * Arka plan konum takibini başlatır. "Her zaman izin ver" konum izni daha
 * önce alınmış olmalı (bkz. AuthContext.shareLocationNow) -- izin yoksa OS
 * bu çağrıyı reddeder ve false döner.
 */
export async function startBackgroundLocationTracking(): Promise<boolean> {
  try {
    const already = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK).catch(
      () => false,
    );
    if (already) return true;
    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 5 * 60 * 1000, // en az 5 dakikada bir (Android)
      distanceInterval: 250, // ya da 250m'den fazla hareket edince
      showsBackgroundLocationIndicator: false,
      pausesUpdatesAutomatically: false,
      foregroundService: {
        notificationTitle: 'UsPulse konum paylaşımı açık',
        notificationBody: 'Partnerinle aranızdaki mesafeyi güncel tutmak için konumun arka planda paylaşılıyor.',
        notificationColor: '#FF8F82',
      },
    });
    return true;
  } catch {
    return false;
  }
}

export async function stopBackgroundLocationTracking(): Promise<void> {
  try {
    const started = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    if (started) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    }
  } catch {
    // zaten durmuş olabilir, sorun değil.
  }
}

export async function isBackgroundLocationTrackingActive(): Promise<boolean> {
  try {
    return await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  } catch {
    return false;
  }
}
