import React, { useCallback, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import theme from '../theme';
import { useAuth } from '../src/context/AuthContext';
import { api } from '../src/api/client';
import { TodayQuestion } from '../src/api/types';
import { RootStackParamList } from '../navigation/types';

const { colors, fonts } = theme;

type FeatherIconName = React.ComponentProps<typeof Feather>['name'];

const Icon = ({
  name,
  size = 18,
  color = colors.foreground,
}: {
  name: FeatherIconName;
  size?: number;
  color?: string;
}) => <Feather name={name} size={size} color={color} />;

const CircleButton = ({
  accessibilityLabel,
  children,
  onPress,
}: {
  accessibilityLabel: string;
  children: React.ReactNode;
  onPress?: () => void;
}) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel}
    onPress={onPress}
    style={({ pressed }) => [styles.circleButton, pressed && styles.pressed]}
  >
    {children}
  </Pressable>
);

const Avatar = ({ children, muted = false }: { children: React.ReactNode; muted?: boolean }) => (
  <View style={[styles.avatar, muted ? styles.mutedAvatar : styles.primaryAvatar]}>{children}</View>
);

type NavProp = NativeStackNavigationProp<RootStackParamList, 'GununSorusu'>;

export default function DailyRitualScreen({ navigation }: { navigation: NavProp }) {
  const { user, partner } = useAuth();
  const [data, setData] = useState<TodayQuestion | null>(null);
  const [answer, setAnswer] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingMemory, setSavingMemory] = useState(false);
  const [savedMemory, setSavedMemory] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<TodayQuestion>('/questions/today');
      setData((prev) => {
        if (prev && prev.day !== res.day) setSavedMemory(false);
        return res;
      });
      setAnswer(res.myAnswer?.text ?? '');
    } catch (e) {
      Alert.alert(
        'Günün sorusu yüklenemedi',
        e instanceof Error ? e.message : 'Lütfen bağlantını kontrol edip tekrar dene.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const characterCount = answer.length;
  const alreadyAnswered = Boolean(data?.myAnswer);

  const handleSend = async () => {
    if (!answer.trim()) return;
    setSending(true);
    try {
      await api.post('/questions/today/answer', { text: answer.trim() });
      await load();
    } catch (e) {
      Alert.alert(
        'Gönderilemedi',
        e instanceof Error ? e.message : 'Cevabın kaydedilemedi, lütfen tekrar dene.',
      );
    } finally {
      setSending(false);
    }
  };

  const handleBack = () => navigation.goBack();

  const saveToMemories = async () => {
    if (!data?.myAnswer || !data.partnerAnswer || savingMemory) return;
    setSavingMemory(true);
    try {
      await api.post('/memories', {
        type: 'note',
        title: data.question,
        note: `${user?.name ?? 'Sen'}: "${data.myAnswer.text}"\n${data.partnerName ?? 'Partnerin'}: "${data.partnerAnswer.text}"`,
      });
      setSavedMemory(true);
    } catch (e) {
      Alert.alert(
        'Kaydedilemedi',
        e instanceof Error ? e.message : 'Anılara kaydedilemedi, lütfen tekrar dene.',
      );
    } finally {
      setSavingMemory(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <LinearGradient
            colors={[colors.card, colors.background, colors.background]}
            locations={[0, 0.7, 1]}
            style={styles.hero}
          >
            <View style={[styles.glow, styles.primaryGlow]} />
            <View style={[styles.glow, styles.accentGlow]} />

            <View style={styles.header}>
              <CircleButton accessibilityLabel="Geri dön" onPress={handleBack}>
                <Icon name="arrow-left" size={21} color={colors.cardForeground} />
              </CircleButton>

              <View style={styles.headerCopy}>
                <Text style={styles.eyebrowPrimary}>GÜNÜN RİTÜELİ</Text>
                <Text style={styles.headerSubtitle}>Sadece ikiniz için</Text>
              </View>

              <View style={{ width: 44 }} />
            </View>

            <View style={styles.heroContent}>
              <View style={styles.ritualIcon}>
                <Icon name="message-circle" size={26} color={colors.accent} />
                <View style={styles.heartMark}>
                  <Icon name="heart" size={9} color={colors.accent} />
                </View>
              </View>
              <Text style={styles.date}>{data?.day ?? '...'}</Text>
              <Text style={styles.heroTitle}>{data?.question ?? 'Soru yükleniyor...'}</Text>
              <Text style={styles.heroDescription}>
                Bugün bir anıyı birlikte yeniden gülümseyerek hatırlayın.
              </Text>
            </View>
          </LinearGradient>

          <View style={styles.content}>
            <View style={[styles.card, styles.answerCard]}>
              <View style={styles.rowBetween}>
                <View style={styles.profileRow}>
                  <Avatar>{(user?.name ?? '?').charAt(0).toUpperCase()}</Avatar>
                  <View>
                    <Text style={styles.cardTitle}>{user?.name ?? 'Senin'} cevabın</Text>
                    <Text style={styles.caption}>
                      {partner?.name ? `${partner.name}'den önce sen paylaş` : 'Cevabını paylaş'}
                    </Text>
                  </View>
                </View>
                <View style={styles.statusPill}>
                  <Text style={styles.statusText}>{alreadyAnswered ? 'Gönderildi' : 'Taslak'}</Text>
                </View>
              </View>

              <View style={styles.inputShell}>
                <TextInput
                  accessibilityLabel="Cevabın"
                  value={answer}
                  onChangeText={setAnswer}
                  multiline
                  maxLength={240}
                  textAlignVertical="top"
                  placeholder="Cevabını yaz"
                  placeholderTextColor={colors.mutedForeground}
                  style={styles.answerInput}
                />
                <View style={styles.inputFooter}>
                  <Text style={styles.caption}>{characterCount} / 240 karakter</Text>
                </View>
              </View>

              <View style={styles.noteRow}>
                <Icon name="lock" size={14} color={colors.primary} />
                <Text style={styles.noteText}>
                  Cevabın yalnızca {partner?.name ?? 'partnerinle'} aranızda kalır.
                </Text>
              </View>
            </View>

            <LinearGradient
              colors={[colors.muted, colors.card]}
              style={styles.card}
            >
              <View style={styles.profileRow}>
                <Avatar muted>
                  <Icon
                    name={data?.partnerAnswered ? 'check' : 'lock'}
                    size={18}
                    color={data?.partnerAnswered ? colors.success : colors.mutedForeground}
                  />
                </Avatar>
                <View>
                  <Text style={styles.cardTitle}>{partner?.name ?? 'Partnerinin'} cevabı</Text>
                  <Text style={styles.caption}>
                    {data?.partnerAnswered ? 'Yanıtladı' : 'Henüz bekleniyor'}
                  </Text>
                </View>
              </View>

              {data?.partnerAnswer ? (
                <View style={styles.revealedAnswer}>
                  <Text style={styles.revealedText}>“{data.partnerAnswer.text}”</Text>
                </View>
              ) : (
                <View style={styles.lockedAnswer}>
                  <View style={styles.sparkleCircle}>
                    <Icon name="star" size={17} color={colors.primary} />
                  </View>
                  <Text style={styles.sectionTitle}>Birlikte açılacak</Text>
                  <Text style={styles.centerCaption}>
                    {partner?.name ?? 'Partnerin'} yanıtlayınca iki cevabınız aynı anda görünecek.
                  </Text>
                </View>
              )}
            </LinearGradient>

            <LinearGradient
              colors={[colors.secondary, colors.card]}
              style={styles.card}
            >
              <View style={styles.accentRow}>
                <Icon name="book-open" size={18} color={colors.accent} />
                <Text style={styles.eyebrowAccent}>BİRLİKTE SAKLAYIN</Text>
              </View>
              <Text style={styles.largeTitle}>İkinizin kahkahasına bir yer açın.</Text>
              <Text style={styles.bodySmall}>
                {partner?.name ?? 'Partnerin'} de yanıtladıktan sonra bu anı Anılar'a kaydedebilirsiniz.
              </Text>
              <Pressable
                disabled={!data?.partnerAnswer || savingMemory || savedMemory}
                onPress={saveToMemories}
                style={[styles.disabledButton, data?.partnerAnswer && styles.enabledButton]}
              >
                <Icon
                  name={savedMemory ? 'check' : 'bookmark'}
                  size={16}
                  color={data?.partnerAnswer ? colors.primaryForeground : colors.mutedForeground}
                />
                <Text
                  style={[
                    styles.disabledButtonText,
                    data?.partnerAnswer && { color: colors.primaryForeground },
                  ]}
                >
                  {savedMemory
                    ? 'Anılara kaydedildi'
                    : savingMemory
                      ? 'Kaydediliyor...'
                      : 'Bunu Anılara Kaydet'}
                </Text>
              </Pressable>
            </LinearGradient>

            <View style={styles.infoCard}>
              <View style={styles.infoIcon}>
                <Icon name="info" size={16} color={colors.primary} />
              </View>
              <View style={styles.infoCopy}>
                <Text style={styles.cardTitle}>Paylaşım kontrolü sizde</Text>
                <Text style={[styles.bodySmall, styles.infoText]}>
                  Cevaplarınız özel kalır. Yalnızca siz açıkça seçerseniz Story'ye dönüşür.
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>

        <LinearGradient
          colors={[colors.background, colors.background, 'transparent']}
          locations={[0, 0.7, 1]}
          style={styles.bottomBar}
          pointerEvents="box-none"
        >
          <Pressable
            onPress={handleSend}
            disabled={sending || loading || !answer.trim()}
            style={({ pressed }) => [
              styles.sendButton,
              (pressed || sending || !answer.trim()) && styles.pressed,
            ]}
          >
            <Icon name="send" size={18} color={colors.primaryForeground} />
            <Text style={styles.sendButtonText}>
              {alreadyAnswered ? 'Cevabımı güncelle' : 'Yanıtımı gönder ve birlikte aç'}
            </Text>
          </Pressable>
        </LinearGradient>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: 170,
  },
  hero: {
    minHeight: 390,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 30,
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    borderRadius: 200,
  },
  primaryGlow: {
    width: 210,
    height: 210,
    right: -75,
    top: 10,
    backgroundColor: `${colors.primary}18`,
  },
  accentGlow: {
    width: 175,
    height: 175,
    left: -90,
    top: 180,
    backgroundColor: `${colors.accent}18`,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  circleButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: `${colors.card}CC`,
  },
  headerCopy: {
    alignItems: 'center',
  },
  eyebrowPrimary: {
    color: colors.primary,
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.7,
  },
  headerSubtitle: {
    marginTop: 4,
    color: colors.mutedForeground,
    fontFamily: fonts.body,
    fontSize: 12,
  },
  heroContent: {
    alignItems: 'center',
    marginTop: 32,
  },
  ritualIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: `${colors.accent}59`,
    backgroundColor: `${colors.accent}18`,
  },
  heartMark: {
    position: 'absolute',
    right: 12,
    bottom: 11,
  },
  date: {
    marginTop: 16,
    color: colors.mutedForeground,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  heroTitle: {
    maxWidth: 330,
    marginTop: 12,
    color: colors.foreground,
    fontFamily: fonts.heading,
    fontSize: 30,
    lineHeight: 33,
    textAlign: 'center',
  },
  heroDescription: {
    maxWidth: 290,
    marginTop: 12,
    color: colors.mutedForeground,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  content: {
    gap: 20,
    paddingHorizontal: 20,
  },
  card: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  answerCard: {
    borderColor: `${colors.primary}4D`,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryAvatar: {
    backgroundColor: colors.primary,
  },
  mutedAvatar: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.muted,
  },
  cardTitle: {
    color: colors.cardForeground,
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '800',
  },
  caption: {
    marginTop: 3,
    color: colors.mutedForeground,
    fontFamily: fonts.body,
    fontSize: 11,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: `${colors.success}26`,
  },
  statusText: {
    color: colors.success,
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: '800',
  },
  inputShell: {
    marginTop: 20,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: `${colors.primary}59`,
    backgroundColor: colors.input,
  },
  answerInput: {
    minHeight: 92,
    padding: 0,
    color: colors.foreground,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 23,
  },
  inputFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: `${colors.border}B3`,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  noteText: {
    flex: 1,
    color: colors.mutedForeground,
    fontFamily: fonts.body,
    fontSize: 11,
  },
  lockedAnswer: {
    alignItems: 'center',
    marginTop: 20,
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: `${colors.border}CC`,
    backgroundColor: `${colors.background}59`,
  },
  revealedAnswer: {
    marginTop: 20,
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: `${colors.success}59`,
    backgroundColor: `${colors.success}14`,
  },
  revealedText: {
    color: colors.foreground,
    fontFamily: fonts.heading,
    fontSize: 17,
    lineHeight: 24,
  },
  sparkleCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${colors.primary}1A`,
  },
  sectionTitle: {
    marginTop: 12,
    color: colors.foreground,
    fontFamily: fonts.heading,
    fontSize: 18,
  },
  centerCaption: {
    maxWidth: 245,
    marginTop: 4,
    color: colors.mutedForeground,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  accentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eyebrowAccent: {
    color: colors.accent,
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  largeTitle: {
    maxWidth: 260,
    marginTop: 8,
    color: colors.foreground,
    fontFamily: fonts.heading,
    fontSize: 24,
    lineHeight: 29,
  },
  bodySmall: {
    maxWidth: 275,
    marginTop: 8,
    color: colors.mutedForeground,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 18,
  },
  disabledButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    marginTop: 18,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 22,
    backgroundColor: colors.muted,
  },
  enabledButton: {
    backgroundColor: colors.primary,
  },
  disabledButtonText: {
    color: colors.mutedForeground,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '800',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: `${colors.muted}80`,
  },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.secondary,
  },
  infoCopy: {
    flex: 1,
  },
  infoText: {
    marginTop: 4,
  },
  bottomBar: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 20,
  },
  sendButton: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 20,
    backgroundColor: colors.primary,
  },
  sendButtonText: {
    color: colors.primaryForeground,
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.78,
  },
});
