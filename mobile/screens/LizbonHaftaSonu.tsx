import React from 'react';
import {
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, fonts } from '../theme';
import { RootStackParamList } from '../navigation/types';

const heroImage =
  'https://fwtngjyirchhhysukjxi.supabase.co/storage/v1/object/public/project-images/d8f99d97-2440-4f3a-addf-6eb2753287e6/a2173802-fac9-424e-97c5-a18fbd52cc05.png';

const recommendationImage =
  'https://fwtngjyirchhhysukjxi.supabase.co/storage/v1/object/public/project-images/d8f99d97-2440-4f3a-addf-6eb2753287e6/a5bb0626-3247-4221-8778-a640482a1dc5.png';

const alpha = (color: string, opacity: number) => {
  const value = color.replace('#', '');
  const red = parseInt(value.slice(0, 2), 16);
  const green = parseInt(value.slice(2, 4), 16);
  const blue = parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
};

const Icon = ({
  name,
  size = 20,
  color = colors.foreground,
}: {
  name: keyof typeof Ionicons.glyphMap;
  size?: number;
  color?: string;
}) => <Ionicons name={name} size={size} color={color} />;

const Card = ({ children, style }: { children: React.ReactNode; style?: object }) => (
  <View style={[styles.card, style]}>{children}</View>
);

const Pill = ({
  children,
  active = false,
}: {
  children: React.ReactNode;
  active?: boolean;
}) => (
  <View style={[styles.tab, active ? styles.activeTab : styles.inactiveTab]}>
    <Text style={[styles.tabText, active && styles.activeTabText]}>{children}</Text>
  </View>
);

