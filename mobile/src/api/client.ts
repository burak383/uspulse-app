import Constants from 'expo-constants';
import { Platform } from 'react-native';

const configuredUrl =
  process.env.EXPO_PUBLIC_API_URL ||
  (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl;

export const API_URL = configuredUrl || 'http://localhost:4000/api';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

let authToken: string | null = null;

/** Called by AuthContext whenever the session token changes. */
export function setAuthToken(token: string | null) {
  authToken = token;
}

// Herhangi bir istek sunucudan 402 (deneme/abonelik süresi doldu, bkz.
// server/src/middleware/subscription.ts requireEntitlement) dönerse
// çağrılır. AuthContext bunu kaydedip entitlement durumunu hemen yeniden
// çeker (refresh()) -- böylece hangi ekranda olursa olsun, ilk engellenen
// istekte kullanıcı otomatik olarak Paywall'a yönlendirilir; ekranların her
// birinin kendi catch bloğunda bunu ayrı ayrı ele almasına gerek kalmaz.
let entitlementBlockedHandler: (() => void) | null = null;
export function setEntitlementBlockedHandler(handler: (() => void) | null) {
  entitlementBlockedHandler = handler;
}

function handleErrorResponse(status: number, data: any, fallbackMessage: string): never {
  const message = (data && data.error) || fallbackMessage;
  if (status === 402) {
    entitlementBlockedHandler?.();
  }
  throw new ApiError(message, status);
}

// AbortController olmadan, zayıf sinyal/captive portal gibi durumlarda
// fetch süresiz askıda kalabilir -- bunu çağıran her ekranın submitting/
// loading state'i de sonsuza kadar takılı kalır, kullanıcının iptal/tekrar
// deneme şansı olmaz. Bu yardımcı, belirtilen sürede yanıt gelmezse isteği
// iptal edip anlamlı bir ApiError fırlatır.
function withTimeout(ms: number): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(timeoutId) };
}

const DEFAULT_TIMEOUT_MS = 20_000;
const UPLOAD_TIMEOUT_MS = 60_000; // video/ses gibi büyük dosyalar daha uzun sürebilir.

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const { signal, clear } = withTimeout(DEFAULT_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal,
    });
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new ApiError('Bağlantı zaman aşımına uğradı. Lütfen internet bağlantını kontrol edip tekrar dene.', 0);
    }
    throw new ApiError('Sunucuya ulaşılamadı. Lütfen internet bağlantını kontrol et.', 0);
  } finally {
    clear();
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    handleErrorResponse(res.status, data, `İstek başarısız oldu (${res.status}).`);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

/**
 * request()/api.* her zaman JSON.stringify + application/json kullanıyor --
 * anı medyası (fotoğraf/video/ses) yüklerken gerçek bir multipart/form-data
 * gövdesi gerekiyor, bu yüzden ayrı bir fonksiyon: fetch'in FormData verince
 * boundary'li Content-Type'ı KENDİSİ otomatik ayarlamasına izin vermek için
 * Content-Type header'ını hiç göndermiyoruz.
 */
export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  const { signal, clear } = withTimeout(UPLOAD_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: {
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: form,
      signal,
    });
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new ApiError('Yükleme zaman aşımına uğradı. Lütfen internet bağlantını kontrol edip tekrar dene.', 0);
    }
    throw new ApiError('Sunucuya ulaşılamadı. Lütfen internet bağlantını kontrol et.', 0);
  } finally {
    clear();
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    handleErrorResponse(res.status, data, `Yükleme başarısız oldu (${res.status}).`);
  }
  return data as T;
}

/**
 * bir `uri`den gelen medyayı (fotoğraf/video/ses) FormData'ya EKLEYEN
 * platforma göre değişen tek nokta. Native'de (iOS/Android) React Native'in
 * kendi FormData'sı `{ uri, name, type }` şeklindeki düz bir nesneyi gerçek
 * bir multipart dosya parçasına çeviriyor -- bu, Expo/RN'in belgelenen
 * standart deseni ve native'de sorunsuz çalışıyor.
 *
 * WEB'de ise `FormData`, tarayıcının kendi implementasyonu ve o SADECE
 * Blob/File kabul ediyor -- Blob/File OLMAYAN bir değer verilince (bkz.
 * WHATWG FormData spesifikasyonu) sessizce `String(value)` ile
 * "[object Object]" metnine çevriliyor. Yani `{uri,name,type}` nesnesi
 * hiçbir zaman gerçek bir dosya olarak gitmiyor -- sunucudaki multer
 * "media" alanını hiç bulamıyor, istek reddediliyor (ya da anlamsız bir
 * hata dönüyor) ve kullanıcı "Kaydet"e basınca (Anılar sekmesinde
 * fotoğraf/video/ses eklerken) sanki hiçbir şey olmamış gibi görünüyordu.
 * Bunu telafi etmek için web'de URI'yi gerçek bir Blob'a çevirip onu
 * ekliyoruz.
 */
export async function appendMediaFile(
  form: FormData,
  field: string,
  media: { uri: string; fileName: string; mimeType: string },
): Promise<void> {
  if (Platform.OS === 'web') {
    const response = await fetch(media.uri);
    const blob = await response.blob();
    form.append(field, blob, media.fileName);
    return;
  }
  form.append(field, {
    uri: media.uri,
    name: media.fileName,
    type: media.mimeType,
  } as unknown as Blob);
}
