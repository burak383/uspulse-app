import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, FontAwesome, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, fonts } from '../theme';
import { useAuth } from '../src/context/AuthContext';

const imageUrl =
  'https://fwtngjyirchhhysukjxi.supabase.co/storage/v1/object/public/project-images/d8f99d97-2440-4f3a-addf-6eb2753287e6/c631128b-dade-440b-91d4-bd1581192882.png';

const alpha = (color: string, opacity: number) =>
  `${color}${Math.round(opacity * 255)
    .toString(16)
    .padStart(2, '0')}`;

type FeatherIconName = React.ComponentProps<typeof Feather>['name'];

const Icon = ({
  name,
  size = 20,
  color = colors.foreground,
}: {
  name: FeatherIconName;
  size?: number;
  color?: string;
}) => <Feather name={name} size={size} color={color} />;

const Section = ({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: object;
}) => <View style={[styles.section, style]}>{children}</View>;

const PillIcon = ({
  children,
  background = alpha(colors.primary, 0.15),
  size = 44,
}: {
  children: React.ReactNode;
  background?: string;
  color?: string;
  size?: number;
}) => (
  <View
    style={[
      styles.pillIcon,
      { width: size, height: size, borderRadius: size / 2, backgroundColor: background },
    ]}
  >
    {children}
  </View>
);

