// Sürüş takibi ekranı: partnerin, hızı bir eşiğin üzerinde kaldığı sürece
// ("sürüş halinde") anlık hızını ve izlediği yolu (rota) burada CANLI
// gösterir. bkz. server/src/routes/driving.ts ve
// src/location/drivingLocationTask.ts -- geçmiş TUTULMAZ, sadece o an aktif
// olan seyahat gösterilir; sürüş bitince (ya da hiç başlamadıysa) boş durum
// gösterilir.
//
// Kendi sürüşünü partnerine paylaşma AÇ/KAPA anahtarı BİLEREK burada değil,
// Biz.tsx'teki "Gizliliğiniz sizin elinizde" kartında (diğer tüm gizlilik
// anahtarlarıyla aynı yerde) -- bu ekran salt görüntüleme amaçlı.
import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, StatusBar, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { theme } from '../theme';
import { useAuth } from '../src/context/AuthContext';
import { api } from '../src/api/client';
import { DrivingPoint, DrivingStatusResponse } from '../src/api/types';
import { RootStackParamList } from '../navigation/types';

const colors = theme.colors;

// Partnerin ekranı 15 saniyede bir güncellenirken, biz burada biraz daha sık
// (5sn) sorarak canlı hissini korumaya çalışıyoruz -- ekran görünürken (bkz.
// useFocusEffect) çalışır, ekrandan çıkınca hemen durur.
const POLL_MS = 5000;

type NavProp = NativeStackNavigationProp<RootStackParamList, 'Surus'>;

export default function DrivingScreen({ navigation }: { navigation: NavProp }) {
  const { partner } = useAuth();
  const [status, setStatus] = useState<DrivingStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const mapRef = useRef<MapView>(null);
  const lastPointCount = useRef(0);

  const load = useCallback(async () => {
    try {
      const res = await api.get<DrivingStatusResponse>('/driving/partner');
      setStatus(res);
      if (res.active && res.points.length > 0 && res.points.length !== lastPointCount.current) {
        lastPointCount.current = res.points.length;
        mapRef.current?.fitToCoordinates(
          res.points.map((p) => ({ latitude: p.lat, longitude: p.lng })),
          {
            edgePadding: { top: 80, right: 60, bottom: 160, left: 60 },
            animated: true,
          },
        );
      }
      if (!res.active) {
        lastPointCount.current = 0;
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

  const partnerName = partner?.name ?? 'Partnerin';
  const active = status?.active === true;
  const lastPoint: DrivingPoint | null = active && status.points.length > 0 ? status.points[status.points.length - 1] : null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Geri dön"
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialCommunityIcons name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Sürüş</Text>
          <Text style={styles.subtitle}>{partnerName} şu an araçtaysa burada görürsün</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : active && lastPoint ? (
        <View style={styles.mapWrap}>
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFillObject}
            provider={PROVIDER_GOOGLE}
            initialRegion={{
              latitude: lastPoint.lat,
              longitude: lastPoint.lng,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }}
          >
            {status.points.length > 1 && (
              <Polyline
                coordinates={status.points.map((p) => ({ latitude: p.lat, longitude: p.lng }))}
                strokeColor={colors.primary}
                strokeWidth={4}
              />
            )}
            <Marker
              coordinate={{ latitude: lastPoint.lat, longitude: lastPoint.lng }}
              title={partnerName}
              description={`${status.speedKmh} km/s`}
            >
              <View style={styles.markerDot}>
                <MaterialCommunityIcons name="car" size={16} color={colors.primaryForeground} />
              </View>
            </Marker>
          </MapView>

          <View style={styles.speedCard}>
            <MaterialCommunityIcons name="speedometer" size={22} color={colors.primary} />
            <View>
              <Text style={styles.speedValue}>{status.speedKmh} km/s</Text>
              <Text style={styles.speedCaption}>{partnerName} şu an sürüş halinde</Text>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.centered}>
          <MaterialCommunityIcons name="car-off" size={40} color={colors.mutedForeground} />
          <Text style={styles.emptyTitle}>{partnerName} şu an sürüş halinde değil</Text>
          <Text style={styles.emptyCaption}>
            {partnerName} sürüş takibini paylaşıyor ve hızı belirli bir eşiğin üzerine çıktığında hızı ve
            rotası burada canlı olarak görünecek.
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
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
  speedCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
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
});
