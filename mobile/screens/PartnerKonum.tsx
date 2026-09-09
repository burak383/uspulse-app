// Partnerin canlı konumunu haritada gösteren ekran. bkz. Biz.tsx'teki
// "Konum" gizlilik ayarı ve server/src/routes/me.ts -- partnerLat/partnerLng
// yalnızca İKİNİZ DE konum paylaşımını açtıysanız sunucudan döner (karşılıklı
// rıza şartı), bu ekran salt görüntüleme amaçlı; açma/kapama anahtarı
// Biz.tsx'teki "Gizliliğiniz sizin elinizde" kartında.
import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, StatusBar, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { theme } from '../theme';
import { useAuth } from '../src/context/AuthContext';
import { api } from '../src/api/client';
import { MeResponse } from '../src/api/types';
import { RootStackParamList } from '../navigation/types';

const colors = theme.colors;

// Sürüş ekranıyla aynı ritimde (bkz. Surus.tsx) -- ekran görünürken 5
// saniyede bir tazeleniyor, ekrandan çıkınca durur.
const POLL_MS = 5000;

type NavProp = NativeStackNavigationProp<RootStackParamList, 'PartnerKonum'>;

export default function PartnerLocationScreen({ navigation }: { navigation: NavProp }) {
  const { partner } = useAuth();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const mapRef = useRef<MapView>(null);
  const hasCentered = useRef(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get<MeResponse>('/me');
      setMe(res);
      if (res.partnerLat != null && res.partnerLng != null && !hasCentered.current) {
        hasCentered.current = true;
        mapRef.current?.animateToRegion(
          {
            latitude: res.partnerLat,
            longitude: res.partnerLng,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          },
          300,
        );
      }
      if (res.partnerLat == null) {
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

  const partnerName = partner?.name ?? 'Partnerin';
  const shared = me?.partnerLat != null && me?.partnerLng != null;

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
          <Text style={styles.title}>Konum</Text>
          <Text style={styles.subtitle}>{partnerName}'in şu anki konumu</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
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
                <MaterialCommunityIcons name="heart" size={16} color={colors.primaryForeground} />
              </View>
            </Marker>
          </MapView>

          {me.distanceKm != null && (
            <View style={styles.distanceCard}>
              <MaterialCommunityIcons name="map-marker-distance" size={20} color={colors.primary} />
              <Text style={styles.distanceText}>Aranızda ~{me.distanceKm} km var</Text>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.centered}>
          <MaterialCommunityIcons name="map-marker-off-outline" size={40} color={colors.mutedForeground} />
          <Text style={styles.emptyTitle}>Konum paylaşımı kapalı</Text>
          <Text style={styles.emptyCaption}>
            {partnerName}'in konumunu görebilmen için ikinizin de Biz sekmesinden konum paylaşımını
            açmış olması gerekiyor.
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
  distanceCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
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
});
