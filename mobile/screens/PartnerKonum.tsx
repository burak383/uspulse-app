// Partnerin canlı konumunu haritada gösteren ekran. bkz. Biz.tsx'teki
// "Konum" gizlilik ayarı ve server/src/routes/me.ts -- partnerLat/partnerLng
// yalnızca İKİNİZ DE konum paylaşımını açtıysanız sunucudan döner (karşılıklı
// rıza şartı), bu ekran salt görüntüleme amaçlı; açma/kapama anahtarı
// Biz.tsx'teki "Gizliliğiniz sizin elinizde" kartında.
//
// Sürüş takibi (hız + rota) ARTIK ayrı bir ekran/sekme DEĞİL -- buraya
// gömülü: partner otomobille sürüş halindeyse (bkz. server/src/routes/
// driving.ts GET /partner) harita normal avatar işaretçisi yerine canlı
// rotayı ve hız kartını gösterir; sürüş halinde değilse (ya da hiç
// paylaşmıyorsa) aşağıdaki normal konum görünümüne döner. Sürüş paylaşımı
// AYRI bir onay gerektirmiyor -- Konum paylaşımı açıkken otomatik etkinleşir
// (bkz. src/context/AuthContext.tsx syncBackgroundLocationTracking).
import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
// react-native'in kendi SafeAreaView'ı yalnızca iOS'ta gerçek bir şey yapar --
// Android'de düz bir View'dan farksızdır (bkz. RN kaynağı), bu yüzden
// react-native-safe-area-context'in App.tsx'teki SafeAreaProvider'dan gerçek
// güvenli alan (status bar / gesture nav) değerlerini okuyan sürümünü
// kullanıyoruz -- iki platformda da doğru boşluk bırakır.
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Callout, Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { theme } from '../theme';
import { useAuth } from '../src/context/AuthContext';
import { api } from '../src/api/client';
import { DrivingPoint, DrivingStatusResponse, MeResponse, WeatherResponse } from '../src/api/types';
import { RootStackParamList, TabRouteName } from '../navigation/types';
import { BottomTabBar } from '../src/components/BottomTabBar';
import { AvatarView } from '../src/components/AvatarView';
import { parseSqliteTimestamp } from '../src/utils/date';

const colors = theme.colors;

// Ekran görünürken 5 saniyede bir hem konumu hem sürüş durumunu tazeler,
// ekrandan çıkınca durur.
const POLL_MS = 5000;
// Hava durumu, konum kadar sık değişmez -- ayrı ve çok daha seyrek bir
// döngüyle çekiliyor (sunucu tarafında da ayrıca önbelleğe alınıyor, bkz.
// server/src/weather.ts) ki gereksiz yere dış API'ye istek atılmasın.
const WEATHER_POLL_MS = 10 * 60 * 1000;

// MaterialCommunityIcons'ta sadece 10'un katları için ayrı bir "dolgu"
// ikonu var (battery-10, battery-20, ... battery-90) + tam dolu için
// düz "battery" -- yüzdeyi en yakın 10'a yuvarlayıp bu setten seçiyoruz.
type BatteryIconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
function batteryIconFor(level: number, charging: boolean | null): BatteryIconName {
  if (charging) return 'battery-charging';
  const rounded = Math.min(90, Math.max(10, Math.round(level / 10) * 10));
  return level >= 95 ? 'battery' : (`battery-${rounded}` as BatteryIconName);
}

// Partnerin avatarına dokununca (bkz. aşağıdaki Callout) "3 saattir
// buradasın" gibi göstermek için -- server/src/routes/me.ts PUT /location,
// konum anlamlı ölçüde değişmediği sürece stationary_since'i sabit tutuyor.
function formatStationaryDuration(value: string | null): string | null {
  const since = parseSqliteTimestamp(value);
  if (!since) return null;
  const minutes = Math.max(0, Math.round((Date.now() - since.getTime()) / 60000));
  if (minutes < 1) return 'Az önce buraya geldi';
  if (minutes < 60) return `${minutes} dakikadır burada`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const remMinutes = minutes % 60;
    return remMinutes > 0 ? `${hours} saat ${remMinutes} dakikadır burada` : `${hours} saattir burada`;
  }
  const days = Math.floor(hours / 24);
  return `${days} gündür burada`;
}

type NavProp = NativeStackNavigationProp<RootStackParamList, 'PartnerKonum'>;

