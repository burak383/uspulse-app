// Eşleştikten hemen sonra gösterilen zorunlu avatar seçim ekranı (bkz.
// navigation/RootNavigator.tsx -- partner var ama user.avatarUrl yoksa TEK
// ekran olarak bu gösteriliyor, tıpkı Paywall gibi). Aynı ekran, avatarı
// zaten olan kullanıcılar için Biz.tsx'teki "Profil fotoğrafını değiştir"
// dokunuşuyla da normal bir stack ekranı olarak açılabiliyor -- ikisi
// arasındaki fark navigation.canGoBack(): geri dönecek bir ekran yoksa
// (ilk kez, zorunlu adım) geri/atla butonu yok ve sadece çıkış yapma
// seçeneği var (ELe.tsx'teki eşleşme ekranıyla aynı mantık); geri dönecek
// bir ekran varsa (düzenleme amaçlı açılmış) normal bir geri oku gösteriyoruz.
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
// bkz. Surus.tsx'teki aynı açıklama -- react-native'in kendi SafeAreaView'ı
// yerine react-native-safe-area-context kullanıyoruz.
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { theme } from '../theme';
import { useAuth } from '../src/context/AuthContext';
import { AvatarView } from '../src/components/AvatarView';
import { AVATAR_PRESETS, AvatarCategory, AvatarPreset, parsePresetAvatar, presetAvatarValue } from '../src/avatars/presets';
import { AvatarPickError, AvatarSource, pickAvatarImage, removeAvatar, uploadAvatarValue } from '../src/media/avatarUpload';
import { RootStackParamList } from '../navigation/types';
import { confirmAsync, alertInfo } from '../src/utils/confirm';

const colors = theme.colors;

type NavProp = NativeStackNavigationProp<RootStackParamList, 'AvatarSecimi'>;

const CATEGORY_LABELS: Record<AvatarCategory, string> = {
  kadin: 'Kadın avatarları',
  erkek: 'Erkek avatarları',
};