const ProgressBar = ({
  value,
  height = 8,
  colors: gradientColors = [colors.primary, colors.accent],
}: {
  value: number;
  height?: number;
  colors?: readonly [string, string, ...string[]];
}) => (
  <View style={[styles.progressTrack, { height }]}>
    <LinearGradient
      colors={gradientColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={[styles.progressFill, { width: `${value * 100}%` }]}
    />
  </View>
);

type NavProp = NativeStackNavigationProp<RootStackParamList, 'LizbonHaftaSonu'>;

export default function LisbonWeekendScreen({ navigation }: { navigation: NavProp }) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.hero}>
            <Image source={{ uri: heroImage }} style={styles.heroImage} resizeMode="cover" />
            <LinearGradient
              colors={[alpha(colors.background, 0.75), alpha(colors.background, 0.08), colors.background]}
              locations={[0, 0.48, 1]}
              style={StyleSheet.absoluteFill}
            />

            <View style={styles.heroActions}>
              <Pressable accessibilityLabel="Geri dön" style={styles.heroButton} onPress={() => navigation.goBack()}>
                <Icon name="arrow-back" />
              </Pressable>
              <Pressable
                accessibilityLabel="Plan seçenekleri"
                style={styles.heroButton}
                onPress={() => {
                  Alert.alert('Plan seçenekleri', undefined, [
                    {
                      text: 'Paylaş',
                      onPress: () =>
                        Share.share({
                          message: 'Lizbon Hafta Sonu planımıza göz at: 7–10 Kasım 2026 · İki kişilik kaçamak',
                        }),
                    },
                    { text: 'Kapat', style: 'cancel' },
                  ]);
                }}
              >
                <Icon name="ellipsis-horizontal" />
              </Pressable>
            </View>

            <View style={styles.heroCopy}>
              <View style={styles.eyebrowPill}>
                <Icon name="sparkles" size={14} color={colors.accent} />
                <Text style={styles.eyebrowPillText}>BİRGÜN BİRLİKTE</Text>
              </View>
              <Text style={styles.heroTitle}>Lizbon Hafta Sonu</Text>
              <Text style={styles.heroSubtitle}>7–10 Kasım 2026 · İki kişilik kaçamak</Text>
            </View>
          </View>

          <View style={styles.content}>
            <Card style={styles.statusCard}>
              <View style={styles.statusIcon}>
                <Icon name="airplane" size={19} color={colors.primary} />
              </View>
              <View style={styles.statusCopy}>
                <Text style={styles.statusTitle}>Birlikte seçiyoruz</Text>
                <Text style={styles.mutedText}>Karar sizde, rezervasyon yok.</Text>
              </View>
              <MaterialCommunityIcons name="hand-heart-outline" size={23} color={colors.primary} />
            </Card>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
              <Pill active>Genel bakış</Pill>
              <Pill>Yapılacaklar</Pill>
              <Pill>Bütçe</Pill>
              <Pill>Öneriler</Pill>
            </ScrollView>

            <Card>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.labelPrimary}>ORTAK HAZIRLIK</Text>
                  <Text style={styles.heading}>Lizbon'a doğru</Text>
                </View>
                <Text style={styles.counter}>2/4</Text>
              </View>

              <View style={styles.progressSpacing}>
                <ProgressBar value={0.5} />
              </View>

              <View style={styles.checklist}>
                <ChecklistRow complete title="Uçuş fiyat alarmı kur" person="Elif tamamladı" />
                <ChecklistRow complete title="Alfama'da konaklama seç" person="Deniz tamamladı" />
                <ChecklistRow title="Tram 28'e bin" person="Elif bekliyor" />
                <ChecklistRow title="Pastel de nata ye" person="Deniz bekliyor" last />
              </View>
            </Card>

            <Card>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.labelAccent}>BİRLİKTE BİRİKTİRİYORUZ</Text>
                  <Text style={styles.heading}>Lizbon bütçesi</Text>
                </View>
                <View style={styles.roundIconAccent}>
                  <Icon name="wallet-outline" size={21} color={colors.accent} />
                </View>
              </View>

              <View style={styles.budgetNumbers}>
                <View>
                  <Text style={styles.mutedText}>Biriken</Text>
                  <Text style={styles.amount}>8.400 TL</Text>
                </View>
                <View style={styles.alignRight}>
                  <Text style={styles.mutedText}>Hedef</Text>
                  <Text style={styles.target}>18.500 TL</Text>
                </View>
              </View>

              <ProgressBar value={0.45} height={12} colors={[colors.accent, colors.primary]} />
              <View style={styles.budgetMeta}>
                <Text style={styles.mutedText}>%45 tamamlandı</Text>
                <Text style={styles.mutedText}>Kalan 10.100 TL</Text>
              </View>

              <View style={styles.contribution}>
                <View style={styles.avatar}>E</View>
                <Text style={styles.mutedText}>
                  <Text style={styles.foregroundBold}>Elif +1.200 TL</Text> · dün
                </Text>
              </View>
              <Text style={[styles.tinyMuted, { marginTop: 10 }]}>
                Bu plan Planlar sekmesindeki "Kaş Kaçamağı" birikiminden ayrı, gösterim amaçlı bir örnektir.
              </Text>
            </Card>

            <View>
              <View style={styles.notesHeader}>
                <View>
                  <Text style={styles.labelPrimary}>İKİNİZ İÇİN SEÇTİK</Text>
                  <Text style={styles.heading}>Lizbon'dan notlar</Text>
                </View>
                <Icon name="bookmark-outline" size={23} color={colors.accent} />
              </View>

              <Card style={styles.recommendationCard}>
                <View style={styles.recommendationImageWrap}>
                  <Image source={{ uri: recommendationImage }} style={styles.recommendationImage} />
                  <LinearGradient
                    colors={['transparent', alpha(colors.background, 0.8)]}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={styles.recommendationBadge}>
                    <Text style={styles.recommendationBadgeText}>Mutlaka deneyin</Text>
                  </View>
                </View>
                <View style={styles.recommendationBody}>
                  <View style={styles.recommendationTitleRow}>
                    <View style={styles.flex}>
                      <Text style={styles.subheading}>Time Out Market</Text>
                      <Text style={styles.mutedText}>İlk sabahınız için kahve, tatlı ve biraz kaybolma.</Text>
                    </View>
                    <Icon name="bookmark-outline" size={23} color={colors.primary} />
                  </View>
                </View>
              </Card>

              <Card style={styles.hotelCard}>
                <View style={styles.roundIconAccent}>
                  <MaterialCommunityIcons name="office-building-outline" size={22} color={colors.accent} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.hotelTitle}>Alfama Boutique Hotel</Text>
                  <Text style={styles.mutedText}>Gecelik <Text style={styles.foregroundBold}>4.280 TL</Text> · Alfama</Text>
                </View>
              </Card>
            </View>

            <Card style={styles.decisionCard}>
              <View style={styles.decisionLabel}>
                <Icon name="chatbubbles-outline" size={19} color={colors.accent} />
                <Text style={styles.labelAccent}>SIRADAKİ KÜÇÜK KARAR</Text>
              </View>
              <Text style={styles.decisionHeading}>Bu tarih ikinize de{'\n'}iyi geliyor mu?</Text>
              <Text style={styles.mutedText}>Onaylamak rezervasyon yapmaz; sadece birlikte hazır olduğunuzu işaretler.</Text>
            </Card>
          </View>
        </ScrollView>

        <View style={styles.bottomBar}>
          <Pressable style={styles.confirmButton} onPress={() => navigation.goBack()}>
            <Icon name="heart-outline" size={19} color={colors.primaryForeground} />
            <Text style={styles.confirmText}>Geri dön</Text>
          </Pressable>
          <Text style={styles.bottomHint}>Bu, Planlar sekmesindeki "Öne çıkan plan" örneğidir.</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