export default function PartnerLocationScreen({ navigation }: { navigation: NavProp }) {
  const { partner } = useAuth();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [driving, setDriving] = useState<DrivingStatusResponse | null>(null);
  const [weather, setWeather] = useState<WeatherResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const mapRef = useRef<MapView>(null);
  const hasCentered = useRef(false);
  const lastDrivingPointCount = useRef(0);
  // Artık Biz.tsx'teki bir menü satırından değil, diğer sekmeler (Yuva,
  // Planlar, Anılar, Biz) gibi doğrudan alttaki sekme çubuğundan açılıyor --
  // bkz. navigation/RootNavigator.tsx ve src/components/BottomTabBar.tsx.
  const goTab = (route: TabRouteName) => navigation.navigate(route);

  const load = useCallback(async () => {
    try {
      const [meRes, drivingRes] = await Promise.all([
        api.get<MeResponse>('/me'),
        api.get<DrivingStatusResponse>('/driving/partner').catch(
          (): DrivingStatusResponse => ({ active: false }),
        ),
      ]);
      setMe(meRes);
      setDriving(drivingRes);

      if (drivingRes.active && drivingRes.points.length > 0) {
        if (drivingRes.points.length !== lastDrivingPointCount.current) {
          lastDrivingPointCount.current = drivingRes.points.length;
          mapRef.current?.fitToCoordinates(
            drivingRes.points.map((p) => ({ latitude: p.lat, longitude: p.lng })),
            {
              edgePadding: { top: 80, right: 60, bottom: 160, left: 60 },
              animated: true,
            },
          );
        }
      } else {
        lastDrivingPointCount.current = 0;
        if (meRes.partnerLat != null && meRes.partnerLng != null && !hasCentered.current) {
          hasCentered.current = true;
          mapRef.current?.animateToRegion(
            {
              latitude: meRes.partnerLat,
              longitude: meRes.partnerLng,
              latitudeDelta: 0.02,
              longitudeDelta: 0.02,
            },
            300,
          );
        }
      }
      if (meRes.partnerLat == null) {
        hasCentered.current = false;
      }
    } catch {
      // sessizce geç -- bir sonraki 5sn'lik denemede tekrar çekilecek.
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      load();
      const interval = setInterval(() => {
        if (!cancelled) load();
      }, POLL_MS);
      return () => {
        cancelled = true;
        clearInterval(interval);
      };
    }, [load]),
  );

  const loadWeather = useCallback(async () => {
    try {
      const res = await api.get<WeatherResponse>('/weather/partner');
      setWeather(res);
    } catch {
      // sessizce geç -- kart zaten "available" olmayan durumu gizliyor,
      // bir sonraki döngüde tekrar denenecek.
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      loadWeather();
      const interval = setInterval(() => {
        if (!cancelled) loadWeather();
      }, WEATHER_POLL_MS);
      return () => {
        cancelled = true;
        clearInterval(interval);
      };
    }, [loadWeather]),
  );

  const partnerName = partner?.name ?? 'Partnerin';
  const shared = me?.partnerLat != null && me?.partnerLng != null;
  const stationaryText = formatStationaryDuration(me?.partnerStationarySince ?? null);
  const isDriving = shared && driving?.active === true;
  const lastDrivingPoint: DrivingPoint | null =
    isDriving && driving.active && driving.points.length > 0 ? driving.points[driving.points.length - 1] : null;

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Durum çubuğu App.tsx'te genel olarak (expo-status-bar, style="light")
          ayarlanıyor -- bkz. AvatarSecimi.tsx'teki aynı açıklama. */}
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Konum</Text>
          <Text style={styles.subtitle}>
            {isDriving ? `${partnerName} şu an sürüş halinde` : `${partnerName}'in şu anki konumu`}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : shared && me && isDriving && lastDrivingPoint ? (
        <View style={styles.mapWrap}>
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFillObject}
            provider={PROVIDER_GOOGLE}
            initialRegion={{
              latitude: lastDrivingPoint.lat,
              longitude: lastDrivingPoint.lng,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }}
          >
            {driving.active && driving.points.length > 1 && (
              <Polyline
                coordinates={driving.points.map((p) => ({ latitude: p.lat, longitude: p.lng }))}
                strokeColor={colors.primary}
                strokeWidth={4}
              />
            )}
            <Marker
              coordinate={{ latitude: lastDrivingPoint.lat, longitude: lastDrivingPoint.lng }}
              title={partnerName}
              description={driving.active ? `${driving.speedKmh} km/s` : undefined}
            >
              <View style={styles.markerDot}>
                <MaterialCommunityIcons name="car" size={16} color={colors.primaryForeground} />
              </View>
            </Marker>
          </MapView>

          {driving.active && (
            <View style={styles.speedCard}>
              <MaterialCommunityIcons name="speedometer" size={22} color={colors.primary} />
              <View>
                <Text style={styles.speedValue}>{driving.speedKmh} km/s</Text>
                <Text style={styles.speedCaption}>{partnerName} şu an sürüş halinde</Text>
              </View>
            </View>
          )}
        </View>
      ) : shared && me ? (
        <View style={styles.mapWrap}>
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFillObject}
            provider={PROVIDER_GOOGLE}
            initialRegion={{
              latitude: me.partnerLat as number,
              longitude: me.partnerLng as number,
              latitudeDelta: 0.02,
              longitudeDelta: 0.02,
            }}
          >
            <Marker coordinate={{ latitude: me.partnerLat as number, longitude: me.partnerLng as number }} title={partnerName}>
              <View style={styles.markerDot}>
                <AvatarView
                  avatarUrl={partner?.avatarUrl}
                  size={26}
                  fallbackIcon="account"
                  fallbackColor={colors.primaryForeground}
                />
              </View>
              {/* Avatara dokununca harita bunu otomatik açar (react-native-maps'in
                  varsayılan Marker/Callout davranışı) -- "ne kadar süredir
                  burada" bilgisini göstermek için bkz. formatStationaryDuration. */}
              <Callout tooltip>
                <View style={styles.calloutCard}>
                  <Text style={styles.calloutTitle}>{partnerName}</Text>
                  {stationaryText && <Text style={styles.calloutText}>{stationaryText}</Text>}
                </View>
              </Callout>
            </Marker>
          </MapView>

          {weather?.shared && weather.available && (
            <View style={styles.weatherCard}>
              <MaterialCommunityIcons
                name={weather.icon as React.ComponentProps<typeof MaterialCommunityIcons>['name']}
                size={22}
                color={colors.primary}
              />
              <View>
                <Text style={styles.weatherTemp}>{weather.tempC}°</Text>
                <Text style={styles.weatherDescription}>{weather.description}</Text>
              </View>
            </View>
          )}

          {me.distanceKm != null && (
            <View style={styles.distanceCard}>
              <MaterialCommunityIcons name="map-marker-distance" size={20} color={colors.primary} />
              <Text style={[styles.distanceText, { flex: 1 }]}>Aranızda ~{me.distanceKm} km var</Text>
              {me.partnerBatteryLevel != null && (
                <>
                  <View style={styles.distanceDivider} />
                  <MaterialCommunityIcons
                    name={batteryIconFor(me.partnerBatteryLevel, me.partnerBatteryCharging)}
                    size={20}
                    color={me.partnerBatteryLevel <= 20 && !me.partnerBatteryCharging ? colors.destructive : colors.primary}
                  />
                  <Text style={styles.distanceText}>%{me.partnerBatteryLevel}</Text>
                </>
              )}
            </View>
          )}
        </View>
      ) : (
        <View style={styles.centered}>
          <MaterialCommunityIcons name="map-marker-off-outline" size={40} color={colors.mutedForeground} />
          <Text style={styles.emptyTitle}>Konum paylaşımı kapalı</Text>
          <Text style={styles.emptyCaption}>
            {partnerName}'in konumunu (ve varsa sürüş halini) görebilmen için ikinizin de Biz sekmesinden
            konum paylaşımını açmış olması gerekiyor.
          </Text>
        </View>
      )}

      <BottomTabBar active="PartnerKonum" onNavigate={goTab} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerCopy: { alignItems: 'center' },
  title: { fontFamily: theme.fonts.heading, fontSize: 20, color: colors.foreground },
  subtitle: { fontFamily: theme.fonts.body, fontSize: 12, color: colors.mutedForeground, marginTop: 2 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 10 },
  emptyTitle: { fontFamily: theme.fonts.heading, fontSize: 17, color: colors.foreground, textAlign: 'center' },
  emptyCaption: {
    fontFamily: theme.fonts.body,
    fontSize: 13,
    color: colors.mutedForeground,
    textAlign: 'center',
    lineHeight: 19,
  },
  mapWrap: { flex: 1 },
  weatherCard: {
    position: 'absolute',
    top: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  weatherTemp: { fontFamily: theme.fonts.heading, fontSize: 15, color: colors.foreground },
  weatherDescription: { fontFamily: theme.fonts.body, fontSize: 11, color: colors.mutedForeground, marginTop: 1 },
  markerDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.foreground,
  },
  distanceCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    // Alttaki sekme çubuğunun (bkz. BottomTabBar) üstünde kalması için 24
    // yerine 100 -- aksi halde bu kart çubuğun arkasında/üstünde çakışırdı.
    bottom: 100,
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  distanceText: { fontFamily: theme.fonts.heading, fontSize: 15, color: colors.foreground },
  distanceDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: colors.border,
  },
  speedCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    // bkz. distanceCard'daki aynı gerekçe -- alttaki sekme çubuğunun üstünde
    // kalması için 24 yerine 100.
    bottom: 100,
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  speedValue: { fontFamily: theme.fonts.heading, fontSize: 20, color: colors.foreground },
  speedCaption: { fontFamily: theme.fonts.body, fontSize: 12, color: colors.mutedForeground },
  calloutCard: {
    minWidth: 150,
    maxWidth: 220,
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  calloutTitle: { fontFamily: theme.fonts.heading, fontSize: 14, color: colors.foreground },
  calloutText: {
    fontFamily: theme.fonts.body,
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 2,
  },
});