export default function AvatarSelectionScreen({ navigation }: { navigation: NavProp }) {
  const { user, refresh, logout, requestTabRedirect, clearPendingTabRedirect } = useAuth();
  const [busy, setBusy] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const canGoBack = navigation.canGoBack();
  // Seçim yapılır yapılmaz refresh() çağırıp user.avatarUrl'i doldurursak,
  // RootNavigator'daki needsAvatar hemen false olur ve bu ekran (ilk kurulum
  // akışında) kullanıcı "Tamamlandı"ya dokunmadan kendiliğinden Yuva'ya
  // geçer -- bu yüzden seçim, onaylanana kadar SADECE yerel state'te
  // (pendingValue) tutuluyor; sunucuya hemen kaydediliyor ama AuthContext'e
  // (ve dolayısıyla RootNavigator'ın koşuluna) "Tamamlandı"ya basılana kadar
  // yansımıyor.
  const [pendingValue, setPendingValue] = useState<string | null>(null);
  const previewValue = pendingValue ?? user?.avatarUrl ?? null;
  const currentPreset = parsePresetAvatar(previewValue);
  const hasCustomPhoto = Boolean(previewValue) && !currentPreset;

  const choosePreset = async (preset: AvatarPreset) => {
    if (busy) return;
    setBusy(true);
    try {
      const value = presetAvatarValue(preset);
      await uploadAvatarValue(value);
      setPendingValue(value);
    } catch {
      alertInfo('Kaydedilemedi', 'Avatar seçilirken bir sorun oluştu. Lütfen tekrar dene.');
    } finally {
      setBusy(false);
    }
  };

  const pickFromDevice = async (source: AvatarSource) => {
    if (busy) return;
    setBusy(true);
    try {
      const image = await pickAvatarImage(source);
      if (!image) return; // kullanıcı iptal etti
      await uploadAvatarValue(image);
      setPendingValue(image);
    } catch (e) {
      alertInfo(
        source === 'camera' ? 'Fotoğraf çekilemedi' : 'Fotoğraf yüklenemedi',
        e instanceof AvatarPickError ? e.message : 'Lütfen tekrar dene.',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleRemovePhoto = async () => {
    const confirmed = await confirmAsync(
      'Fotoğrafı kaldır',
      'Profil fotoğrafını kaldırmak istediğine emin misin?',
      'Kaldır',
    );
    if (!confirmed || busy) return;
    setBusy(true);
    try {
      await removeAvatar();
      setPendingValue(null);
      await refresh();
    } catch {
      alertInfo('Kaldırılamadı', 'Lütfen tekrar dene.');
    } finally {
      setBusy(false);
    }
  };

  // "Tamamlandı": seçim zaten sunucuya kaydedilmişti (yukarıdaki
  // choosePreset/pickFromDevice) -- burada sadece AuthContext'i tazeleyip
  // Biz sekmesine yönlendiriyoruz.
  //
  // Düzenleme modunda (canGoBack true -- kullanıcının zaten bir avatarı
  // vardı, needsAvatar zaten false, refresh() bu ekranın kayıtlı kalıp
  // kalmayacağını etkilemiyor) doğrudan navigate() güvenli.
  //
  // İlk kurulum akışında (canGoBack false) ise refresh(), user.avatarUrl'i
  // doldurup RootNavigator'daki needsAvatar'ı false yapar -- bu da
  // Stack.Navigator'ın ekran listesini TEK ekranlı ("AvatarSecimi") halden
  // tam listeye (ilk ekranı Yuva) değiştirir ve bu ekran hemen unmount
  // olur. Bu noktada navigation.navigate('Biz') çağırmak, React'in bu
  // koşul değişikliğini işleyip Yuva'yı monte etmesiyle yarışır -- 'Biz'
  // henüz kayıtlı ekran listesinde olmayabilir ve navigate sessizce hiçbir
  // şey yapmaz (bkz. AuthContext.tsx pendingTabRedirect açıklaması).
  // Bunun yerine hedefi orada bırakıp Yuva'nın (kesin olarak monte olacak
  // ilk ekran) kendisinin yönlendirmesini istiyoruz.
  const handleFinish = async () => {
    if (busy || !previewValue) return;
    const isFirstTime = !canGoBack;
    if (isFirstTime) requestTabRedirect('Biz');
    setBusy(true);
    try {
      await refresh();
      if (canGoBack) navigation.navigate('Biz');
    } catch {
      // refresh() ağ hatası/geçici sunucu hatası (ör. Render'ın ücretsiz
      // planındaki soğuk başlama gecikmesi) yüzünden başarısız olabilir --
      // bunu SESSİZCE yutmak, kullanıcıya "tuş tepki vermiyor" gibi
      // görünüyordu (spinner kaybolur, hiçbir şey olmaz, hata da yok).
      // Bunun yerine açıkça bildirip tekrar denemesini istiyoruz; ilk
      // kurulum akışındaysak, başarısız denemenin bekleyen yönlendirmeyi
      // (pendingTabRedirect) kalıcı olarak ayarlı bırakmaması için de
      // temizliyoruz -- aksi halde kullanıcı daha sonra farklı bir
      // yoldan Yuva'ya düşerse beklenmedik şekilde Biz'e yönlendirilebilirdi.
      if (isFirstTime) clearPendingTabRedirect();
      alertInfo('Tamamlanamadı', 'Bir bağlantı sorunu oluştu. Lütfen tekrar dene.');
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = () => {
    if (loggingOut) return;
    setLoggingOut(true);
    logout().catch(() => {}).finally(() => setLoggingOut(false));
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Durum çubuğu App.tsx'te genel olarak (expo-status-bar, style="light")
          ayarlanıyor -- burada ayrıca react-native'in kendi StatusBar'ını
          backgroundColor ile ayarlamak, Android'de bu ekranla diğerleri
          arasında durum çubuğunun rengi/şeffaflığı farklı görünmesine yol
          açıyordu (bkz. sayfalar arası renk farklılığı düzeltmesi). */}
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          {canGoBack ? (
            <Pressable accessibilityLabel="Geri dön" style={styles.circleButton} onPress={() => navigation.goBack()}>
              <MaterialCommunityIcons name="arrow-left" size={20} color={colors.foreground} />
            </Pressable>
          ) : (
            <Pressable
              accessibilityLabel="Çıkış yap"
              style={styles.circleButton}
              onPress={handleLogout}
              disabled={loggingOut}
            >
              {loggingOut ? (
                <ActivityIndicator size="small" color={colors.foreground} />
              ) : (
                <MaterialCommunityIcons name="logout" size={18} color={colors.foreground} />
              )}
            </Pressable>
          )}
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.previewWrap}>
          <View style={styles.previewCircle}>
            {busy ? (
              <ActivityIndicator color={colors.mutedForeground} />
            ) : (
              <AvatarView avatarUrl={previewValue} size={92} />
            )}
          </View>
          <Text style={styles.title}>
            {canGoBack ? 'Avatarını değiştir' : 'Sana nasıl görünelim?'}
          </Text>
          <Text style={styles.subtitle}>
            {canGoBack
              ? 'Hazır avatarlardan birini seç ya da kendi fotoğrafını yükle.'
              : 'Eşleştiniz! Şimdi partnerine nasıl görüneceğini seç -- hazır bir avatar seçebilir ya da kendi fotoğrafını yükleyebilirsin.'}
          </Text>
        </View>

        <View style={styles.uploadRow}>
          <Pressable
            style={styles.uploadButton}
            onPress={() => pickFromDevice('camera')}
            disabled={busy}
            accessibilityLabel="Kameradan çek"
          >
            <MaterialCommunityIcons name="camera-outline" size={20} color={colors.primaryForeground} />
            <Text style={styles.uploadButtonText}>Kameradan çek</Text>
          </Pressable>
          <Pressable
            style={[styles.uploadButton, styles.uploadButtonSecondary]}
            onPress={() => pickFromDevice('library')}
            disabled={busy}
            accessibilityLabel="Galeriden seç"
          >
            <MaterialCommunityIcons name="image-multiple-outline" size={20} color={colors.foreground} />
            <Text style={[styles.uploadButtonText, styles.uploadButtonTextSecondary]}>Galeriden seç</Text>
          </Pressable>
        </View>

        {hasCustomPhoto && (
          <Pressable style={styles.removeRow} onPress={handleRemovePhoto} disabled={busy}>
            <MaterialCommunityIcons name="trash-can-outline" size={16} color={colors.destructive} />
            <Text style={styles.removeRowText}>Fotoğrafı kaldır</Text>
          </Pressable>
        )}

        <View style={styles.divider} />

        {(['kadin', 'erkek'] as AvatarCategory[]).map((category) => (
          <View key={category} style={styles.categorySection}>
            <Text style={styles.categoryLabel}>{CATEGORY_LABELS[category]}</Text>
            <View style={styles.grid}>
              {AVATAR_PRESETS[category].map((preset) => {
                const selected = currentPreset?.category === preset.category && currentPreset?.icon === preset.icon;
                return (
                  <Pressable
                    key={`${preset.category}-${preset.icon}`}
                    style={[styles.presetTile, selected && styles.presetTileSelected]}
                    onPress={() => choosePreset(preset)}
                    disabled={busy}
                    accessibilityLabel="Hazır avatar seç"
                  >
                    <AvatarView avatarUrl={presetAvatarValue(preset)} size={56} />
                    {selected && (
                      <View style={styles.selectedBadge}>
                        <MaterialCommunityIcons name="check" size={12} color={colors.primaryForeground} />
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}

        {previewValue && (
          <Pressable
            style={[styles.finishButton, busy && styles.finishButtonDisabled]}
            onPress={handleFinish}
            disabled={busy}
            accessibilityLabel="Tamamlandı"
          >
            {busy ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Text style={styles.finishButtonText}>Tamamlandı</Text>
            )}
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 4,
  },
  circleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  previewWrap: { alignItems: 'center', paddingVertical: 16, gap: 6 },
  previewCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: colors.border,
    backgroundColor: colors.input,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 8,
  },
  title: { fontFamily: theme.fonts.heading, fontSize: 21, color: colors.foreground, textAlign: 'center' },
  subtitle: {
    fontFamily: theme.fonts.body,
    fontSize: 13,
    color: colors.mutedForeground,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 8,
  },
  uploadRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  uploadButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 16,
    backgroundColor: colors.primary,
  },
  uploadButtonSecondary: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  uploadButtonText: { fontFamily: theme.fonts.body, fontSize: 13, fontWeight: '700', color: colors.primaryForeground },
  uploadButtonTextSecondary: { color: colors.foreground },
  removeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 14,
    paddingVertical: 8,
  },
  removeRowText: { fontFamily: theme.fonts.body, fontSize: 13, color: colors.destructive },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 22 },
  categorySection: { marginBottom: 20 },
  categoryLabel: { fontFamily: theme.fonts.heading, fontSize: 15, color: colors.foreground, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  presetTile: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  presetTileSelected: { borderColor: colors.primary },
  finishButton: {
    marginTop: 24,
    paddingVertical: 15,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finishButtonDisabled: { opacity: 0.7 },
  finishButtonText: { fontFamily: theme.fonts.body, fontSize: 15, fontWeight: '700', color: colors.primaryForeground },
  selectedBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.background,
  },
});
