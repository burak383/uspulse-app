// Konum güncellemesiyle (PUT /me/location) birlikte -- ekstra bir istek
// yapmadan -- gönderilen şarj yüzdesini/şarj durumunu okumak için ortak
// yardımcı. hem normal (foreground) konum paylaşımı akışında (bkz.
// AuthContext.tsx shareLocationBestEffort/shareLocationNow) hem de headless
// arka plan görevinde (backgroundLocationTask.ts) kullanılıyor -- ikisi de
// aynı mantığı tekrarlamasın diye tek yerde.
import * as Battery from 'expo-battery';

export interface BatteryInfo {
  batteryLevel: number | null;
  charging: boolean | null;
}

/**
 * Cihazın güncel şarj yüzdesini (0-100 tam sayı) ve şarjda olup olmadığını
 * döner. iOS simülatöründe (ve bazı emülatörlerde) expo-battery seviyeyi -1
 * olarak döndürür -- bu durumda ikisi de null döner, PUT /me/location bu
 * alanları hiç göndermez ve sunucu mevcut değeri korur (bkz.
 * server/src/routes/me.ts COALESCE).
 */
export async function readBatteryInfo(): Promise<BatteryInfo> {
  try {
    const [level, state] = await Promise.all([
      Battery.getBatteryLevelAsync(),
      Battery.getBatteryStateAsync(),
    ]);
    if (level == null || level < 0) {
      return { batteryLevel: null, charging: null };
    }
    return {
      batteryLevel: Math.round(level * 100),
      charging: state === Battery.BatteryState.CHARGING || state === Battery.BatteryState.FULL,
    };
  } catch {
    return { batteryLevel: null, charging: null };
  }
}
