import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Purchases, { PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import { theme } from '../theme';
import { useAuth } from '../src/context/AuthContext';
import { isRevenueCatConfigured } from '../src/subscriptions/purchases';
import { API_URL } from '../src/api/client';

const colors = theme.colors;

// Gizlilik/koşullar sayfaları API kökünde (/api altında değil) sunuluyor --
// bkz. server/src/index.ts (`app.use('/', legalRouter)`).
const LEGAL_BASE_URL = API_URL.replace(/\/api\/?$/, '');

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

function Icon({ name, size = 20, color = colors.foreground }: { name: IconName; size?: number; color?: string }) {
  return <MaterialCommunityIcons name={name} size={size} color={color} />;
}

const FEATURES = [
  'Sınırsız ruh hâli ve "Kalbimi Gönder" paylaşımı',
  'Fotoğraf, video ve ses notu ile Anılar',
  'Zaman kapsülleri ve günün sorusu',
  'Ortak planlar ve birikim hedefleri',
];

// Beklenmedik biçimde uzayan bir bekleme kullanıcıyı ekranda asılı bırakmasın
// diye satın alma sonrası sunucudan (webhook ile güncellenen) yeni durumu en
// fazla bu kadar deneyerek çeker -- RevenueCat webhook'u normalde saniyeler
// içinde ulaşır.
const POST_PURCHASE_REFRESH_ATTEMPTS = 4;
const POST_PURCHASE_REFRESH_DELAY_MS = 1500;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function PaywallScreen() {
  const { entitlement, refresh, logout, deleteAccount } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [loadingOfferings, setLoadingOfferings] = useState(true);
  const [offeringsError, setOfferingsError] = useState<string | null>(null);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  const loadOfferings = useCallback(async () => {
    if (!isRevenueCatConfigured()) {
      setLoadingOfferings(false);
      setOfferingsError(
        'Abonelik şu anda yapılandırılmıyor. Lütfen daha sonra tekrar dene ya da uygulamayı güncelle.',
      );
      return;
    }
    setLoadingOfferings(true);
    setOfferingsError(null);
    try {
      const offerings = await Purchases.getOfferings();
      setOffering(offerings.current);
      if (!offerings.current) {
        setOfferingsError('Abonelik seçenekleri şu anda yüklenemedi. Lütfen daha sonra tekrar dene.');
      }
    } catch (e) {
      setOfferingsError('Abonelik seçenekleri yüklenemedi. İnternet bağlantını kontrol edip tekrar dene.');
    } finally {
      setLoadingOfferings(false);
    }
  }, []);

  useEffect(() => {
    loadOfferings();
  }, [loadOfferings]);

  const refreshUntilUnlocked = useCallback(async () => {
    for (let attempt = 0; attempt < POST_PURCHASE_REFRESH_ATTEMPTS; attempt += 1) {
      await refresh();
      await sleep(POST_PURCHASE_REFRESH_DELAY_MS);
    }
  }, [refresh]);

  const buyPackage = async (pkg: PurchasesPackage) => {
    setPurchasingId(pkg.identifier);
    try {
      await Purchases.purchasePackage(pkg);
      Alert.alert('Teşekkürler!', 'Aboneliğin etkinleştiriliyor, birkaç saniye sürebilir.');
      await refreshUntilUnlocked();
    } catch (e: any) {
      if (!e?.userCancelled) {
        Alert.alert('Satın alma tamamlanamadı', 'Lütfen tekrar dene.');
      }
    } finally {
      setPurchasingId(null);
    }
  };

  const restorePurchases = async () => {
    if (!isRevenueCatConfigured()) {
      Alert.alert('Kullanılamıyor', 'Abonelik şu anda yapılandırılmıyor. Lütfen daha sonra tekrar dene.');
      return;
    }
    setRestoring(true);
    try {
      await Purchases.restorePurchases();
      await refreshUntilUnlocked();
      if (!entitlement?.hasAccess) {
        Alert.alert('Eski satın alma bulunamadı', 'Bu hesapla ilişkili aktif bir abonelik bulamadık.');
      }
    } catch {
      Alert.alert('Geri yüklenemedi', 'Lütfen tekrar dene.');
    } finally {
      setRestoring(false);
    }
  };

  const trialExpired = entitlement && !entitlement.trialing && !entitlement.subscriptionActive;

  const confirmDeleteAccount = () => {
    Alert.alert(
      'Hesabını sil',
      'Devam etmek istemiyorsan hesabını buradan da silebilirsin. Bu işlem geri alınamaz: hesabın ve tüm kişisel verilerin kalıcı olarak silinir. Partnerinin hesabı etkilenmez.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Hesabımı sil',
          style: 'destructive',
          onPress: () => {
            setDeleting(true);
            deleteAccount().catch(() => {
              Alert.alert('Hesap silinemedi', 'Lütfen tekrar dene.');
              setDeleting(false);
            });
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={[colors.card, colors.background, colors.background]} style={styles.header}>
          <View style={styles.badge}>
            <Icon name="heart-multiple" size={16} color={colors.primaryForeground} />
          </View>
          <Text style={styles.eyebrow}>USPULSE ABONELİK</Text>
          <Text style={styles.title}>
            {trialExpired ? 'Ücretsiz deneme süren doldu' : 'Bağınızı sürdürmenin tam zamanı'}
          </Text>
          <Text style={styles.subtitle}>
            {trialExpired
              ? 'Ruh hâli, anılar, planlar ve daha fazlasına devam etmek için abone ol.'
              : '7 günlük ücretsiz deneme süreniz boyunca her şey açık.'}
          </Text>
        </LinearGradient>

        <View style={styles.card}>
          {FEATURES.map((f) => (
            <View key={f} style={styles.featureRow}>
              <Icon name="check-circle" size={18} color={colors.success} />
              <Text style={styles.featureText}>{f}</Text>
            </View>
          ))}
        </View>

        {loadingOfferings ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : offeringsError ? (
          <View style={styles.card}>
            <Text style={styles.errorText}>{offeringsError}</Text>
            <Pressable style={styles.retryButton} onPress={loadOfferings}>
              <Text style={styles.retryText}>Tekrar dene</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.packagesWrap}>
            {[offering?.annual, offering?.monthly].filter(Boolean).map((pkg) => {
              const p = pkg as PurchasesPackage;
              const isAnnual = p.packageType === Purchases.PACKAGE_TYPE.ANNUAL;
              return (
                <Pressable
                  key={p.identifier}
                  style={[styles.packageCard, isAnnual && styles.packageCardHighlight]}
                  onPress={() => buyPackage(p)}
                  disabled={purchasingId !== null}
                >
                  {isAnnual && (
                    <View style={styles.savingsBadge}>
                      <Text style={styles.savingsText}>EN AVANTAJLI</Text>
                    </View>
                  )}
                  <Text style={styles.packageLabel}>{isAnnual ? 'Yıllık' : 'Aylık'}</Text>
                  <Text style={styles.packagePrice}>{p.product.priceString}</Text>
                  <Text style={styles.packageCaption}>
                    {isAnnual ? 'yılda bir kez faturalandırılır' : 'ayda bir kez faturalandırılır'}
                  </Text>
                  {purchasingId === p.identifier ? (
                    <ActivityIndicator color={colors.primary} style={styles.packageSpinner} />
                  ) : (
                    <View style={styles.packageButton}>
                      <Text style={styles.packageButtonText}>Seç</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        )}

        <Pressable style={styles.restoreButton} onPress={restorePurchases} disabled={restoring}>
          {restoring ? (
            <ActivityIndicator color={colors.mutedForeground} />
          ) : (
            <Text style={styles.restoreText}>Satın alımları geri yükle</Text>
          )}
        </Pressable>

        <Text style={styles.legalNote}>
          Abonelik, iptal etmediğin sürece otomatik olarak yenilenir. İstediğin zaman cihazının mağaza ayarlarından
          iptal edebilirsin. Detaylar için{' '}
          <Text style={styles.legalLink} onPress={() => Linking.openURL(`${LEGAL_BASE_URL}/terms`)}>
            Kullanım Koşulları'na
          </Text>{' '}
          ve{' '}
          <Text style={styles.legalLink} onPress={() => Linking.openURL(`${LEGAL_BASE_URL}/privacy`)}>
            Gizlilik Politikası'na
          </Text>{' '}
          bakabilirsin.
        </Text>

        <View style={styles.bottomLinksRow}>
          <Pressable style={styles.logoutLink} onPress={logout}>
            <Text style={styles.logoutLinkText}>Çıkış yap</Text>
          </Pressable>
          <Pressable style={styles.logoutLink} onPress={confirmDeleteAccount} disabled={deleting}>
            {deleting ? (
              <ActivityIndicator color={colors.destructive} size="small" />
            ) : (
              <Text style={styles.deleteLinkText}>Hesabımı sil</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingBottom: 60 },
  header: { paddingHorizontal: 24, paddingTop: 40, paddingBottom: 28, alignItems: 'center' },
  badge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  eyebrow: {
    color: colors.primary,
    fontFamily: theme.fonts.body,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  title: {
    color: colors.foreground,
    fontFamily: theme.fonts.heading,
    fontSize: 26,
    textAlign: 'center',
    marginTop: 10,
  },
  subtitle: {
    color: colors.mutedForeground,
    fontFamily: theme.fonts.body,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  card: {
    marginHorizontal: 20,
    marginTop: 20,
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    gap: 12,
  },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureText: { color: colors.foreground, fontFamily: theme.fonts.body, fontSize: 14, flex: 1 },
  loadingBox: { marginTop: 30, alignItems: 'center' },
  errorText: { color: colors.mutedForeground, fontFamily: theme.fonts.body, fontSize: 13, lineHeight: 19 },
  retryButton: {
    marginTop: 14,
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: colors.primary,
  },
  retryText: { color: colors.primaryForeground, fontFamily: theme.fonts.body, fontWeight: '800', fontSize: 13 },
  packagesWrap: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, marginTop: 22 },
  packageCard: {
    flex: 1,
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
  },
  packageCardHighlight: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  savingsBadge: {
    position: 'absolute',
    top: -11,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  savingsText: { color: colors.primaryForeground, fontFamily: theme.fonts.body, fontSize: 9, fontWeight: '800' },
  packageLabel: {
    color: colors.foreground,
    fontFamily: theme.fonts.heading,
    fontSize: 18,
    marginTop: 6,
  },
  packagePrice: {
    color: colors.foreground,
    fontFamily: theme.fonts.heading,
    fontSize: 24,
    marginTop: 8,
  },
  packageCaption: {
    color: colors.mutedForeground,
    fontFamily: theme.fonts.body,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
  },
  packageButton: {
    marginTop: 16,
    width: '100%',
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  packageButtonText: { color: colors.primaryForeground, fontFamily: theme.fonts.body, fontWeight: '800', fontSize: 13 },
  packageSpinner: { marginTop: 16 },
  restoreButton: { marginTop: 22, alignItems: 'center', paddingVertical: 8 },
  restoreText: { color: colors.primary, fontFamily: theme.fonts.body, fontSize: 13, fontWeight: '700' },
  legalNote: {
    marginTop: 18,
    marginHorizontal: 24,
    color: colors.mutedForeground,
    fontFamily: theme.fonts.body,
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
  },
  legalLink: { color: colors.primary, fontWeight: '700' },
  bottomLinksRow: {
    marginTop: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
  },
  logoutLink: { alignItems: 'center', paddingVertical: 8 },
  logoutLinkText: { color: colors.mutedForeground, fontFamily: theme.fonts.body, fontSize: 12 },
  deleteLinkText: { color: colors.destructive, fontFamily: theme.fonts.body, fontSize: 12 },
});
