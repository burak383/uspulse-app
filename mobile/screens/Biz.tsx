import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Clipboard from 'expo-clipboard';
import Purchases from 'react-native-purchases';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { theme } from '../theme';
import { useAuth } from '../src/context/AuthContext';
import { isRevenueCatConfigured } from '../src/subscriptions/purchases';
import { api, API_URL } from '../src/api/client';
import { Memory, MoodResponse, TouchesResponse } from '../src/api/types';
import { RootStackParamList, TabRouteName } from '../navigation/types';

const colors = theme.colors;

// Yasal sayfalar (Gizlilik/Koşullar/Çocuk Güvenliği Standartları) sunucuda
// kök dizinde barındırılıyor (bkz. server/src/routes/legal.ts) -- API_URL
// ".../api" ile bittiği için buradan çıkarıyoruz (Paywall.tsx'teki aynı
// yardımcıyla birebir aynı mantık).
const LEGAL_BASE_URL = API_URL.replace(/\/api\/?$/, '');

// Play Store'un "çocuk güvenliği" politikası, kullanıcıların bu tür
// endişelerini UYGULAMA İÇİNDEN bildirebileceği bir yol istiyor -- aşağıdaki
// "Bir sorun bildir" satırı bu amaçla var (bkz. handleReportConcern).
// Google'ın kendi rehberi e-posta/form üzerinden bildirimi yeterli kabul
// ediyor, tek şart uygulamadan ayrılmadan (bir menüden) erişilebilir olması.
const SUPPORT_EMAIL = process.env.EXPO_PUBLIC_SUPPORT_EMAIL || 'seolen8@gmail.com';

// bkz. ELe.tsx'teki aynı yardımcı: RoundIcon'un arka planı, ikonun kendi
// rengiyle aynı katı tonda değil, o rengin soluk (alfa'lı) bir versiyonu
// olmalı -- aksi halde ikon glifi kendi arka planıyla aynı renkte olduğu
// için görünmez olur (bu ekrandaki TÜM RoundIcon kullanımlarını, "Hesabımı
// sil"/"Çıkış yap" dahil, etkileyen bir hataydı).
const alpha = (color: string, opacity: number) =>
  `${color}${Math.round(opacity * 255)
    .toString(16)
    .padStart(2, '0')}`;

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

function Icon({
  name,
  size = 20,
  color = colors.foreground,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  return <MaterialCommunityIcons name={name} size={size} color={color} />;
}

function RoundIcon({
  name,
  color,
  backgroundColor,
  size = 20,
}: {
  name: IconName;
  color: string;
  backgroundColor: string;
  size?: number;
}) {
  // Her çağıran yer backgroundColor'ı ikonla AYNI katı rengi veriyor
  // (ör. backgroundColor={iconColor} color={iconColor}) -- bunu doğrudan
  // arka plan yapmak ikonu kendi arka planında görünmez kılardı. Bunun
  // yerine soluk (alfa'lı) bir daire üstünde katı renkli bir ikon gösteriyoruz.
  return (
    <View style={[styles.roundIcon, { backgroundColor: alpha(backgroundColor, 0.15) }]}>
      <Icon name={name} size={size} color={color} />
    </View>
  );
}

function StatCard({
  icon,
  iconColor,
  value,
  label,
  status,
  gradient,
}: {
  icon: IconName;
  iconColor: string;
  value: string;
  label: string;
  status: string;
  gradient?: boolean;
}) {
  const content = (
    <>
      <View style={styles.statHeader}>
        <RoundIcon name={icon} color={iconColor} backgroundColor={iconColor} size={18} />
        <Text style={[styles.statStatus, { color: iconColor }]}>{status}</Text>
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.caption}>{label}</Text>
    </>
  );

  return gradient ? (
    <LinearGradient colors={[colors.input, colors.card]} style={styles.statCard}>
      {content}
    </LinearGradient>
  ) : (
    <View style={styles.statCard}>{content}</View>
  );
}

