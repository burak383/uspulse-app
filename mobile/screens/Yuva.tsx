import React, { useCallback, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { theme } from '../theme';
import { useAuth } from '../src/context/AuthContext';
import { api } from '../src/api/client';
import { MoodResponse, NotificationsResponse, TodayQuestion, TouchesResponse } from '../src/api/types';
import { RootStackParamList, TabRouteName } from '../navigation/types';

const { colors, fonts } = theme;

const alpha = (color: string, opacity: number) => {
  const hex = color.replace('#', '');
  const value = hex.length === 3
    ? hex.split('').map((character: string) => character + character).join('')
    : hex;

  const red = parseInt(value.slice(0, 2), 16);
  const green = parseInt(value.slice(2, 4), 16);
  const blue = parseInt(value.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
};

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const Icon = ({
  name,
  size = 20,
  color = colors.foreground,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) => (
  <MaterialCommunityIcons name={name} size={size} color={color} />
);

const RoundIcon = ({
  name,
  color,
  backgroundColor,
  size = 20,
}: {
  name: IconName;
  color: string;
  backgroundColor: string;
  size?: number;
}) => (
  <View style={[styles.roundIcon, { backgroundColor }]}>
    <Icon name={name} size={size} color={color} />
  </View>
);

const ActionTile = ({
  icon,
  label,
  color,
  onPress,
}: {
  icon: IconName;
  label: string;
  color: string;
  onPress?: () => void;
}) => (
  <Pressable style={styles.actionTile} onPress={onPress}>
    <RoundIcon
      name={icon}
      color={color}
      backgroundColor={alpha(color, 0.15)}
      size={21}
    />
    <Text style={styles.actionLabel}>{label}</Text>
  </Pressable>
);

function reunionCountdown(dateStr: string | null | undefined) {
  if (!dateStr) return null;
  const target = new Date(`${dateStr}T00:00:00`);
  const diffMs = target.getTime() - Date.now();
  if (Number.isNaN(target.getTime())) return null;
  if (diffMs <= 0) return { days: 0, caption: 'Bugün!' };
  const days = Math.floor(diffMs / 86400000);
  const hours = Math.floor((diffMs % 86400000) / 3600000);
  const minutes = Math.floor((diffMs % 3600000) / 60000);
  return { days, caption: `${hours} sa ${minutes} dk kaldı` };
}

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function HomeScreen({ navigation }: { navigation: NavProp }) {
  const { width } = useWindowDimensions();
  const { user, partner, couple, hapticsEnabled } = useAuth();

  const [mood, setMood] = useState<MoodResponse | null>(null);
  const [touches, setTouches] = useState<TouchesResponse | null>(null);
  const [question, setQuestion] = useState<TodayQuestion | null>(null);
  const [sendingHeart, setSendingHeart] = useState(false);
  const [notifications, setNotifications] = useState<NotificationsResponse | null>(null);

  const loadAll = useCallback(async () => {
    try {
      const [moodRes, touchesRes, questionRes, notificationsRes] = await Promise.all([
        api.get<MoodResponse>('/mood'),
        api.get<TouchesResponse>('/touches'),
        api.get<TodayQuestion>('/questions/today'),
        api.get<NotificationsResponse>('/notifications'),
      ]);
      setMood(moodRes);
      setTouches(touchesRes);
      setQuestion(questionRes);
      setNotifications(notificationsRes);
    } catch {
      // best-effort: leave previous state on screen if a refresh fails
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [loadAll]),
  );

  const cycleMyMood = async () => {
    if (!mood) return;
    const options = mood.availableMoods;
    const currentIndex = mood.me ? options.indexOf(mood.me.mood) : -1;
    const next = options[(currentIndex + 1 + options.length) % options.length];
    const res = await api.post<{ mood: string; at: string }>('/mood', { mood: next });
    setMood((prev) => (prev ? { ...prev, me: res } : prev));
  };

  const sendHeart = async () => {
    // Kendi telefonunda anlık dokunsal geri bildirim: bastığın anda hissedilsin,
    // sunucu yanıtını beklemesin. Partnerin telefonundaki gerçek titreşim ise
    // push bildirimiyle gelir (bkz. AuthContext'teki bildirim dinleyicisi).
    if (hapticsEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    setSendingHeart(true);
    try {
      await api.post('/touches', { durationMs: 2000 });
      const touchesRes = await api.get<TouchesResponse>('/touches');
      setTouches(touchesRes);
      if (hapticsEnabled) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
    } finally {
      setSendingHeart(false);
    }
  };

  const goTab = (route: TabRouteName) => navigation.navigate(route);

  const countdown = reunionCountdown(couple?.reunion_date);
  const partnerName = partner?.name ?? 'Partnerin';
  const myName = user?.name ?? 'Sen';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={[
            alpha(colors.card, 1),
            colors.background,
            colors.background,
          ]}
          locations={[0, 0.72, 1]}
          style={styles.hero}
        >
          <View style={styles.heroGlowPrimary} />
          <View style={styles.heroGlowAccent} />

          <View style={styles.headerRow}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>SİZİN KÜÇÜK YUVANIZ</Text>
              <Text style={styles.title}>
                {myName} + {partnerName},{'\n'}bugün de yakın.
              </Text>
            </View>

            <Pressable
              accessibilityLabel="Bildirimler"
              style={styles.notificationButton}
              onPress={async () => {
                const items = notifications?.items ?? [];
                if (items.length === 0) {
                  Alert.alert('Bildirimler', 'Henüz yeni bir bildirim yok.');
                  return;
                }
                const lines = items
                  .slice(0, 8)
                  .map((n) => `${n.title}${n.body ? `\n${n.body}` : ''} · ${new Date(n.at).toLocaleString('tr-TR')}`)
                  .join('\n\n');
                Alert.alert('Son bildirimler', lines);
                // Görüldü sayılsın: rozeti temizle.
                if ((notifications?.unreadCount ?? 0) > 0) {
                  try {
                    await api.post('/notifications/read-all', {});
                    setNotifications((prev) => (prev ? { ...prev, unreadCount: 0 } : prev));
                  } catch {
                    // best-effort: rozet bir sonraki yenilemede zaten güncellenir
                  }
                }
              }}
            >
              <Icon name="bell-outline" size={22} color={colors.cardForeground} />
              {Boolean(notifications?.unreadCount) && (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>
                    {notifications!.unreadCount > 9 ? '9+' : notifications!.unreadCount}
                  </Text>
                </View>
              )}
            </Pressable>
          </View>

          <View style={styles.radarCard}>
            <View style={styles.radarTop}>
              <View>
                <Text style={styles.label}>YAKINLIK SERİSİ</Text>
                <View style={styles.distanceRow}>
                  <Text style={styles.distance}>{touches?.streakDays ?? 0}</Text>
                  <Text style={styles.mutedText}>gündür sürüyor</Text>
                </View>
                <Text style={styles.caption}>
                  Her gün bir kalp, aranızı hep sıcak tutuyor.
                </Text>
              </View>

              <RoundIcon
                name="fire"
                size={23}
                color={colors.success}
                backgroundColor={alpha(colors.success, 0.15)}
              />
            </View>

            <View style={styles.radarDivider} />

            <View style={styles.moodRow}>
              <Pressable style={styles.moodPill} onPress={cycleMyMood}>
                <RoundIcon
                  name="creation"
                  size={15}
                  color={colors.accent}
                  backgroundColor={alpha(colors.accent, 0.2)}
                />
                <View style={styles.moodText}>
                  <Text style={styles.moodTitle} numberOfLines={1}>
                    {myName}: {mood?.me?.mood ?? 'Ruh halini seç'}
                  </Text>
                  <Text style={styles.moodHint}>dokun, değiştir</Text>
                </View>
              </Pressable>

              <View style={styles.moodPill}>
                <RoundIcon
                  name="weather-rainy"
                  size={15}
                  color={colors.primary}
                  backgroundColor={alpha(colors.primary, 0.2)}
                />
                <View style={styles.moodText}>
                  <Text style={styles.moodTitle} numberOfLines={1}>
                    {partnerName}:{' '}
                    {mood && !mood.partnerSharing
                      ? 'paylaşmıyor'
                      : mood?.partner?.mood ?? 'henüz paylaşmadı'}
                  </Text>
                  <Text style={styles.moodHint}>onun ruh hali</Text>
                </View>
              </View>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.content}>
          <Pressable style={styles.reunionCard} onPress={() => goTab('Planlar')}>
            <LinearGradient
              colors={[colors.secondary, colors.card, colors.background]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.reunionGlow} />
            <View style={styles.reunionContent}>
              <View style={styles.reunionTop}>
                <Text style={styles.reunionBadge}>YENİDEN KAVUŞMA</Text>
                <Icon name="arrow-top-right" size={22} color={colors.primary} />
              </View>
              <Text style={styles.reunionDate}>
                {couple?.reunion_date ?? 'Henüz planlanmadı'}
                {couple?.reunion_location ? ` · ${couple.reunion_location}` : ''}
              </Text>
              <Text style={styles.reunionHeading}>{partnerName}'i görmene</Text>
              <View style={styles.countdownRow}>
                <Text style={styles.countdown}>{countdown ? `${countdown.days} gün` : '—'}</Text>
                <Text style={styles.countdownCaption}>{countdown?.caption ?? 'Bir tarih belirleyin'}</Text>
              </View>
              <View style={styles.planLink}>
                <Text style={styles.planLinkText}>Ortak planı aç</Text>
                <Icon name="calendar-heart" size={17} color={colors.primary} />
              </View>
            </View>
          </Pressable>

          <View style={styles.syncCard}>
            <View style={styles.syncGlow} />
            <View style={styles.syncContent}>
              <View style={styles.syncLabelRow}>
                <Icon name="radio-tower" size={15} color={colors.primary} />
                <Text style={styles.syncLabel}>KALP SENKRONU</Text>
              </View>
              <Text style={styles.syncTitle}>Bir anlığına aynı ritim.</Text>

              <Pressable
                accessibilityLabel="Kalbimi Gönder"
                style={styles.heartButton}
                onPress={sendHeart}
                disabled={sendingHeart}
              >
                <View style={styles.heartInnerRing} />
                <View style={styles.heartButtonContent}>
                  <Icon name="heart-pulse" size={43} color={colors.primaryForeground} />
                  <Text style={styles.holdText}>{sendingHeart ? 'Gönderiliyor...' : 'Dokun, gönder'}</Text>
                </View>
              </Pressable>

              <Text style={styles.sendTitle}>Kalbimi Gönder</Text>
              <Text style={styles.syncCaption}>
                {touches?.recent?.[0]
                  ? `Son gönderim: ${touches.recent[0].senderName}, ${new Date(
                      touches.recent[0].at,
                    ).toLocaleString('tr-TR')}`
                  : 'Henüz kimse kalp göndermedi. İlkini sen gönder!'}
              </Text>
            </View>
          </View>

          <View>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Canlı Dokunuş</Text>
                <Text style={styles.sectionCaption}>Uzaklığı bir anlığına kapat.</Text>
              </View>
              <Pressable onPress={() => goTab('Anilar')}>
                <Text style={styles.seeAll}>Tümü</Text>
              </Pressable>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.touchList}
            >
              <ActionTile
                icon="camera-outline"
                label="Fotoğraf"
                color={colors.primary}
                onPress={() => goTab('Anilar')}
              />
              <ActionTile
                icon="draw-pen"
                label="Çizim"
                color={colors.accent}
                onPress={() => goTab('Anilar')}
              />
              <ActionTile
                icon="microphone-outline"
                label="Ses notu"
                color={colors.success}
                onPress={() => goTab('Anilar')}
              />

              <Pressable style={styles.voiceCard} onPress={() => goTab('Anilar')}>
                <Image
                  source={{
                    uri: 'https://fwtngjyirchhhysukjxi.supabase.co/storage/v1/object/public/project-images/d8f99d97-2440-4f3a-addf-6eb2753287e6/9e58940a-cdd0-49be-99aa-ccb5bfa0ba69.png',
                  }}
                  accessibilityLabel="Anılar galerisine git"
                  style={StyleSheet.absoluteFill}
                />
                <LinearGradient
                  colors={[alpha(colors.background, 0), alpha(colors.background, 0.9)]}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.voiceOverlay}>
                  <View>
                    <Text style={styles.voiceTitle}>Anılara git</Text>
                    <Text style={styles.voiceMeta}>tüm anılarınızı gör</Text>
                  </View>
                  <View style={styles.playButton}>
                    <Icon name="arrow-right" size={15} color={colors.primary} />
                  </View>
                </View>
              </Pressable>
            </ScrollView>
          </View>

          <Pressable style={styles.questionCard} onPress={() => navigation.navigate('GununSorusu')}>
            <RoundIcon
              name="message-outline"
              color={colors.accent}
              backgroundColor={alpha(colors.accent, 0.15)}
              size={22}
            />
            <View style={styles.questionCopy}>
              <Text style={styles.questionEyebrow}>BUGÜNÜN SORUSU</Text>
              <Text style={styles.questionTitle}>{question?.question ?? 'Yükleniyor...'}</Text>
              <View style={styles.questionFooter}>
                <Text style={styles.readyBadge}>
                  {question?.myAnswer ? 'Yanıtın hazır' : 'Henüz yanıtlamadın'}
                </Text>
                <View style={styles.openLink}>
                  <Text style={styles.openLinkText}>Aç</Text>
                  <Icon name="arrow-right" size={17} color={colors.primary} />
                </View>
              </View>
            </View>
          </Pressable>

          <View style={styles.streakCard}>
            <View style={styles.streakCopy}>
              <View style={styles.streakLabelRow}>
                <Icon name="sprout-outline" size={19} color={colors.success} />
                <Text style={styles.streakLabel}>MİMOZA BÜYÜYOR</Text>
              </View>
              <Text style={styles.streakTitle}>{touches?.streakDays ?? 0} günlük{'\n'}yakınlık serisi</Text>
              <View style={styles.completedBadge}>
                <Icon name="check" size={14} color={colors.success} />
                <Text style={styles.completedText}>
                  {touches?.recent?.some(
                    (t) => new Date(t.at).toDateString() === new Date().toDateString(),
                  )
                    ? 'Bugün tamamlandı'
                    : 'Bugün henüz kalp gönderilmedi'}
                </Text>
              </View>
            </View>
            <Image
              source={{
                uri: 'https://fwtngjyirchhhysukjxi.supabase.co/storage/v1/object/public/project-images/d8f99d97-2440-4f3a-addf-6eb2753287e6/f7f8ae45-5156-4cf2-ba07-6aaa0e366595.png',
              }}
              accessibilityLabel="Mimoza bitkisi"
              style={styles.plantImage}
            />
          </View>
        </View>
      </ScrollView>

      <View style={[styles.tabBar, { width: Math.min(width - 30, 350) }]}>
        <TabItem icon="home-variant-outline" label="Yuva" active onPress={() => goTab('Yuva')} />
        <TabItem icon="calendar-month-outline" label="Planlar" onPress={() => goTab('Planlar')} />
        <TabItem icon="image-multiple-outline" label="Anılar" onPress={() => goTab('Anilar')} />
        <TabItem icon="account-group-outline" label="Biz" onPress={() => goTab('Biz')} />
      </View>
    </SafeAreaView>
  );
}

function TabItem({
  icon,
  label,
  active = false,
  onPress,
}: {
  icon: IconName;
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable style={[styles.tabItem, active && styles.activeTabItem]} onPress={onPress}>
      <Icon
        name={icon}
        size={21}
        color={active ? colors.primary : colors.mutedForeground}
      />
      <Text style={[styles.tabLabel, active && styles.activeTabLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: 115,
  },
  hero: {
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 28,
    overflow: 'hidden',
  },
  heroGlowPrimary: {
    position: 'absolute',
    right: -55,
    top: 25,
    width: 175,
    height: 175,
    borderRadius: 100,
    backgroundColor: alpha(colors.primary, 0.1),
  },
  heroGlowAccent: {
    position: 'absolute',
    left: -65,
    top: 115,
    width: 145,
    height: 145,
    borderRadius: 100,
    backgroundColor: alpha(colors.accent, 0.08),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerCopy: {
    flex: 1,
  },
  eyebrow: {
    color: colors.primary,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.8,
  },
  title: {
    marginTop: 8,
    color: colors.foreground,
    fontFamily: fonts.heading,
    fontSize: 29,
    lineHeight: 34,
  },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: alpha(colors.card, 0.72),
    borderWidth: 1,
    borderColor: colors.border,
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderWidth: 1.5,
    borderColor: colors.background,
  },
  notificationBadgeText: {
    color: colors.primaryForeground,
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: '800',
  },
  radarCard: {
    marginTop: 27,
    padding: 16,
    borderRadius: 20,
    backgroundColor: alpha(colors.card, 0.78),
    borderWidth: 1,
    borderColor: alpha(colors.border, 0.8),
  },
  radarTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  label: {
    color: colors.mutedForeground,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginTop: 8,
  },
  distance: {
    color: colors.foreground,
    fontFamily: fonts.heading,
    fontSize: 34,
    lineHeight: 38,
  },
  mutedText: {
    color: colors.mutedForeground,
    fontFamily: fonts.body,
    fontSize: 14,
  },
  caption: {
    color: colors.mutedForeground,
    fontFamily: fonts.body,
    fontSize: 11,
  },
  radarDivider: {
    height: 1,
    backgroundColor: alpha(colors.border, 0.7),
    marginVertical: 15,
  },
  moodRow: {
    flexDirection: 'row',
    gap: 8,
  },
  moodPill: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 9,
    paddingVertical: 8,
    borderRadius: 24,
    backgroundColor: colors.secondary,
  },
  roundIcon: {
    width: 44,
    height: 44,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moodText: {
    flex: 1,
    minWidth: 0,
  },
  moodTitle: {
    color: colors.secondaryForeground,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '700',
  },
  moodHint: {
    marginTop: 2,
    color: colors.mutedForeground,
    fontFamily: fonts.body,
    fontSize: 9,
  },
  content: {
    paddingHorizontal: 20,
    gap: 20,
  },
  reunionCard: {
    minHeight: 235,
    overflow: 'hidden',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: alpha(colors.primary, 0.25),
  },
  reunionGlow: {
    position: 'absolute',
    right: -35,
    top: -35,
    width: 130,
    height: 130,
    borderRadius: 70,
    backgroundColor: alpha(colors.primary, 0.18),
  },
  reunionContent: {
    padding: 20,
  },
  reunionTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reunionBadge: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    color: colors.primaryForeground,
    backgroundColor: colors.primary,
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  reunionDate: {
    marginTop: 20,
    color: colors.mutedForeground,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  reunionHeading: {
    marginTop: 4,
    color: colors.foreground,
    fontFamily: fonts.heading,
    fontSize: 27,
  },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginTop: 2,
  },
  countdown: {
    color: colors.primary,
    fontFamily: fonts.heading,
    fontSize: 38,
    lineHeight: 43,
  },
  countdownCaption: {
    paddingBottom: 4,
    color: colors.mutedForeground,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  planLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 17,
  },
  planLinkText: {
    color: colors.primary,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '800',
  },
  syncCard: {
    overflow: 'hidden',
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: alpha(colors.primary, 0.25),
    backgroundColor: colors.card,
  },
  syncGlow: {
    position: 'absolute',
    alignSelf: 'center',
    top: 50,
    width: 220,
    height: 220,
    borderRadius: 120,
    backgroundColor: alpha(colors.primary, 0.08),
  },
  syncContent: {
    alignItems: 'center',
  },
  syncLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  syncLabel: {
    color: colors.mutedForeground,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  syncTitle: {
    marginTop: 7,
    color: colors.foreground,
    fontFamily: fonts.heading,
    fontSize: 20,
  },
  heartButton: {
    width: 144,
    height: 144,
    marginTop: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 80,
    borderWidth: 1,
    borderColor: alpha(colors.primaryForeground, 0.25),
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.32,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  heartInnerRing: {
    position: 'absolute',
    inset: 12,
    borderRadius: 70,
    borderWidth: 1,
    borderColor: alpha(colors.primaryForeground, 0.28),
  },
  heartButtonContent: {
    alignItems: 'center',
  },
  holdText: {
    marginTop: 3,
    color: colors.primaryForeground,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '900',
  },
  sendTitle: {
    marginTop: 17,
    color: colors.foreground,
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '800',
  },
  syncCaption: {
    maxWidth: 280,
    marginTop: 4,
    color: colors.mutedForeground,
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 11,
  },
  sectionTitle: {
    color: colors.foreground,
    fontFamily: fonts.heading,
    fontSize: 21,
  },
  sectionCaption: {
    marginTop: 2,
    color: colors.mutedForeground,
    fontFamily: fonts.body,
    fontSize: 11,
  },
  seeAll: {
    color: colors.primary,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '800',
  },
  touchList: {
    gap: 10,
    paddingBottom: 2,
  },
  actionTile: {
    width: 100,
    height: 124,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: alpha(colors.muted, 0.5),
  },
  actionLabel: {
    marginTop: 9,
    color: colors.mutedForeground,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '800',
  },
  voiceCard: {
    width: 190,
    height: 124,
    overflow: 'hidden',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  voiceOverlay: {
    position: 'absolute',
    right: 11,
    bottom: 11,
    left: 11,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  voiceTitle: {
    color: colors.foreground,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '900',
  },
  voiceMeta: {
    marginTop: 3,
    color: colors.mutedForeground,
    fontFamily: fonts.body,
    fontSize: 9,
  },
  playButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: alpha(colors.background, 0.86),
  },
  questionCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 15,
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  questionCopy: {
    flex: 1,
  },
  questionEyebrow: {
    color: colors.primary,
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.3,
  },
  questionTitle: {
    marginTop: 4,
    color: colors.foreground,
    fontFamily: fonts.heading,
    fontSize: 21,
    lineHeight: 27,
  },
  questionFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  readyBadge: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    color: colors.success,
    backgroundColor: alpha(colors.success, 0.15),
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '800',
  },
  openLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  openLinkText: {
    color: colors.primary,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '800',
  },
  streakCard: {
    minHeight: 172,
    overflow: 'hidden',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  streakCopy: {
    width: '62%',
    padding: 20,
    zIndex: 1,
  },
  streakLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  streakLabel: {
    color: colors.success,
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.3,
  },
  streakTitle: {
    marginTop: 7,
    color: colors.foreground,
    fontFamily: fonts.heading,
    fontSize: 25,
    lineHeight: 29,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    marginTop: 12,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 17,
    backgroundColor: alpha(colors.success, 0.15),
  },
  completedText: {
    color: colors.success,
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: '800',
  },
  plantImage: {
    position: 'absolute',
    right: -5,
    bottom: -16,
    width: 175,
    height: 175,
  },
  tabBar: {
    position: 'absolute',
    bottom: 18,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: alpha(colors.border, 0.75),
    backgroundColor: alpha(colors.secondary, 0.94),
  },
  tabItem: {
    minWidth: 68,
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 22,
  },
  activeTabItem: {
    backgroundColor: alpha(colors.primary, 0.15),
  },
  tabLabel: {
    color: colors.mutedForeground,
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: '700',
  },
  activeTabLabel: {
    color: colors.primary,
    fontWeight: '900',
  },
});
