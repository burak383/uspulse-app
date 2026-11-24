// İlk kullanım tanıtım turu: yeni kullanıcıya uygulamanın ana bölümlerini
// kısa kartlarla gösterir (Testers Community geri bildirimi: "yeni
// kullanıcılar için yönlendirme turu"). Yuva ekranında bir kez otomatik
// açılır, sonrasında Biz sekmesindeki "Nasıl kullanılır?" satırından
// istendiğinde tekrar açılabilir.
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, fonts } from '../../theme';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const TOUR_SEEN_KEY = 'uspulse_tour_seen_v1';

const STEPS: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'heart-outline',
    title: "UsPulse'a hoş geldin",
    body: 'Partnerinle ikinize ait ortak bir alan. Kısa bir turla neler yapabileceğini gösterelim.',
  },
  {
    icon: 'home-variant-outline',
    title: 'Yuva',
    body: 'Ruh hâlini paylaş, partnerine kalp gönder, günün sorusunu yanıtla ve sohbet et. Partnerinin ruh hâli de burada görünür.',
  },
  {
    icon: 'calendar-month-outline',
    title: 'Planlar ve Anılar',
    body: 'Birlikte plan yap, ortak hedeflerini takip et. Anılar bölümünde fotoğraf, ses notu ve zaman kapsülü ile özel anlarını sakla.',
  },
  {
    icon: 'map-marker-outline',
    title: 'Konum',
    body: 'İkiniz de konum paylaşımını açtığınızda birbirinizin yerini haritada ve aranızdaki mesafeyi görürsünüz. Araç kullanırken hız ve rota da gösterilir; sürüş bitince bu veri silinir. Paylaşımı istediğin zaman Biz sekmesinden kapatabilirsin.',
  },
  {
    icon: 'account-group-outline',
    title: 'Biz',
    body: 'Profilini, aşk dili testini, bildirimleri ve gizlilik ayarlarını buradan yönet. Uygulamayı arkadaşlarınla paylaşabilir ya da puanlayabilirsin.',
  },
];

export async function hasSeenWelcomeTour(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(TOUR_SEEN_KEY)) === '1';
  } catch {
    // Okunamazsa turu zorla göstermeyelim -- kullanıcıyı rahatsız etmeyi
    // tercih etmiyoruz, Biz sekmesinden zaten elle açılabiliyor.
    return true;
  }
}

async function markWelcomeTourSeen() {
  try {
    await AsyncStorage.setItem(TOUR_SEEN_KEY, '1');
  } catch {
    // best-effort
  }
}

/** Yuva ekranı için: tur daha önce görülmediyse otomatik açar. */
export function useAutoWelcomeTour() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    let cancelled = false;
    hasSeenWelcomeTour().then((seen) => {
      if (!cancelled && !seen) setVisible(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return { visible, setVisible };
}

export function WelcomeTour({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (visible) setIndex(0);
  }, [visible]);

  const isLast = index === STEPS.length - 1;
  const step = STEPS[index];

  const finish = () => {
    markWelcomeTourSeen();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={finish}>
      <View style={styles.backdrop}>
        <SafeAreaView style={styles.safe}>
          <View style={styles.card}>
            <View style={styles.iconWrap}>
              <MaterialCommunityIcons name={step.icon} size={34} color={colors.primary} />
            </View>
            <Text style={styles.title}>{step.title}</Text>
            <Text style={styles.body}>{step.body}</Text>

            <View style={styles.dots}>
              {STEPS.map((_, i) => (
                <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
              ))}
            </View>

            <View style={styles.actions}>
              {!isLast ? (
                <Pressable onPress={finish} accessibilityRole="button" accessibilityLabel="Turu geç">
                  <Text style={styles.skip}>Geç</Text>
                </Pressable>
              ) : (
                <View />
              )}
              <Pressable
                style={styles.primaryButton}
                onPress={isLast ? finish : () => setIndex(index + 1)}
                accessibilityRole="button"
                accessibilityLabel={isLast ? 'Başla' : 'Devam'}
              >
                <Text style={styles.primaryText}>{isLast ? 'Başla' : 'Devam'}</Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(20, 12, 24, 0.78)', justifyContent: 'center' },
  safe: { flex: 1, justifyContent: 'center', paddingHorizontal: 20 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    alignItems: 'center',
  },
  iconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 22,
    color: colors.foreground,
    textAlign: 'center',
    marginBottom: 10,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  dots: { flexDirection: 'row', gap: 6, marginTop: 20, marginBottom: 20 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.primary, width: 18 },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', alignSelf: 'stretch' },
  skip: { fontFamily: fonts.body, fontSize: 15, fontWeight: '700', color: colors.mutedForeground, padding: 8 },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 22,
    paddingHorizontal: 26,
    paddingVertical: 11,
  },
  primaryText: { fontFamily: fonts.body, fontSize: 15, fontWeight: '800', color: colors.primaryForeground },
});