function PrivacyRow({
  icon,
  label,
  color,
  value,
  active = true,
  onPress,
  loading = false,
}: {
  icon: IconName;
  label: string;
  color: string;
  value: string;
  active?: boolean;
  onPress?: () => void;
  loading?: boolean;
}) {
  const toggleColor = active ? colors.success : colors.mutedForeground;
  return (
    <Pressable
      style={styles.privacyRow}
      onPress={onPress}
      disabled={!onPress || loading}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? `${label}: ${value}, değiştirmek için dokun` : undefined}
    >
      <View style={styles.rowLabel}>
        <Icon name={icon} size={19} color={color} />
        <Text style={styles.bodyText}>{label}</Text>
      </View>
      <View style={styles.rowValue}>
        {loading ? (
          <ActivityIndicator size="small" color={toggleColor} />
        ) : (
          <>
            <Text style={[styles.smallBold, { color: toggleColor }]}>{value}</Text>
            <Icon name={active ? 'toggle-switch' : 'toggle-switch-off-outline'} size={24} color={toggleColor} />
          </>
        )}
      </View>
    </Pressable>
  );
}

// PrivacyRow bir açma/kapama satırı (toggle-switch ikonu); bu ise düz bir
// gezinme/bağlantı satırı olduğu için sağda toggle yerine ok (chevron)
// gösteren ayrı, daha basit bir bileşen -- aynı satır görünümünü (privacyRow/
// rowLabel stilleri) paylaşıyor ki "Yardım ve Güvenlik" kartı, hemen
// üstündeki "Gizliliğiniz sizin elinizde" kartıyla görsel olarak tutarlı olsun.
function LinkRow({
  icon,
  label,
  color,
  onPress,
}: {
  icon: IconName;
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={styles.privacyRow}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={styles.rowLabel}>
        <Icon name={icon} size={19} color={color} />
        <Text style={styles.bodyText}>{label}</Text>
      </View>
      <Icon name="chevron-right" size={20} color={colors.mutedForeground} />
    </Pressable>
  );
}

