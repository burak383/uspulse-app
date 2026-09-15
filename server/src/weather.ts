// Partnerin bulunduğu yerin ANLIK hava durumu (bkz. routes/weather.ts,
// mobile/screens/PartnerKonum.tsx). Open-Meteo -- API anahtarı gerektirmeyen
// ücretsiz bir servis (https://open-meteo.com) -- kullanılıyor ki .env'e
// yeni bir sır eklemeye gerek kalmasın.
//
// Konum birkaç dakikada bir güncellense de hava durumu bu kadar sık
// değişmez; aynı zamanda partner ekranı 5 saniyede bir GET /me çağırıyor
// (bkz. PartnerKonum.tsx POLL_MS). Bu yüzden burada koordinat başına kısa
// bir bellek-içi önbellek tutuyoruz -- hem gereksiz dış istekleri önler hem
// de Open-Meteo'nun ücretsiz kullanım sınırlarını zorlamayız.
interface WeatherSnapshot {
  tempC: number;
  code: number;
  isDay: boolean;
  at: string;
}

const CACHE_MS = 10 * 60 * 1000; // 10 dakika
const cache = new Map<string, { data: WeatherSnapshot; fetchedAt: number }>();

function cacheKey(lat: number, lng: number): string {
  // ~1km hassasiyete yuvarlıyoruz -- konumdaki küçük GPS kaymaları için
  // gereksiz yere tekrar istek atmayı önler, aynı şehirdeki iki nokta aynı
  // önbellek girdisini paylaşır.
  return `${lat.toFixed(2)},${lng.toFixed(2)}`;
}

export async function getWeatherSnapshot(lat: number, lng: number): Promise<WeatherSnapshot | null> {
  const key = cacheKey(lat, lng);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_MS) {
    return cached.data;
  }
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code,is_day&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) return cached?.data ?? null;
    const json: any = await res.json();
    const current = json?.current;
    if (!current || typeof current.temperature_2m !== 'number') return cached?.data ?? null;
    const data: WeatherSnapshot = {
      tempC: Math.round(current.temperature_2m),
      code: Number(current.weather_code) || 0,
      isDay: current.is_day === 1,
      at: new Date().toISOString(),
    };
    cache.set(key, { data, fetchedAt: Date.now() });
    return data;
  } catch {
    // Open-Meteo'ya ulaşılamıyorsa, elimizde eski (süresi dolmuş) bir
    // önbellek varsa onu döndürmek, hiç göstermemekten daha iyi bir deneyim --
    // yoksa null dönüp istemci "hava durumu şu an alınamıyor" gösterir.
    return cached?.data ?? null;
  }
}

// WMO hava durumu kodları (Open-Meteo'nun standardı) -- Türkçe açıklama +
// MaterialCommunityIcons ikon adına eşleme. Tam liste:
// https://open-meteo.com/en/docs içindeki "WMO Weather interpretation codes".
const WEATHER_CODE_TABLE: Record<number, { description: string; dayIcon: string; nightIcon: string }> = {
  0: { description: 'Açık', dayIcon: 'weather-sunny', nightIcon: 'weather-night' },
  1: { description: 'Az bulutlu', dayIcon: 'weather-partly-cloudy', nightIcon: 'weather-night-partly-cloudy' },
  2: { description: 'Parçalı bulutlu', dayIcon: 'weather-partly-cloudy', nightIcon: 'weather-night-partly-cloudy' },
  3: { description: 'Kapalı', dayIcon: 'weather-cloudy', nightIcon: 'weather-cloudy' },
  45: { description: 'Sisli', dayIcon: 'weather-fog', nightIcon: 'weather-fog' },
  48: { description: 'Kırağı sisi', dayIcon: 'weather-fog', nightIcon: 'weather-fog' },
  51: { description: 'Hafif çisenti', dayIcon: 'weather-partly-rainy', nightIcon: 'weather-partly-rainy' },
  53: { description: 'Çisenti', dayIcon: 'weather-rainy', nightIcon: 'weather-rainy' },
  55: { description: 'Yoğun çisenti', dayIcon: 'weather-pouring', nightIcon: 'weather-pouring' },
  56: { description: 'Dondurucu çisenti', dayIcon: 'weather-snowy-rainy', nightIcon: 'weather-snowy-rainy' },
  57: { description: 'Yoğun dondurucu çisenti', dayIcon: 'weather-snowy-rainy', nightIcon: 'weather-snowy-rainy' },
  61: { description: 'Hafif yağmurlu', dayIcon: 'weather-partly-rainy', nightIcon: 'weather-partly-rainy' },
  63: { description: 'Yağmurlu', dayIcon: 'weather-rainy', nightIcon: 'weather-rainy' },
  65: { description: 'Şiddetli yağmur', dayIcon: 'weather-pouring', nightIcon: 'weather-pouring' },
  66: { description: 'Dondurucu yağmur', dayIcon: 'weather-snowy-rainy', nightIcon: 'weather-snowy-rainy' },
  67: { description: 'Şiddetli dondurucu yağmur', dayIcon: 'weather-snowy-rainy', nightIcon: 'weather-snowy-rainy' },
  71: { description: 'Hafif kar yağışlı', dayIcon: 'weather-snowy', nightIcon: 'weather-snowy' },
  73: { description: 'Kar yağışlı', dayIcon: 'weather-snowy', nightIcon: 'weather-snowy' },
  75: { description: 'Yoğun kar yağışı', dayIcon: 'weather-snowy-heavy', nightIcon: 'weather-snowy-heavy' },
  77: { description: 'Kar taneli', dayIcon: 'weather-snowy', nightIcon: 'weather-snowy' },
  80: { description: 'Hafif sağanak', dayIcon: 'weather-partly-rainy', nightIcon: 'weather-partly-rainy' },
  81: { description: 'Sağanak yağışlı', dayIcon: 'weather-pouring', nightIcon: 'weather-pouring' },
  82: { description: 'Şiddetli sağanak', dayIcon: 'weather-pouring', nightIcon: 'weather-pouring' },
  85: { description: 'Kar sağanağı', dayIcon: 'weather-snowy', nightIcon: 'weather-snowy' },
  86: { description: 'Yoğun kar sağanağı', dayIcon: 'weather-snowy-heavy', nightIcon: 'weather-snowy-heavy' },
  95: { description: 'Gök gürültülü fırtına', dayIcon: 'weather-lightning', nightIcon: 'weather-lightning' },
  96: { description: 'Dolu ile fırtına', dayIcon: 'weather-hail', nightIcon: 'weather-hail' },
  99: { description: 'Şiddetli dolulu fırtına', dayIcon: 'weather-hail', nightIcon: 'weather-hail' },
};

export function describeWeatherCode(code: number, isDay: boolean): { description: string; icon: string } {
  const entry = WEATHER_CODE_TABLE[code];
  if (!entry) return { description: 'Hava durumu', icon: 'weather-cloudy' };
  return { description: entry.description, icon: isDay ? entry.dayIcon : entry.nightIcon };
}
