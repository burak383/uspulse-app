// Ana ekran widget'ının (Android: src/widgets/UsPulseWidget.tsx +
// widget-task-handler.tsx; iOS: targets/widget/widgets.swift) okuduğu,
// KÜÇÜK ve JSON'a çevrilebilir bir "anlık görüntü". Widget'ın kendi ağ/
// oturum mantığı YOK -- uygulama zaten sahip olduğu GET /me verisini burada
// depolar, widget da sadece bunu yansıtır. Bu fonksiyon AuthContext.tsx'teki
// applyMe() içinden, her başarılı /me çekişinde çağrılır (bkz. oradaki
// yorum) -- yani giriş, ön plana dönüş, eşleşme, konum paylaşımı gibi
// PEK ÇOK noktada dolaylı olarak otomatik tetiklenir, ayrı bir polling
// döngüsü kurmaya gerek kalmaz.
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { requestWidgetUpdate } from 'react-native-android-widget';
import { ExtensionStorage } from '@bacons/apple-targets';
import { MeResponse } from '../api/types';
import { renderUsPulseWidget } from './UsPulseWidget';

export const WIDGET_SNAPSHOT_KEY = 'uspulse_widget_snapshot';
export const ANDROID_WIDGET_NAME = 'UsPulseWidget';
// bkz. app.json ios.entitlements ve targets/widget/expo-target.config.js --
// widget hedefi, ana uygulamanın app group'unu OTOMATİK devralıyor
// (@bacons/apple-targets'ın varsayılan davranışı), bu yüzden burada da
// AYNI değer elle yazılmış durumda.
const IOS_APP_GROUP = 'group.app.uspulse.mobile';

export interface WidgetSnapshot {
  daysTogether: number | null;
  partnerName: string | null;
  distanceKm: number | null;
  updatedAt: string;
}

// bkz. server/src/routes/me.ts daysSinceCoupleStart -- AYNI hesaplama,
// widget'ın gösterdiği gün sayısının Biz ekranındaki ve sunucudaki
// yıldönümü bildirimleriyle birebir tutarlı olması için.
function daysSinceCoupleStart(createdAt?: string | null): number | null {
  if (!createdAt) return null;
  const isoLike = createdAt.includes('T') ? createdAt : `${createdAt.replace(' ', 'T')}Z`;
  const start = new Date(isoLike);
  if (Number.isNaN(start.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - start.getTime()) / 86400000));
}

export async function readWidgetSnapshot(): Promise<WidgetSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(WIDGET_SNAPSHOT_KEY);
    return raw ? (JSON.parse(raw) as WidgetSnapshot) : null;
  } catch {
    return null;
  }
}

export async function syncWidgetSnapshot(me: MeResponse): Promise<void> {
  // Eşleşmemiş bir kullanıcı için gösterecek anlamlı bir şey yok -- widget
  // "Açmak için dokun" gibi boş bir durum gösterir (bkz. UsPulseWidget.tsx /
  // widgets.swift'teki placeholder dalı).
  const snapshot: WidgetSnapshot = {
    daysTogether: daysSinceCoupleStart(me.couple?.created_at),
    partnerName: me.partner?.name ?? null,
    distanceKm: me.distanceKm,
    updatedAt: new Date().toISOString(),
  };

  try {
    await AsyncStorage.setItem(WIDGET_SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch {
    // sessizce geç -- widget bir sonraki başarılı senkronizasyona kadar eski
    // veriyi göstermeye devam eder.
    return;
  }

  if (Platform.OS === 'android') {
    try {
      // requestWidgetUpdate, widget ana ekrana hiç eklenmemişse (widgetsInfo
      // boş döner) sessizce hiçbir şey yapmaz -- ayrıca kontrol etmeye gerek yok.
      await requestWidgetUpdate({
        widgetName: ANDROID_WIDGET_NAME,
        renderWidget: () => renderUsPulseWidget(snapshot),
      });
    } catch {
      // sessizce geç.
    }
  } else if (Platform.OS === 'ios') {
    try {
      const storage = new ExtensionStorage(IOS_APP_GROUP);
      // ExtensionStorage yalnızca düz string/number/array değerleri yazabilir
      // (bkz. paketin kendi ExtensionStorageModule.swift'i) -- bu yüzden
      // snapshot'ı tek bir nesne yerine alan alan yazıyoruz. null'lar için
      // Swift tarafında ayırt edilebilir bir "yok" değeri (-1 / boş metin)
      // kullanılıyor (bkz. targets/widget/widgets.swift readEntry()).
      storage.set('daysTogether', snapshot.daysTogether ?? -1);
      storage.set('partnerName', snapshot.partnerName ?? '');
      storage.set('distanceKm', snapshot.distanceKm ?? -1);
      storage.set('updatedAt', snapshot.updatedAt);
      ExtensionStorage.reloadWidget();
    } catch {
      // Widget hedefi bu build'de yoksa (ör. henüz `expo prebuild` +
      // widget eklentisiyle derlenmemiş bir geliştirme build'i) sessizce geç.
    }
  }
}

// Çıkış yapıldığında ya da hesap silindiğinde (bkz. AuthContext.tsx
// logout/deleteAccount) çağrılır. Aksi halde -- aynı cihazda farklı bir
// hesapla giriş yapılana kadar (ya da hiç yeniden giriş yapılmazsa) --
// widget, ÖNCEKİ kullanıcının/çiftin "birlikte X gündür", partner adı ve
// mesafe bilgisini göstermeye devam eder. Paylaşımlı/aile cihazlarında bu
// gerçek bir gizlilik sızıntısı: widget'ı hemen boş/placeholder duruma
// döndürüyoruz.
export async function clearWidgetSnapshot(): Promise<void> {
  try {
    await AsyncStorage.removeItem(WIDGET_SNAPSHOT_KEY);
  } catch {
    // sessizce geç
  }

  const emptySnapshot: WidgetSnapshot = {
    daysTogether: null,
    partnerName: null,
    distanceKm: null,
    updatedAt: new Date().toISOString(),
  };

  if (Platform.OS === 'android') {
    try {
      await requestWidgetUpdate({
        widgetName: ANDROID_WIDGET_NAME,
        renderWidget: () => renderUsPulseWidget(emptySnapshot),
      });
    } catch {
      // sessizce geç.
    }
  } else if (Platform.OS === 'ios') {
    try {
      const storage = new ExtensionStorage(IOS_APP_GROUP);
      storage.set('daysTogether', -1);
      storage.set('partnerName', '');
      storage.set('distanceKm', -1);
      storage.set('updatedAt', emptySnapshot.updatedAt);
      ExtensionStorage.reloadWidget();
    } catch {
      // sessizce geç.
    }
  }
}
