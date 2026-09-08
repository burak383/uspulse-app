import { Platform } from 'react-native';
import Constants from 'expo-constants';
import Purchases from 'react-native-purchases';

// RevenueCat API anahtarları (public/istemci anahtarları -- gizli değildir,
// uygulama koduna gömülmesi normaldir) app.json > expo.extra.revenueCat
// altında tutulur. Kullanıcı henüz RevenueCat projesini/App Store-Google Play
// ürünlerini oluşturmadığı için bu değerler şimdilik boş -- doldurulana kadar
// configureRevenueCat() sessizce hiçbir şey yapmaz (Expo Go'da zaten native
// satın alma çalışmıyor, bkz. react-native-purchases README: "Preview API
// Mode"). bkz. mobile kurulum notları (SUBSCRIPTIONS_SETUP.md).
interface RevenueCatExtra {
  iosApiKey?: string;
  androidApiKey?: string;
}

function getApiKey(): string | null {
  const extra = (Constants.expoConfig?.extra as { revenueCat?: RevenueCatExtra } | undefined)?.revenueCat;
  const key = Platform.OS === 'ios' ? extra?.iosApiKey : extra?.androidApiKey;
  return key && key.trim().length > 0 ? key.trim() : null;
}

let configured = false;

/**
 * Uygulama açılışında bir kez çağrılır (bkz. AuthContext). API anahtarı henüz
 * girilmediyse (kullanıcı RevenueCat projesini oluşturmadıysa) ya da
 * platform desteklenmiyorsa sessizce hiçbir şey yapmaz -- bu durumda
 * getOfferings/purchasePackage çağrıları başarısız olur ve Paywall ekranı
 * "abonelik şu an kullanılamıyor" mesajı gösterir, uygulama çökmez.
 */
export function configureRevenueCat() {
  if (configured) return;
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn(
      '[RevenueCat] API anahtarı ayarlanmamış (app.json > expo.extra.revenueCat) -- abonelik özellikleri devre dışı.',
    );
    return;
  }
  try {
    Purchases.configure({ apiKey });
    configured = true;
  } catch (e) {
    console.warn('[RevenueCat] configure başarısız:', e);
  }
}

export function isRevenueCatConfigured() {
  return configured;
}

/**
 * Çift bazlı abonelik tasarımı: appUserID olarak coupleId kullanılır ki
 * partnerlerden biri abone olduğunda RevenueCat'in kendi backend'i
 * üzerinden ikisi de otomatik olarak aynı "customer"a bağlanıp aynı
 * entitlement'ı görsün -- ayrı bir cross-device senkronizasyon
 * yazmamıza gerek kalmaz. bkz. server/src/middleware/subscription.ts.
 */
export async function loginRevenueCatCouple(coupleId: string) {
  if (!configured) return;
  try {
    await Purchases.logIn(coupleId);
  } catch (e) {
    console.warn('[RevenueCat] logIn başarısız:', e);
  }
}

/** Uygulamadan çıkış yapıldığında RevenueCat oturumunu da temizler. */
export async function logoutRevenueCat() {
  if (!configured) return;
  try {
    const isAnon = await Purchases.isAnonymous();
    if (!isAnon) {
      await Purchases.logOut();
    }
  } catch (e) {
    console.warn('[RevenueCat] logOut başarısız:', e);
  }
}
