// "Aşk dili" uyum testi. Günün Sorusu (GNNSorusu.tsx) formatına yakın bir
// altyapı kullanıyor ama GÜNLÜK değil TEK SEFERLİK bir akış: kullanıcı 10
// soruyu bir kez yanıtlar (bkz. src/quiz/askDili.ts -- sorular/seçenekler
// tamamen istemci tarafında), sonuç sunucuya gönderilir (yalnızca 5
// kategorinin puanları, bkz. server/src/routes/loveLanguage.ts) ve partner
// de tamamlayınca ikisininki karşılaştırmalı gösterilir. Sohbet ile aynı
// desende, alt sekme çubuğunda YER ALMIYOR -- Biz ekranındaki bir kart
// üzerinden açılan ayrı bir stack ekranı (bkz. Biz.tsx).
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { theme } from '../theme';
import { useAuth } from '../src/context/AuthContext';
import { api } from '../src/api/client';
import { LoveLanguageResponse, LoveLanguageResult } from '../src/api/types';
import { RootStackParamList } from '../navigation/types';
import {
  LOVE_LANGUAGE_KEYS,
  LOVE_LANGUAGE_META,
  LOVE_LANGUAGE_QUESTIONS,
  LoveLanguageKey,
} from '../src/quiz/askDili';