export default function MatchScreen() {
  const { user, error, pair, logout, clearError } = useAuth();
  const [partnerCode, setPartnerCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const inviteCode = user?.inviteCode ?? '------';
  const codeChars = inviteCode.padEnd(6, '-').split('');

  const shareInvite = async () => {
    try {
      await Share.share({
        message: `UsPulse'de sana küçük anlar bırakmak istiyorum. Davet kodum: ${inviteCode}`,
      });
    } catch {
      // sharing cancelled - nothing to do
    }
  };

  const submitPair = async () => {
    if (!partnerCode.trim()) return;
    clearError();
    setSubmitting(true);
    try {
      await pair(partnerCode.trim().toUpperCase());
    } catch {
      // error surfaced via context
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <LinearGradient
          colors={[colors.card, colors.background, colors.background]}
          style={styles.hero}
        >
          <View style={styles.glowPrimary} />
          <View style={styles.glowAccent} />

          <SafeAreaView>
            <View style={styles.header}>
              <Pressable accessibilityLabel="Çıkış yap" style={styles.circleButton} onPress={logout}>
                <Icon name="log-out" size={19} color={colors.cardForeground} />
              </Pressable>

              <View style={styles.matchBadge}>
                <Text style={styles.matchBadgeText}>EŞLEŞ</Text>
              </View>

              <View style={styles.headerSpacer} />
            </View>

            <View style={styles.heroCopy}>
              <Text style={styles.eyebrow}>SADECE İKİNİZ İÇİN</Text>
              <Text style={styles.heroTitle}>Bu alan ikinize ait.</Text>
              <Text style={styles.heroDescription}>
                UsPulse, birlikte kurduğunuz küçük anlarla başlar. Önce birbirinizi bulalım,{' '}
                {user?.name ? `${user.name}.` : ''}
              </Text>
            </View>

            <View style={styles.heroImageFrame}>
              <Image source={{ uri: imageUrl }} style={styles.heroImage} resizeMode="cover" />
              <LinearGradient
                colors={['transparent', alpha(colors.background, 0.86)]}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.imageCaption}>
                <View>
                  <Text style={styles.imageTitle}>İki uzak ışık</Text>
                  <Text style={styles.imageSubtitle}>aynı yuvada buluşuyor</Text>
                </View>
                <View style={styles.imageSparkle}>
                  <Icon name="star" size={18} color={colors.primary} />
                </View>
              </View>
            </View>
          </SafeAreaView>
        </LinearGradient>

        <View style={styles.content}>
          <Section style={{ borderColor: alpha(colors.primary, 0.3) }}>
            <View style={styles.rowBetween}>
              <View style={styles.flexCopy}>
                <Text style={styles.eyebrow}>SENİN DAVETİN</Text>
                <Text style={styles.sectionTitle}>Partnerine küçük bir kapı aç.</Text>
              </View>
              <PillIcon>
                <Icon name="heart" size={21} color={colors.primary} />
              </PillIcon>
            </View>

            <View style={styles.quoteBox}>
              <Text style={styles.quote}>
                "{user?.name ?? 'Sen'}, UsPulse'de sana küçük anlar bırakmak istiyorum."
              </Text>
              <Text style={styles.helperText}>{user?.name ?? 'Sen'} olarak gönderilecek kişisel davet</Text>
            </View>

            <View style={styles.actionRow}>
              <Pressable
                style={[styles.actionButton, { backgroundColor: colors.success }]}
                onPress={shareInvite}
              >
                <FontAwesome name="whatsapp" size={17} color={colors.successForeground} />
                <Text style={[styles.actionText, { color: colors.successForeground }]}>
                  WhatsApp'tan gönder
                </Text>
              </Pressable>
              <Pressable
                style={[styles.actionButton, { backgroundColor: colors.secondary }]}
                onPress={shareInvite}
              >
                <Icon name="message-square" size={16} color={colors.primary} />
                <Text style={styles.actionText}>SMS gönder</Text>
              </Pressable>
            </View>
          </Section>

          <Section>
            <View style={styles.rowStart}>
              <PillIcon background={alpha(colors.accent, 0.15)} size={40}>
                <Icon name="key" size={18} color={colors.accent} />
              </PillIcon>
              <View style={styles.flexCopy}>
                <Text style={styles.sectionTitleSmall}>Senin davet kodun</Text>
                <Text style={styles.description}>
                  Partnerin UsPulse'i açtığında bu kodu girerek sana bağlanabilir.
                </Text>
              </View>
            </View>

            <View style={styles.codeRow}>
              {codeChars.map((char, index) => (
                <View key={`${char}-${index}`} style={styles.codeCell}>
                  <Text style={styles.codeText}>{char}</Text>
                </View>
              ))}
            </View>

            <View style={styles.notice}>
              <Icon name="shield" size={16} color={colors.success} />
              <Text style={styles.noticeText}>
                Bu kod yalnızca sizin için. Herkese açık bir profil oluşturulmaz.
              </Text>
            </View>
          </Section>

          <Section>
            <View style={styles.rowStart}>
              <PillIcon background={alpha(colors.primary, 0.15)} size={40}>
                <Icon name="link" size={18} color={colors.primary} />
              </PillIcon>
              <View style={styles.flexCopy}>
                <Text style={styles.sectionTitleSmall}>Bir davet kodun var mı?</Text>
                <Text style={styles.description}>
                  Partnerinin sana gönderdiği 6 haneli kodu aşağıya yaz ve eşleşin.
                </Text>
              </View>
            </View>

            <TextInput
              value={partnerCode}
              onChangeText={(value) => {
                setPartnerCode(value.toUpperCase());
                if (error) clearError();
              }}
              placeholder="Örn. AB12CD"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="characters"
              maxLength={8}
              style={styles.codeInput}
            />

            {error && <Text style={styles.errorText}>{error}</Text>}

            <Pressable
              style={[styles.pairButton, (!partnerCode.trim() || submitting) && styles.pairButtonDisabled]}
              onPress={submitPair}
              disabled={!partnerCode.trim() || submitting}
            >
              {submitting ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <>
                  <Icon name="link-2" size={18} color={colors.primaryForeground} />
                  <Text style={styles.matchButtonText}>Kodla eşleş</Text>
                </>
              )}
            </Pressable>
          </Section>

          <LinearGradient
            colors={[colors.secondary, colors.card, colors.background]}
            style={[styles.section, styles.unlockCard]}
          >
            <View style={styles.rowStart}>
              <PillIcon>
                <Icon name="lock" size={20} color={colors.primary} />
              </PillIcon>
              <View style={styles.flexCopy}>
                <Text style={styles.eyebrow}>BİRLİKTE AÇILACAK</Text>
                <Text style={styles.unlockTitle}>İlk günlük soru</Text>
                <Text style={styles.description}>
                  Eşleştiğiniz anda ikinize özel ilk soru sizi bekliyor.
                </Text>
              </View>
            </View>

            <View style={styles.ritualBox}>
              <View style={styles.flexCopy}>
                <Text style={styles.helperText}>İlk ortak ritüel</Text>
                <Text style={styles.ritualTitle}>
                  Birbirimizde en sevdiğimiz küçük şey
                </Text>
              </View>
              <MaterialCommunityIcons
                name="message-outline"
                size={27}
                color={colors.accent}
              />
            </View>
          </LinearGradient>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: 60,
  },
  hero: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    overflow: 'hidden',
  },
  glowPrimary: {
    position: 'absolute',
    width: 210,
    height: 210,
    borderRadius: 105,
    right: -75,
    top: 35,
    backgroundColor: alpha(colors.primary, 0.1),
  },
  glowAccent: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    left: -95,
    top: 170,
    backgroundColor: alpha(colors.accent, 0.08),
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
    backgroundColor: alpha(colors.card, 0.75),
  },
  headerSpacer: {
    width: 44,
  },
  matchBadge: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: alpha(colors.primary, 0.2),
    backgroundColor: alpha(colors.primary, 0.1),
  },
  matchBadgeText: {
    color: colors.primary,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  heroCopy: {
    marginTop: 31,
  },
  eyebrow: {
    color: colors.primary,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  heroTitle: {
    maxWidth: 320,
    marginTop: 8,
    color: colors.foreground,
    fontFamily: fonts.heading,
    fontSize: 35,
    lineHeight: 39,
  },
  heroDescription: {
    maxWidth: 320,
    marginTop: 12,
    color: colors.mutedForeground,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 22,
  },
  heroImageFrame: {
    height: 192,
    marginTop: 26,
    overflow: 'hidden',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: alpha(colors.border, 0.8),
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
  },
  imageCaption: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 15,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  imageTitle: {
    color: colors.primaryForeground,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '800',
  },
  imageSubtitle: {
    marginTop: 4,
    color: colors.mutedForeground,
    fontFamily: fonts.body,
    fontSize: 11,
  },
  imageSparkle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: alpha(colors.background, 0.75),
  },
  content: {
    gap: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  section: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
  },
  rowStart: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  flexCopy: {
    flex: 1,
  },
  pillIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: alpha(colors.primary, 0.15),
  },
  sectionTitle: {
    marginTop: 8,
    color: colors.foreground,
    fontFamily: fonts.heading,
    fontSize: 23,
    lineHeight: 29,
  },
  sectionTitleSmall: {
    color: colors.foreground,
    fontFamily: fonts.heading,
    fontSize: 20,
    lineHeight: 26,
  },
  description: {
    marginTop: 4,
    color: colors.mutedForeground,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 18,
  },
  quoteBox: {
    marginTop: 20,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: alpha(colors.secondary, 0.55),
  },
  quote: {
    color: colors.foreground,
    fontFamily: fonts.heading,
    fontSize: 20,
    lineHeight: 27,
  },
  helperText: {
    marginTop: 10,
    color: colors.mutedForeground,
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 16,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  actionButton: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: 10,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  actionText: {
    color: colors.secondaryForeground,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  codeRow: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    marginTop: 20,
  },
  codeCell: {
    width: 43,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: alpha(colors.primary, 0.5),
    backgroundColor: colors.input,
  },
  codeText: {
    color: colors.primary,
    fontFamily: fonts.heading,
    fontSize: 22,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 16,
    padding: 12,
    borderRadius: 14,
    backgroundColor: alpha(colors.muted, 0.6),
  },
  noticeText: {
    flex: 1,
    color: colors.mutedForeground,
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 17,
  },
  codeInput: {
    marginTop: 20,
    minHeight: 52,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: alpha(colors.primary, 0.5),
    backgroundColor: colors.input,
    color: colors.foreground,
    fontFamily: fonts.heading,
    fontSize: 20,
    letterSpacing: 4,
    textAlign: 'center',
  },
  errorText: {
    marginTop: 10,
    color: colors.destructive,
    fontFamily: fonts.body,
    fontSize: 12,
    textAlign: 'center',
  },
  pairButton: {
    minHeight: 54,
    marginTop: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 9,
    borderRadius: 28,
    backgroundColor: colors.primary,
  },
  pairButtonDisabled: {
    opacity: 0.5,
  },
  matchButtonText: {
    color: colors.primaryForeground,
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '900',
  },
  unlockCard: {
    overflow: 'hidden',
    borderColor: alpha(colors.primary, 0.25),
  },
  unlockTitle: {
    marginTop: 4,
    color: colors.foreground,
    fontFamily: fonts.heading,
    fontSize: 25,
    lineHeight: 30,
  },
  ritualBox: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 15,
    backgroundColor: alpha(colors.background, 0.35),
  },
  ritualTitle: {
    marginTop: 4,
    color: colors.foreground,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '800',
  },
});