function daysSince(dateStr?: string | null) {
  if (!dateStr) return 0;
  // Sunucu created_at'i SQLite datetime('now') ile UTC olarak üretiyor,
  // ancak "Z" son eki olmadan (bkz. server/src/db.ts) -- bu yüzden yalnızca
  // boşluğu "T" yapmak yeterli değil, JS'in bunu YEREL saat sanmasını
  // önlemek için sona "Z" de eklememiz gerekiyor. Aksi halde UTC'den uzak
  // dilimlerdeki (ör. TRT +3) kullanıcılarda bu sayaç yanlış (özellikle gece
  // yarısına yakın off-by-one) çıkıyordu.
  const isoLike = dateStr.includes('T') ? dateStr : `${dateStr.replace(' ', 'T')}Z`;
  const start = new Date(isoLike);
  const diff = Date.now() - start.getTime();
  return Math.max(0, Math.floor(diff / 86400000));
}

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function TogetherScreen({ navigation }: { navigation: NavProp }) {
  const {
    user,
    partner,
    couple,
    logout,
    deleteAccount,
    entitlement,
    distanceKm,
    locationSharedByMe,
    locationSharedByPartner,
    locationSubmitting,
    shareLocationNow,
    stopSharingLocation,
    backgroundLocationEnabled,
    hapticsEnabled,
    setHapticsEnabled,
    refresh,
  } = useAuth();
  const [touches, setTouches] = useState<TouchesResponse | null>(null);
  const [lockedMemories, setLockedMemories] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [hapticsSubmitting, setHapticsSubmitting] = useState(false);
  const [mood, setMood] = useState<MoodResponse | null>(null);
  const [moodSubmitting, setMoodSubmitting] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const pickAndUploadAvatar = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Fotoğraf izni gerekli',
          'Profil fotoğrafı seçebilmek için Ayarlar\'dan UsPulse\'a fotoğraf erişimi vermelisin.',
        );
        return;
      }
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (picked.canceled || !picked.assets?.[0]) return;

      setAvatarUploading(true);
      // 512x512'ye küçült + sıkıştır: telefon kamerasından gelen orijinal
      // fotoğraf birkaç MB olabilir, avatar için buna hiç gerek yok --
      // hem yükleme hızlı olsun hem de sunucudaki (SQLite) kayıt küçük kalsın.
      const manipulated = await ImageManipulator.manipulateAsync(
        picked.assets[0].uri,
        [{ resize: { width: 512, height: 512 } }],
        { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true },
      );
      if (!manipulated.base64) {
        throw new Error('Fotoğraf işlenemedi.');
      }
      await api.put('/me/avatar', { image: `data:image/jpeg;base64,${manipulated.base64}` });
      await refresh();
    } catch (e) {
      Alert.alert('Fotoğraf yüklenemedi', e instanceof Error ? e.message : 'Lütfen tekrar dene.');
    } finally {
      setAvatarUploading(false);
    }
  };

  const removeAvatar = () => {
    setAvatarUploading(true);
    api
      .delete('/me/avatar')
      .then(() => refresh())
      .catch(() => {
        Alert.alert('Kaldırılamadı', 'Lütfen tekrar dene.');
      })
      .finally(() => setAvatarUploading(false));
  };

  const onAvatarPress = () => {
    const options: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[] = [
      { text: 'Fotoğraf seç', onPress: pickAndUploadAvatar },
    ];
    if (user?.avatarUrl) {
      options.push({ text: 'Fotoğrafı kaldır', style: 'destructive', onPress: removeAvatar });
    }
    options.push({ text: 'Vazgeç', style: 'cancel' });
    Alert.alert('Profil fotoğrafı', undefined, options);
  };

  const toggleHaptics = () => {
    setHapticsSubmitting(true);
    setHapticsEnabled(!hapticsEnabled)
      .catch(() => {
        Alert.alert('Değiştirilemedi', 'Lütfen tekrar dene.');
      })
      .finally(() => setHapticsSubmitting(false));
  };

  const toggleMoodSharing = async () => {
    if (!mood) return;
    const next = !mood.sharedByMe;
    setMoodSubmitting(true);
    try {
      await api.put('/mood/sharing', { shared: next });
      setMood((prev) => (prev ? { ...prev, sharedByMe: next } : prev));
    } catch {
      Alert.alert('Değiştirilemedi', 'Lütfen tekrar dene.');
    } finally {
      setMoodSubmitting(false);
    }
  };

  const toggleLocationSharing = () => {
    if (locationSharedByMe) {
      Alert.alert(
        'Konum paylaşımını kapat',
        'Kapatırsan aranızdaki mesafe artık gösterilmez ve arka plan konum takibi durur. Partnerinin konumu bu uygulamada zaten hiçbir zaman görünmüyor, sadece hesaplanan mesafe gösteriliyordu.',
        [
          { text: 'Vazgeç', style: 'cancel' },
          {
            text: 'Kapat',
            style: 'destructive',
            onPress: () => {
              stopSharingLocation().catch(() => {
                Alert.alert('Konum paylaşımı kapatılamadı', 'Lütfen tekrar dene.');
              });
            },
          },
        ],
      );
      return;
    }
    // Açarken doğrudan art arda iki native izin diyaloğu (önce ön plan,
    // hemen ardından "Her Zaman İzin Ver") tetiklenmeden ÖNCE ne için
    // istendiğini açıklıyoruz -- bağlamsız art arda konum izni istekleri
    // App Store/Play Store incelemesinde sık karşılaşılan bir ret nedeni.
    Alert.alert(
      'Konum paylaşımını aç',
      'Aranızdaki yaklaşık mesafeyi göstermek için önce konum iznini, ardından uygulama kapalıyken de mesafeyi güncel tutabilmek için "Her Zaman İzin Ver" iznini isteyeceğiz. Kesin konumun partnerine hiçbir zaman gösterilmez, sadece hesaplanan mesafe paylaşılır.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Devam et',
          onPress: () => {
            shareLocationNow().catch((e) => {
              Alert.alert('Konum paylaşılamadı', e instanceof Error ? e.message : 'Lütfen tekrar dene.');
            });
          },
        },
      ],
    );
  };

  const confirmDeleteAccount = () => {
    Alert.alert(
      'Hesabını sil',
      'Bu işlem geri alınamaz: hesabın, ruh hâli/dokunuş geçmişin, yazdığın anılar ve eklediğin plan/birikim katkıların kalıcı olarak silinir. Partnerinin hesabı etkilenmez.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Hesabımı sil',
          style: 'destructive',
          onPress: () => {
            setDeleting(true);
            deleteAccount()
              .catch(() => {
                Alert.alert('Hesap silinemedi', 'Lütfen tekrar dene.');
              })
              .finally(() => setDeleting(false));
          },
        },
      ],
    );
  };

  const openLegalPage = (path: string) => {
    Linking.openURL(`${LEGAL_BASE_URL}${path}`).catch(() => {
      Alert.alert('Açılamadı', 'Sayfa açılırken bir sorun oluştu. Lütfen tekrar dene.');
    });
  };

  // Google Play'in çocuk güvenliği politikası, kullanıcıların bu tür
  // endişelerini uygulamadan ayrılmadan bildirebileceği bir yol istiyor.
  // E-posta istemcisini konu/gövde önceden doldurulmuş şekilde açmak bu
  // şartı karşılıyor -- ayrıntı için Biz.tsx başındaki SUPPORT_EMAIL notuna
  // bkz.
  const handleReportConcern = () => {
    const subject = encodeURIComponent('Çocuk Güvenliği Bildirimi');
    const body = encodeURIComponent(
      `Merhaba,\n\nBir çocuk güvenliği endişesini ya da uygulama içi başka bir sorunu bildirmek istiyorum.\n\nAyrıntılar:\n(Lütfen ilgili hesabı/kullanıcıyı ve durumu buraya yazın)\n\nHesap e-postam: ${user?.email ?? ''}`,
    );
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`).catch(() => {
      Alert.alert(
        'E-posta uygulaması açılamadı',
        `Lütfen doğrudan ${SUPPORT_EMAIL} adresine yazarak bildir.`,
      );
    });
  };

  const load = useCallback(async () => {
    try {
      const [touchesRes, memoriesRes, moodRes] = await Promise.all([
        api.get<TouchesResponse>('/touches'),
        api.get<Memory[]>('/memories'),
        api.get<MoodResponse>('/mood'),
      ]);
      setTouches(touchesRes);
      setLockedMemories(memoriesRes.filter((m) => m.type === 'capsule').length);
      setMood(moodRes);
    } catch {
      // best-effort refresh
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const goTab = (route: TabRouteName) => navigation.navigate(route);

  const shareInvite = async () => {
    if (!user?.inviteCode) return;
    try {
      await Share.share({
        message: `UsPulse'deki alanıma yeniden bağlanmak için davet kodum: ${user.inviteCode}`,
      });
    } catch {
      // sharing cancelled
    }
  };

  const copyInviteCode = async () => {
    if (!user?.inviteCode) return;
    try {
      await Clipboard.setStringAsync(user.inviteCode);
      Alert.alert('Kopyalandı', 'Davet kodun panoya kopyalandı.');
    } catch {
      Alert.alert('Kopyalanamadı', 'Lütfen tekrar dene.');
    }
  };

  const handleLogout = () => {
    if (loggingOut) return;
    setLoggingOut(true);
    logout()
      .catch(() => {
        Alert.alert('Çıkış yapılamadı', 'Lütfen tekrar dene.');
      })
      .finally(() => setLoggingOut(false));
  };

  const openManageSubscription = async () => {
    if (!isRevenueCatConfigured()) {
      Alert.alert('Kullanılamıyor', 'Abonelik yönetimi şu anda kullanılamıyor.');
      return;
    }
    try {
      await Purchases.showManageSubscriptions();
    } catch {
      Alert.alert('Açılamadı', 'Abonelik yönetim ekranı açılamadı. Cihazının mağaza uygulamasından da yönetebilirsin.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={[colors.card, colors.background, colors.background]}
          style={styles.header}
        >
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.eyebrow}>BİZİM ALANIMIZ</Text>
              <Text style={styles.mainTitle}>
                {user?.name ?? '—'} + {partner?.name ?? '—'}
              </Text>
              <Text style={styles.subtitle}>Birlikte kurduğunuz küçük dünya.</Text>
            </View>
            <Pressable
              accessibilityLabel="Çıkış yap"
              style={styles.settingsButton}
              onPress={handleLogout}
              disabled={loggingOut}
            >
              <Icon name="logout" size={22} color={colors.cardForeground} />
            </Pressable>
          </View>

          <View style={styles.relationshipCard}>
            <View style={styles.avatarStack}>
              <Pressable
                accessibilityLabel="Profil fotoğrafını değiştir"
                style={[styles.avatar, styles.elifAvatar]}
                onPress={onAvatarPress}
                disabled={avatarUploading}
              >
                {avatarUploading ? (
                  <ActivityIndicator color={colors.mutedForeground} />
                ) : user?.avatarUrl ? (
                  <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} />
                ) : (
                  <Icon name="account" size={32} color={colors.mutedForeground} />
                )}
                <View style={styles.avatarEditBadge}>
                  <Icon name="camera" size={13} color={colors.primaryForeground} />
                </View>
              </Pressable>
              <View style={[styles.avatar, styles.denizAvatar]}>
                {partner?.avatarUrl ? (
                  <Image source={{ uri: partner.avatarUrl }} style={styles.avatarImage} />
                ) : (
                  <Icon name="account" size={32} color={colors.mutedForeground} />
                )}
              </View>
              <View style={styles.heartBadge}>
                <Icon name="hand-heart" size={20} color={colors.primaryForeground} />
              </View>
            </View>
            <Text style={styles.days}>{daysSince(couple?.created_at)} gün</Text>
            <Text style={styles.subtitle}>Eşleştiğinizden beri</Text>
            <View style={styles.safeStatus}>
              <View style={styles.statusDot} />
              <Text style={styles.caption}>İkinizin alanı güvende</Text>
            </View>
          </View>
        </LinearGradient>

        {entitlement && (
          <View style={styles.card}>
            <View style={styles.contentRow}>
              <RoundIcon
                name={entitlement.subscriptionActive ? 'crown' : 'clock-outline'}
                color={entitlement.subscriptionActive ? colors.accent : colors.primary}
                backgroundColor={entitlement.subscriptionActive ? colors.accent : colors.primary}
                size={21}
              />
              <View style={styles.flex}>
                <Text style={styles.eyebrow}>ABONELİK</Text>
                <Text style={styles.cardTitle}>
                  {entitlement.subscriptionActive
                    ? 'Abonesin'
                    : entitlement.trialing
                      ? `Deneme süren: ${entitlement.trialDaysLeft} gün kaldı`
                      : 'Deneme süren doldu'}
                </Text>
                <Text style={styles.caption}>
                  {entitlement.subscriptionActive
                    ? 'Sen ya da partnerin abone olduğu için ikiniz de tam erişime sahipsiniz.'
                    : entitlement.trialing
                      ? 'Ücretsiz deneme süren boyunca her şeye erişebilirsin.'
                      : 'Devam etmek için abone olman gerekiyor.'}
                </Text>
              </View>
            </View>
            {entitlement.subscriptionActive && (
              <Pressable style={styles.manageSubButton} onPress={openManageSubscription}>
                <Text style={styles.manageSubText}>Aboneliği yönet</Text>
              </Pressable>
            )}
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.eyebrow}>BAĞINIZ</Text>
              <Text style={styles.sectionTitle}>Her gün biraz daha siz.</Text>
            </View>
            <Icon name="creation" size={22} color={colors.accent} />
          </View>

          <View style={styles.statsGrid}>
            <StatCard
              icon="sprout"
              iconColor={colors.success}
              value={String(touches?.streakDays ?? 0)}
              label="günlük yakınlık serisi"
              status="SÜRÜYOR"
            />
            <StatCard
              icon="radio"
              iconColor={colors.primary}
              value={String(touches?.totalCount ?? 0)}
              label="canlı dokunuş"
              status="TOPLAM"
            />
            <StatCard
              icon="lock-outline"
              iconColor={colors.accent}
              value={String(lockedMemories)}
              label="kilitli anı"
              status="SAKLI"
            />
            <StatCard
              icon="calendar-heart"
              iconColor={colors.primary}
              value={couple?.reunion_date ?? '—'}
              label="bir sonraki buluşma"
              status="YAKINDA"
              gradient
            />
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.contentRow}>
            <RoundIcon name="link-variant" color={colors.primary} backgroundColor={colors.primary} size={21} />
            <View style={styles.flex}>
              <Text style={styles.eyebrow}>CİHAZINI YENİDEN BAĞLA</Text>
              <Text style={styles.cardTitle}>Davetini paylaş</Text>
              <Text style={styles.caption}>
                Bu özel bağlantı yalnızca {user?.name ?? 'senin'} alanına yeniden bağlanmak için.
                Başka bir partner davet etmez.
              </Text>
            </View>
          </View>

          <View style={styles.shareRow}>
            <Pressable style={styles.shareButton} onPress={shareInvite}>
              <Icon name="whatsapp" size={17} color={colors.success} />
              <Text style={styles.shareText}>WhatsApp</Text>
            </Pressable>
            <Pressable style={styles.shareButton} onPress={shareInvite}>
              <Icon name="message-text-outline" size={17} color={colors.primary} />
              <Text style={styles.shareText}>SMS</Text>
            </Pressable>
          </View>

          <View style={styles.qrRow}>
            <View style={styles.qrBox}>
              <Icon name="qrcode" size={42} color={colors.foreground} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.bodyBold}>{user?.name ?? 'Senin'} eşleşme kodun</Text>
              <Text style={styles.caption}>{user?.inviteCode ?? '------'}</Text>
            </View>
            <Pressable accessibilityLabel="Davet kodunu kopyala" style={styles.copyButton} onPress={copyInviteCode}>
              <Icon name="content-copy" size={16} color={colors.primary} />
            </Pressable>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.contentRow}>
            <RoundIcon name="shield-check-outline" color={colors.success} backgroundColor={colors.success} size={21} />
            <View>
              <Text style={styles.cardTitle}>Gizliliğiniz sizin elinizde</Text>
              <Text style={styles.caption}>Yakınlık, sınırlarınızla güzel.</Text>
            </View>
          </View>

          <View style={styles.notice}>
            <Icon name="map-marker-off-outline" size={17} color={colors.success} />
            <Text style={styles.caption}>
              <Text style={styles.successBold}>Kesin konumunuz asla gösterilmez. </Text>
              Yalnızca aranızdaki yaklaşık mesafe paylaşılır.
            </Text>
          </View>

          {locationSharedByMe && (
            <View style={styles.distanceCard}>
              <RoundIcon name="map-marker-distance" color={colors.primary} backgroundColor={colors.primary} size={19} />
              <View style={styles.flex}>
                {locationSharedByPartner && distanceKm != null ? (
                  <>
                    <Text style={styles.distanceValue}>~{distanceKm} km</Text>
                    <Text style={styles.caption}>{partner?.name ?? 'Partnerin'} ile aranızdaki mesafe</Text>
                  </>
                ) : (
                  <Text style={styles.caption}>
                    {partner ? `${partner.name} henüz konum paylaşmadı.` : 'Mesafe için partnerinin de paylaşması gerekiyor.'}
                  </Text>
                )}
              </View>
            </View>
          )}

          {locationSharedByMe && (
            <View style={styles.trackingRow}>
              <Icon name="radar" size={15} color={backgroundLocationEnabled ? colors.success : colors.mutedForeground} />
              {backgroundLocationEnabled ? (
                <Text style={styles.trackingText}>
                  Arka planda da takip ediliyor -- uygulama kapalıyken bile mesafe güncel kalır.
                </Text>
              ) : (
                <View style={styles.flex}>
                  <Text style={styles.trackingText}>
                    Arka plan takibi kapalı -- mesafe yalnızca uygulamayı her açtığında güncellenir.
                  </Text>
                  <Pressable onPress={() => Linking.openSettings()}>
                    <Text style={styles.trackingLink}>
                      Açmak için Ayarlar'dan konum iznini "Her Zaman İzin Ver" yap
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}

          <View style={styles.privacyList}>
            <PrivacyRow
              icon="map-marker-radius-outline"
              label="Konum (yaklaşık mesafe için)"
              color={colors.primary}
              value={locationSharedByMe ? 'Paylaşılıyor' : 'Kapalı'}
              active={locationSharedByMe}
              loading={locationSubmitting}
              onPress={toggleLocationSharing}
            />
            <PrivacyRow
              icon="creation"
              label="Ruh hâli"
              color={colors.accent}
              value={mood?.sharedByMe === false ? 'Kapalı' : 'Paylaşılıyor'}
              active={mood?.sharedByMe !== false}
              loading={moodSubmitting || !mood}
              onPress={toggleMoodSharing}
            />
            <PrivacyRow
              icon="vibrate"
              label="Haptik dokunuşlar"
              color={colors.primary}
              value={hapticsEnabled ? 'Açık' : 'Kapalı'}
              active={hapticsEnabled}
              loading={hapticsSubmitting}
              onPress={toggleHaptics}
            />
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.contentRow}>
            <RoundIcon name="lifebuoy" color={colors.primary} backgroundColor={colors.primary} size={21} />
            <View>
              <Text style={styles.cardTitle}>Yardım ve Güvenlik</Text>
              <Text style={styles.caption}>Bir sorunu bize bildir, sözleşmelerimize göz at.</Text>
            </View>
          </View>

          <View style={styles.privacyList}>
            <LinkRow
              icon="flag-outline"
              label="Bir sorun bildir"
              color={colors.destructive}
              onPress={handleReportConcern}
            />
            <LinkRow
              icon="shield-account-outline"
              label="Çocuk Güvenliği Standartları"
              color={colors.primary}
              onPress={() => openLegalPage('/child-safety-standards')}
            />
            <LinkRow
              icon="lock-outline"
              label="Gizlilik Politikası"
              color={colors.primary}
              onPress={() => openLegalPage('/privacy')}
            />
            <LinkRow
              icon="file-document-outline"
              label="Kullanım Koşulları"
              color={colors.primary}
              onPress={() => openLegalPage('/terms')}
            />
          </View>
        </View>

        <Pressable
          style={[styles.logoutCard, loggingOut && styles.deleteCardDisabled]}
          onPress={handleLogout}
          disabled={loggingOut}
        >
          {loggingOut ? (
            <ActivityIndicator color={colors.destructive} />
          ) : (
            <>
              <RoundIcon name="logout" color={colors.destructive} backgroundColor={colors.destructive} size={19} />
              <Text style={styles.logoutText}>Çıkış yap</Text>
            </>
          )}
        </Pressable>

        <Pressable
          style={[styles.logoutCard, deleting && styles.deleteCardDisabled]}
          onPress={confirmDeleteAccount}
          disabled={deleting}
        >
          {deleting ? (
            <ActivityIndicator color={colors.destructive} />
          ) : (
            <>
              <RoundIcon name="delete-outline" color={colors.destructive} backgroundColor={colors.destructive} size={19} />
              <Text style={styles.logoutText}>Hesabımı sil</Text>
            </>
          )}
        </Pressable>
      </ScrollView>

      <View style={styles.tabBar}>
        {(
          [
            ['home-outline', 'Yuva', 'Yuva'],
            ['calendar-month-outline', 'Planlar', 'Planlar'],
            ['image-multiple-outline', 'Anılar', 'Anilar'],
            ['account-group-outline', 'Biz', 'Biz'],
          ] as [IconName, string, TabRouteName][]
        ).map(([icon, label, route]) => {
          const active = route === 'Biz';
          return (
            <Pressable key={label} style={[styles.tab, active && styles.activeTab]} onPress={() => goTab(route)}>
              <Icon name={icon} size={21} color={active ? colors.primary : colors.mutedForeground} />
              <Text style={[styles.tabLabel, active && { color: colors.primary }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 30,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eyebrow: {
    color: colors.primary,
    fontFamily: theme.fonts.body,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  mainTitle: {
    color: colors.foreground,
    fontFamily: theme.fonts.heading,
    fontSize: 30,
    marginTop: 6,
  },
  sectionTitle: {
    color: colors.foreground,
    fontFamily: theme.fonts.heading,
    fontSize: 25,
    lineHeight: 30,
    marginTop: 3,
  },
  subtitle: {
    color: colors.mutedForeground,
    fontFamily: theme.fonts.body,
    fontSize: 13,
    marginTop: 4,
  },
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  relationshipCard: {
    alignItems: 'center',
    marginTop: 26,
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.card,
  },
  avatarStack: {
    width: 120,
    height: 112,
    position: 'relative',
  },
  avatar: {
    position: 'absolute',
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.input,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 35,
  },
  avatarEditBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.card,
  },
  elifAvatar: {
    left: 0,
    top: 0,
  },
  denizAvatar: {
    right: 0,
    bottom: 0,
  },
  heartBadge: {
    position: 'absolute',
    top: 38,
    left: 42,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  days: {
    color: colors.foreground,
    fontFamily: theme.fonts.heading,
    fontSize: 28,
    marginTop: 12,
  },
  safeStatus: {
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 17,
    paddingTop: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  section: {
    paddingHorizontal: 20,
    marginTop: 25,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 13,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    width: '47.8%',
    minHeight: 142,
    padding: 15,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roundIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.95,
  },
  statStatus: {
    fontFamily: theme.fonts.body,
    fontSize: 10,
    fontWeight: '800',
  },
  statValue: {
    color: colors.foreground,
    fontFamily: theme.fonts.heading,
    fontSize: 26,
    marginTop: 16,
  },
  caption: {
    color: colors.mutedForeground,
    fontFamily: theme.fonts.body,
    fontSize: 12,
    lineHeight: 18,
  },
  card: {
    marginHorizontal: 20,
    marginTop: 24,
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  flex: {
    flex: 1,
  },
  cardTitle: {
    color: colors.foreground,
    fontFamily: theme.fonts.heading,
    fontSize: 21,
    marginTop: 4,
  },
  bodyText: {
    color: colors.foreground,
    fontFamily: theme.fonts.body,
    fontSize: 14,
  },
  bodyBold: {
    color: colors.foreground,
    fontFamily: theme.fonts.body,
    fontSize: 13,
    fontWeight: '800',
  },
  shareRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 20,
  },
  shareButton: {
    flex: 1,
    height: 44,
    borderRadius: 24,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  shareText: {
    color: colors.secondaryForeground,
    fontFamily: theme.fonts.body,
    fontSize: 12,
    fontWeight: '800',
  },
  qrRow: {
    marginTop: 16,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.muted,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  qrBox: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    opacity: 0.9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manageSubButton: {
    marginTop: 16,
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: colors.muted,
  },
  manageSubText: {
    color: colors.foreground,
    fontFamily: theme.fonts.body,
    fontSize: 12,
    fontWeight: '800',
  },
  notice: {
    marginTop: 16,
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.success,
    opacity: 0.9,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  successBold: {
    color: colors.successForeground,
    fontWeight: '800',
  },
  distanceCard: {
    marginTop: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.muted,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  distanceValue: {
    color: colors.foreground,
    fontFamily: theme.fonts.heading,
    fontSize: 20,
  },
  trackingRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  trackingText: {
    flex: 1,
    color: colors.mutedForeground,
    fontFamily: theme.fonts.body,
    fontSize: 11,
    lineHeight: 16,
  },
  trackingLink: {
    marginTop: 4,
    color: colors.primary,
    fontFamily: theme.fonts.body,
    fontSize: 11,
    fontWeight: '800',
  },
  privacyList: {
    marginTop: 10,
  },
  privacyRow: {
    minHeight: 53,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  smallBold: {
    fontFamily: theme.fonts.body,
    fontSize: 11,
    fontWeight: '800',
  },
  logoutCard: {
    marginHorizontal: 20,
    marginTop: 24,
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.destructive,
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  deleteCardDisabled: {
    opacity: 0.6,
  },
  logoutText: {
    color: colors.destructive,
    fontFamily: theme.fonts.body,
    fontSize: 14,
    fontWeight: '800',
  },
  tabBar: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    width: '90%',
    maxWidth: 350,
    paddingHorizontal: 8,
    paddingVertical: 9,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.secondary,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tab: {
    minWidth: 68,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 24,
    alignItems: 'center',
    gap: 3,
  },
  activeTab: {
    backgroundColor: colors.primary,
    opacity: 0.95,
  },
  tabLabel: {
    color: colors.mutedForeground,
    fontFamily: theme.fonts.body,
    fontSize: 10,
    fontWeight: '700',
  },
});