const colors = theme.colors;
const fonts = theme.fonts;

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
const Icon = ({
  name,
  size = 20,
  color = colors.foreground,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) => <MaterialCommunityIcons name={name} size={size} color={color} />;

// alpha() -- bkz. Biz.tsx/ELe.tsx'teki aynı yardımcı: RoundIcon/çubuk arka
// planı, ikonun/çubuğun kendi rengiyle aynı katı tonda değil, o rengin
// soluk (alfa'lı) bir versiyonu olmalı.
const alpha = (color: string, opacity: number) =>
  `${color}${Math.round(opacity * 255)
    .toString(16)
    .padStart(2, '0')}`;

function tallyScores(answers: LoveLanguageKey[]): Record<LoveLanguageKey, number> {
  const scores = { words: 0, time: 0, gifts: 0, acts: 0, touch: 0 } as Record<LoveLanguageKey, number>;
  for (const key of answers) scores[key] += 1;
  return scores;
}

function ResultBars({ title, result }: { title: string; result: LoveLanguageResult }) {
  return (
    <View style={styles.resultBlock}>
      <Text style={styles.resultBlockTitle}>{title}</Text>
      <View style={styles.barsGroup}>
        {LOVE_LANGUAGE_KEYS.map((key) => {
          const meta = LOVE_LANGUAGE_META[key];
          const score = result.scores[key] ?? 0;
          const isTop = key === result.topLanguage;
          return (
            <View key={key} style={styles.barRow}>
              <View style={[styles.barIcon, { backgroundColor: alpha(meta.color, isTop ? 0.28 : 0.14) }]}>
                <Icon name={meta.icon as IconName} size={15} color={meta.color} />
              </View>
              <View style={styles.barTrackWrap}>
                <Text style={[styles.barLabel, isTop && { color: colors.foreground, fontWeight: '800' }]}>
                  {meta.label}
                </Text>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      { width: `${(score / LOVE_LANGUAGE_QUESTIONS.length) * 100}%`, backgroundColor: meta.color },
                    ]}
                  />
                </View>
              </View>
              <Text style={styles.barScore}>{score}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

type NavProp = NativeStackNavigationProp<RootStackParamList, 'AskDili'>;

export default function LoveLanguageScreen({ navigation }: { navigation: NavProp }) {
  const { user, partner } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<LoveLanguageResponse | null>(null);
  const [phase, setPhase] = useState<'result' | 'intro' | 'quiz'>('intro');
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<LoveLanguageKey[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<LoveLanguageResponse>('/love-language');
      setData(res);
      setPhase(res.me ? 'result' : 'intro');
    } catch (e) {
      Alert.alert('Yüklenemedi', e instanceof Error ? e.message : 'Lütfen tekrar dene.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const startQuiz = () => {
    setQuestionIndex(0);
    setAnswers([]);
    setPhase('quiz');
  };

  const question = LOVE_LANGUAGE_QUESTIONS[questionIndex];
  const isLastQuestion = questionIndex === LOVE_LANGUAGE_QUESTIONS.length - 1;

  const submit = async (finalAnswers: LoveLanguageKey[]) => {
    setSubmitting(true);
    try {
      await api.post<LoveLanguageResult>('/love-language', { scores: tallyScores(finalAnswers) });
      await load();
    } catch (e) {
      Alert.alert('Gönderilemedi', e instanceof Error ? e.message : 'Sonucun kaydedilemedi, lütfen tekrar dene.');
      setPhase('intro');
    } finally {
      setSubmitting(false);
    }
  };

  const selectOption = (key: LoveLanguageKey) => {
    if (submitting) return;
    const next = [...answers, key];
    if (isLastQuestion) {
      setAnswers(next);
      submit(next);
      return;
    }
    setAnswers(next);
    setQuestionIndex((i) => i + 1);
  };

  const goBackOneQuestion = () => {
    if (questionIndex === 0) {
      setPhase('intro');
      return;
    }
    setAnswers((prev) => prev.slice(0, -1));
    setQuestionIndex((i) => i - 1);
  };

  const partnerName = partner?.name ?? 'Partnerin';
  const progress = useMemo(
    () => (questionIndex + 1) / LOVE_LANGUAGE_QUESTIONS.length,
    [questionIndex],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Geri dön"
          style={styles.circleButton}
          onPress={() => (phase === 'quiz' ? goBackOneQuestion() : navigation.goBack())}
        >
          <Icon name="arrow-left" size={20} color={colors.foreground} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>Aşk Dili Testi</Text>
          <Text style={styles.headerSubtitle}>
            {phase === 'quiz' ? `Soru ${questionIndex + 1} / ${LOVE_LANGUAGE_QUESTIONS.length}` : 'Uyum testi'}
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : phase === 'quiz' ? (
        <View style={styles.flexOne}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
          <ScrollView contentContainerStyle={styles.quizContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.questionText}>{question.text}</Text>
            <View style={styles.optionsGroup}>
              {question.options.map((option) => {
                const meta = LOVE_LANGUAGE_META[option.key];
                return (
                  <Pressable
                    key={option.key}
                    disabled={submitting}
                    style={({ pressed }) => [
                      styles.optionCard,
                      pressed && styles.optionCardPressed,
                      submitting && styles.optionCardDisabled,
                    ]}
                    onPress={() => selectOption(option.key)}
                  >
                    <View style={[styles.optionDot, { backgroundColor: meta.color }]} />
                    <Text style={styles.optionText}>{option.text}</Text>
                  </Pressable>
                );
              })}
            </View>
            {submitting && (
              <View style={styles.submittingRow}>
                <ActivityIndicator color={colors.primary} size="small" />
                <Text style={styles.submittingText}>Sonucun hesaplanıyor...</Text>
              </View>
            )}
          </ScrollView>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {phase === 'result' && data?.me ? (
            <>
              <View style={styles.topCard}>
                <View
                  style={[
                    styles.topIcon,
                    { backgroundColor: alpha(LOVE_LANGUAGE_META[data.me.topLanguage as LoveLanguageKey].color, 0.2) },
                  ]}
                >
                  <Icon
                    name={LOVE_LANGUAGE_META[data.me.topLanguage as LoveLanguageKey].icon as IconName}
                    size={30}
                    color={LOVE_LANGUAGE_META[data.me.topLanguage as LoveLanguageKey].color}
                  />
                </View>
                <Text style={styles.topEyebrow}>SENİN AŞK DİLİN</Text>
                <Text style={styles.topTitle}>
                  {LOVE_LANGUAGE_META[data.me.topLanguage as LoveLanguageKey].label}
                </Text>
                <Text style={styles.topDescription}>
                  {LOVE_LANGUAGE_META[data.me.topLanguage as LoveLanguageKey].description}
                </Text>
              </View>

              <ResultBars title={`${user?.name ?? 'Senin'} sonucun`} result={data.me} />

              {data.partner ? (
                <ResultBars title={`${partnerName} sonucu`} result={data.partner} />
              ) : (
                <View style={styles.lockedCard}>
                  <Icon name="lock-outline" size={22} color={colors.mutedForeground} />
                  <Text style={styles.lockedTitle}>{partnerName} henüz teste girmedi</Text>
                  <Text style={styles.lockedCaption}>
                    O da tamamladığında sonuçlarınızı yan yana karşılaştırabileceksiniz.
                  </Text>
                </View>
              )}

              <Pressable style={styles.retakeButton} onPress={startQuiz}>
                <Icon name="refresh" size={16} color={colors.primary} />
                <Text style={styles.retakeText}>Testi yeniden yap</Text>
              </Pressable>
            </>
          ) : (
            <View style={styles.introCard}>
              <View style={styles.introIcon}>
                <Icon name="cards-heart-outline" size={30} color={colors.accent} />
              </View>
              <Text style={styles.introTitle}>Sevgi dilini keşfet</Text>
              <Text style={styles.introDescription}>
                {LOVE_LANGUAGE_QUESTIONS.length} kısa soruya cevap ver, en baskın sevgi dilini öğren.{' '}
                {partnerName} de tamamladığında sonuçlarınızı karşılaştırabilirsiniz.
              </Text>
              <Pressable style={styles.startButton} onPress={startQuiz}>
                <Text style={styles.startButtonText}>Teste başla</Text>
                <Icon name="arrow-right" size={18} color={colors.primaryForeground} />
              </Pressable>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  flexOne: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  circleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  headerCopy: { flex: 1 },
  headerTitle: { fontFamily: fonts.heading, fontSize: 16, color: colors.foreground },
  headerSubtitle: { fontFamily: fonts.body, fontSize: 12, color: colors.mutedForeground, marginTop: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { padding: 20, gap: 18, paddingBottom: 40 },

  progressTrack: {
    height: 4,
    backgroundColor: colors.muted,
  },
  progressFill: {
    height: 4,
    backgroundColor: colors.primary,
  },
  quizContent: { padding: 20, paddingBottom: 40, gap: 22 },
  questionText: {
    fontFamily: fonts.heading,
    fontSize: 21,
    lineHeight: 27,
    color: colors.foreground,
  },
  optionsGroup: { gap: 12 },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  optionCardPressed: { opacity: 0.7 },
  optionCardDisabled: { opacity: 0.5 },
  optionDot: { width: 10, height: 10, borderRadius: 5 },
  optionText: { flex: 1, fontFamily: fonts.body, fontSize: 14.5, lineHeight: 20, color: colors.cardForeground },
  submittingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4 },
  submittingText: { fontFamily: fonts.body, fontSize: 12, color: colors.mutedForeground },

  introCard: {
    alignItems: 'center',
    padding: 26,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    gap: 6,
  },
  introIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${colors.accent}1F`,
    marginBottom: 6,
  },
  introTitle: { fontFamily: fonts.heading, fontSize: 20, color: colors.foreground, textAlign: 'center' },
  introDescription: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: 4,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 18,
    paddingHorizontal: 22,
    paddingVertical: 13,
    borderRadius: 20,
    backgroundColor: colors.primary,
  },
  startButtonText: { fontFamily: fonts.body, fontSize: 14, fontWeight: '800', color: colors.primaryForeground },

  topCard: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  topIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  topEyebrow: {
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: colors.mutedForeground,
  },
  topTitle: { fontFamily: fonts.heading, fontSize: 24, color: colors.foreground, marginTop: 4 },
  topDescription: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: 8,
  },

  resultBlock: {
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    gap: 14,
  },
  resultBlockTitle: { fontFamily: fonts.body, fontSize: 13, fontWeight: '800', color: colors.cardForeground },
  barsGroup: { gap: 12 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barTrackWrap: { flex: 1, gap: 4 },
  barLabel: { fontFamily: fonts.body, fontSize: 11.5, color: colors.mutedForeground },
  barTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.muted,
    overflow: 'hidden',
  },
  barFill: { height: 8, borderRadius: 4 },
  barScore: { width: 20, textAlign: 'right', fontFamily: fonts.body, fontSize: 12, fontWeight: '800', color: colors.foreground },

  lockedCard: {
    alignItems: 'center',
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: `${colors.muted}80`,
    gap: 6,
  },
  lockedTitle: { fontFamily: fonts.body, fontSize: 13.5, fontWeight: '800', color: colors.foreground, marginTop: 2 },
  lockedCaption: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
    color: colors.mutedForeground,
    textAlign: 'center',
  },

  retakeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  retakeText: { fontFamily: fonts.body, fontSize: 13, fontWeight: '700', color: colors.primary },
});