function ChecklistRow({
  complete = false,
  title,
  person,
  last = false,
}: {
  complete?: boolean;
  title: string;
  person: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.checklistRow, !last && styles.checklistBorder]}>
      <View style={[styles.checkCircle, complete ? styles.completeCircle : styles.pendingCircle]}>
        <Icon name={complete ? 'checkmark' : 'ellipse-outline'} size={complete ? 15 : 14} color={complete ? colors.success : colors.mutedForeground} />
      </View>
      <Text style={styles.checkTitle}>{title}</Text>
      <Text style={[styles.person, complete ? styles.successText : styles.mutedText]}>{person}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  screen: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingBottom: 142 },
  hero: { height: 292, position: 'relative', overflow: 'hidden' },
  heroImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  heroActions: { position: 'absolute', top: 42, left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between' },
  heroButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(colors.background, 0.62), borderWidth: 1, borderColor: alpha(colors.foreground, 0.25) },
  heroCopy: { position: 'absolute', bottom: 20, left: 20, right: 20 },
  eyebrowPill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18, backgroundColor: alpha(colors.background, 0.76), borderWidth: 1, borderColor: alpha(colors.accent, 0.35) },
  eyebrowPillText: { color: colors.accent, fontFamily: fonts.body, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  heroTitle: { marginTop: 10, color: colors.foreground, fontFamily: fonts.heading, fontSize: 32 },
  heroSubtitle: { marginTop: 6, color: alpha(colors.foreground, 0.82), fontFamily: fonts.body, fontSize: 14, fontWeight: '600' },
  content: { paddingHorizontal: 20, gap: 24 },
  card: { padding: 20, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  statusCard: { marginTop: -1, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  statusIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(colors.primary, 0.15) },
  statusCopy: { flex: 1 },
  statusTitle: { color: colors.cardForeground, fontFamily: fonts.body, fontSize: 14, fontWeight: '800' },
  mutedText: { marginTop: 3, color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 12, lineHeight: 18 },
  tabs: { gap: 8, paddingBottom: 1 },
  tab: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  activeTab: { backgroundColor: colors.primary },
  inactiveTab: { backgroundColor: colors.secondary },
  tabText: { color: colors.secondaryForeground, fontFamily: fonts.body, fontSize: 12, fontWeight: '700' },
  activeTabText: { color: colors.primaryForeground },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  labelPrimary: { color: colors.primary, fontFamily: fonts.body, fontSize: 11, fontWeight: '800', letterSpacing: 1.3 },
  labelAccent: { color: colors.accent, fontFamily: fonts.body, fontSize: 11, fontWeight: '800', letterSpacing: 1.3 },
  heading: { marginTop: 4, color: colors.cardForeground, fontFamily: fonts.heading, fontSize: 25 },
  counter: { color: colors.accent, fontFamily: fonts.heading, fontSize: 25 },
  progressSpacing: { marginTop: 17 },
  progressTrack: { overflow: 'hidden', borderRadius: 10, backgroundColor: colors.muted },
  progressFill: { height: '100%', borderRadius: 10 },
  checklist: { marginTop: 12 },
  checklistRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  checklistBorder: { borderBottomWidth: 1, borderBottomColor: alpha(colors.border, 0.6) },
  checkCircle: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  completeCircle: { backgroundColor: alpha(colors.success, 0.15) },
  pendingCircle: { borderWidth: 1, borderColor: colors.border },
  checkTitle: { flex: 1, color: colors.cardForeground, fontFamily: fonts.body, fontSize: 13, fontWeight: '700' },
  person: { fontFamily: fonts.body, fontSize: 11, fontWeight: '700' },
  successText: { color: colors.success },
  roundIconAccent: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(colors.accent, 0.15) },
  budgetNumbers: { marginTop: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  amount: { marginTop: 3, color: colors.accent, fontFamily: fonts.heading, fontSize: 30 },
  alignRight: { alignItems: 'flex-end' },
  target: { marginTop: 4, color: colors.cardForeground, fontFamily: fonts.body, fontSize: 14, fontWeight: '800' },
  budgetMeta: { marginTop: 5, flexDirection: 'row', justifyContent: 'space-between' },
  contribution: { marginTop: 16, paddingTop: 15, flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: alpha(colors.border, 0.6) },
  avatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', color: colors.primary, backgroundColor: alpha(colors.primary, 0.15), fontFamily: fonts.body, fontWeight: '800' },
  foregroundBold: { color: colors.foreground, fontWeight: '800' },
  tinyMuted: { color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 10 },
  notesHeader: { marginBottom: 12, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  recommendationCard: { padding: 0, overflow: 'hidden' },
  recommendationImageWrap: { height: 176, position: 'relative' },
  recommendationImage: { width: '100%', height: '100%' },
  recommendationBadge: { position: 'absolute', bottom: 12, left: 16, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18, backgroundColor: alpha(colors.background, 0.8) },
  recommendationBadgeText: { color: colors.accent, fontFamily: fonts.body, fontSize: 11, fontWeight: '800' },
  recommendationBody: { padding: 16 },
  recommendationTitleRow: { flexDirection: 'row', gap: 12 },
  flex: { flex: 1 },
  subheading: { color: colors.cardForeground, fontFamily: fonts.heading, fontSize: 21 },
  hotelCard: { marginTop: 12, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
  hotelTitle: { color: colors.cardForeground, fontFamily: fonts.body, fontSize: 14, fontWeight: '800' },
  decisionCard: { borderColor: alpha(colors.primary, 0.3), backgroundColor: colors.card },
  decisionLabel: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  decisionHeading: { marginTop: 12, color: colors.cardForeground, fontFamily: fonts.heading, fontSize: 25, lineHeight: 30 },
  bottomBar: { position: 'absolute', right: 0, bottom: 0, left: 0, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24, backgroundColor: alpha(colors.background, 0.96), borderTopWidth: 1, borderTopColor: alpha(colors.border, 0.7) },
  confirmButton: { minHeight: 56, borderRadius: 20, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, backgroundColor: colors.primary },
  confirmText: { color: colors.primaryForeground, fontFamily: fonts.body, fontSize: 14, fontWeight: '900' },
  bottomHint: { marginTop: 7, textAlign: 'center', color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 10 },
});
