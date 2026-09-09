import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } from '@react-native-google-signin/google-signin';
import { colors, fonts } from '../theme';
import { useAuth } from '../src/context/AuthContext';

// Google ile giriş: expo-auth-session'ın tarayıcı tabanlı Google sağlayıcısı
// (Google.useAuthRequest) Expo tarafından deprecated ilan edildi ve SDK 53+
// ile birlikte fiilen kırıldı ("Error 400: invalid_request") -- Google,
// "yüklenmiş uygulama" tipi istemciler için genel tarayıcı OAuth akışını
// giderek daha sıkı reddediyor. Bunun yerine artık native
// @react-native-google-signin/google-signin kullanılıyor (yapılandırması
// AuthContext.tsx'te, uygulama açılışında bir kez yapılıyor). GOOGLE_CONFIGURED
// sadece webClientId'ye bakıyor çünkü native SDK'da androidClientId/iosClientId
// JS tarafında VERİLMİYOR -- onlar yerine Google Cloud Console'da paket
// adı + SHA-1 (Android) / bundle ID (iOS) ile kayıtlı olmaları yeterli.
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || undefined;
const GOOGLE_CONFIGURED = Boolean(GOOGLE_WEB_CLIENT_ID);

// New screen (not part of the original FireVibe export): the design only
// shipped a pairing screen (Eşleş / ELe.tsx), with no way to actually create
// an account. This is the minimal login/register gate in front of it so the
// backend's auth can be reached at all.
export default function AuthScreen() {
  const {
    login,
    register,
    loginWithGoogle,
    reconnectWithCode,
    forgotPassword,
    resetPassword,
    error,
    clearError,
  } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);

  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState<'request' | 'reset'>('request');
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);
  const [forgotError, setForgotError] = useState<string | null>(null);

  // "Kodla bağlan": zaten bir hesabın varsa, başka bir cihazda oturum
  // açıkken Biz.tsx > "Davetini paylaş" kartından kendine gönderdiğin davet
  // kodunu buraya girerek -- e-posta/şifreyi hatırlamana gerek kalmadan --
  // aynı hesaba bu cihazdan da giriş yapabilirsin.
  const [reconnectOpen, setReconnectOpen] = useState(false);
  const [reconnectCode, setReconnectCode] = useState('');
  const [reconnectSubmitting, setReconnectSubmitting] = useState(false);
  const [reconnectError, setReconnectError] = useState<string | null>(null);

  const submit = async () => {
    clearError();
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await login(email.trim().toLowerCase(), password);
      } else {
        await register(name.trim(), email.trim().toLowerCase(), password);
      }
    } catch {
      // error is surfaced via context
    } finally {
      setSubmitting(false);
    }
  };

  const handleGooglePress = async () => {
    if (!GOOGLE_CONFIGURED) {
      Alert.alert(
        'Google girişi ayarlanmadı',
        "Bu özelliği açmak için Google Cloud Console'dan bir Web OAuth istemci kimliği oluşturup mobile/.env dosyasındaki EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID değerine, aynı kimliği de server/.env (ya da Render) içindeki GOOGLE_CLIENT_IDS değerine eklemeniz gerekir. Ayrıntılar için README'ye bakın.",
      );
      return;
    }
    setGoogleSubmitting(true);
    try {
      // Android'de Play Hizmetleri kurulu/güncel değilse burada anlamlı bir
      // hata (ya da güncelleme diyaloğu) fırlatır -- iOS'ta bu kontrolün bir
      // karşılığı yok, bu yüzden sadece Android'de çağrılıyor.
      if (Platform.OS === 'android') {
        await GoogleSignin.hasPlayServices();
      }
      const response = await GoogleSignin.signIn();
      if (!isSuccessResponse(response) || !response.data.idToken) {
        throw new Error('Google kimlik jetonu alınamadı.');
      }
      await loginWithGoogle(response.data.idToken);
    } catch (e) {
      if (isErrorWithCode(e)) {
        // Kullanıcı sign-in ekranını kendisi kapattıysa (vazgeçtiyse) ya da
        // bir önceki giriş denemesi hâlâ sürüyorsa sessizce geçiyoruz --
        // bunlar gerçek bir hata değil.
        if (e.code === statusCodes.SIGN_IN_CANCELLED || e.code === statusCodes.IN_PROGRESS) {
          return;
        }
        if (e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
          Alert.alert(
            'Google Play Hizmetleri gerekli',
            'Google ile giriş yapabilmek için cihazında Google Play Hizmetleri kurulu ve güncel olmalı.',
          );
          return;
        }
      }
      // Diğer tüm hatalar (loginWithGoogle'dan gelenler dahil) context'teki
      // error state'i üzerinden zaten ekranda gösteriliyor; burada sadece
      // GoogleSignin'in kendi ürettiği (context'e hiç ulaşmayan) hatalar için
      // ek bir uyarı gösteriyoruz.
      if (!(e instanceof Error) || e.message !== 'Google kimlik jetonu alınamadı.') {
        return;
      }
      Alert.alert('Google ile giriş başarısız oldu.', 'Kimlik jetonu alınamadı.');
    } finally {
      setGoogleSubmitting(false);
    }
  };

  const openForgotPassword = () => {
    clearError();
    setForgotStep('request');
    setForgotEmail(email.trim().toLowerCase());
    setResetCode('');
    setNewPassword('');
    setForgotMessage(null);
    setForgotError(null);
    setForgotOpen(true);
  };

  const closeForgotPassword = () => setForgotOpen(false);

  const openReconnect = () => {
    clearError();
    setReconnectCode('');
    setReconnectError(null);
    setReconnectOpen(true);
  };

  const closeReconnect = () => setReconnectOpen(false);

  const submitReconnect = async () => {
    if (!reconnectCode.trim()) return;
    setReconnectSubmitting(true);
    setReconnectError(null);
    try {
      await reconnectWithCode(reconnectCode.trim());
      setReconnectOpen(false);
    } catch (e) {
      setReconnectError(e instanceof Error ? e.message : 'Bu kodla bağlanılamadı.');
    } finally {
      setReconnectSubmitting(false);
    }
  };

  const submitForgotRequest = async () => {
    if (!forgotEmail.trim()) return;
    setForgotSubmitting(true);
    setForgotError(null);
    try {
      const res = await forgotPassword(forgotEmail.trim().toLowerCase());
      if (res.devCode) {
        setResetCode(res.devCode);
        setForgotMessage(
          `Geliştirme modu: kodun ${res.devCode}. (Bu demo sunucusunda henüz gerçek bir e-posta gönderimi yok, kod bu yüzden burada gösteriliyor.)`,
        );
      } else {
        setForgotMessage('Hesap bulunduysa bir sıfırlama kodu gönderildi.');
      }
      setForgotStep('reset');
    } catch (e) {
      setForgotError(e instanceof Error ? e.message : 'İstek başarısız oldu.');
    } finally {
      setForgotSubmitting(false);
    }
  };

  const submitForgotReset = async () => {
    if (!resetCode.trim() || newPassword.length < 6) return;
    setForgotSubmitting(true);
    setForgotError(null);
    try {
      await resetPassword(forgotEmail.trim().toLowerCase(), resetCode.trim(), newPassword);
      setForgotOpen(false);
      setPassword('');
      Alert.alert('Şifren güncellendi', 'Yeni şifrenle giriş yaptık.');
    } catch (e) {
      setForgotError(e instanceof Error ? e.message : 'Şifre sıfırlama başarısız oldu.');
    } finally {
      setForgotSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <LinearGradient colors={[colors.card, colors.background]} style={styles.hero}>
            <View style={styles.iconCircle}>
              <MaterialCommunityIcons name="heart-multiple-outline" size={30} color={colors.primary} />
            </View>
            <Text style={styles.eyebrow}>USPULSE</Text>
            <Text style={styles.title}>Uzaklığı{'\n'}yakınlığa çevirin.</Text>
            <Text style={styles.subtitle}>
              {mode === 'login' ? 'Hesabına giriş yap.' : 'Küçük yuvanı oluştur.'}
            </Text>
          </LinearGradient>

          <View style={styles.form}>
            <View style={styles.segmented}>
              <Pressable
                style={[styles.segment, mode === 'login' && styles.segmentActive]}
                onPress={() => setMode('login')}
              >
                <Text style={[styles.segmentText, mode === 'login' && styles.segmentTextActive]}>
                  Giriş yap
                </Text>
              </Pressable>
              <Pressable
                style={[styles.segment, mode === 'register' && styles.segmentActive]}
                onPress={() => setMode('register')}
              >
                <Text style={[styles.segmentText, mode === 'register' && styles.segmentTextActive]}>
                  Hesap oluştur
                </Text>
              </Pressable>
            </View>

            {mode === 'register' && (
              <View style={styles.field}>
                <Text style={styles.label}>İsim</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Adın"
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="words"
                />
              </View>
            )}

            <View style={styles.field}>
              <Text style={styles.label}>E-posta</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="ornek@eposta.com"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <View style={styles.field}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Şifre</Text>
                {mode === 'login' && (
                  <Pressable onPress={openForgotPassword} hitSlop={8}>
                    <Text style={styles.forgotLink}>Şifremi unuttum</Text>
                  </Pressable>
                )}
              </View>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="En az 6 karakter"
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry
              />
            </View>

            {error && <Text style={styles.errorText}>{error}</Text>}

            <Pressable
              style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
              onPress={submit}
              disabled={submitting || !email || !password || (mode === 'register' && !name)}
            >
              {submitting ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Text style={styles.submitText}>
                  {mode === 'login' ? 'Giriş yap' : 'Hesap oluştur'}
                </Text>
              )}
            </Pressable>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>veya</Text>
              <View style={styles.dividerLine} />
            </View>

            <Pressable
              style={[styles.altButton, googleSubmitting && styles.submitButtonDisabled]}
              onPress={handleGooglePress}
              disabled={googleSubmitting}
            >
              {googleSubmitting ? (
                <ActivityIndicator color={colors.foreground} />
              ) : (
                <>
                  <MaterialCommunityIcons name="google" size={18} color={colors.foreground} />
                  <Text style={styles.altButtonText}>Google ile giriş yap</Text>
                </>
              )}
            </Pressable>

            <Pressable onPress={openReconnect} style={styles.demoButton}>
              <MaterialCommunityIcons name="cellphone-link" size={16} color={colors.primary} />
              <Text style={styles.demoText}>Bir bağlantı kodun mu var? Kodla bağlan</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={forgotOpen}
        transparent
        animationType="fade"
        onRequestClose={closeForgotPassword}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {forgotStep === 'request' ? 'Şifremi unuttum' : 'Yeni şifre belirle'}
            </Text>

            {forgotStep === 'request' ? (
              <>
                <Text style={styles.modalHint}>
                  Hesabına kayıtlı e-postayı gir, sana (bu demoda ekranda) bir sıfırlama kodu gösterelim.
                </Text>
                <TextInput
                  style={styles.input}
                  value={forgotEmail}
                  onChangeText={setForgotEmail}
                  placeholder="ornek@eposta.com"
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoFocus
                />
                {forgotError && <Text style={styles.errorText}>{forgotError}</Text>}
                <View style={styles.modalActions}>
                  <Pressable style={styles.modalCancel} onPress={closeForgotPassword}>
                    <Text style={styles.modalCancelText}>Vazgeç</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.modalConfirm, forgotSubmitting && styles.submitButtonDisabled]}
                    onPress={submitForgotRequest}
                    disabled={forgotSubmitting || !forgotEmail.trim()}
                  >
                    {forgotSubmitting ? (
                      <ActivityIndicator color={colors.primaryForeground} />
                    ) : (
                      <Text style={styles.modalConfirmText}>Kod gönder</Text>
                    )}
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                {forgotMessage && <Text style={styles.modalHint}>{forgotMessage}</Text>}
                <TextInput
                  style={styles.input}
                  value={resetCode}
                  onChangeText={setResetCode}
                  placeholder="6 haneli kod"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="number-pad"
                  maxLength={6}
                  autoFocus
                />
                <TextInput
                  style={styles.input}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Yeni şifre (en az 6 karakter)"
                  placeholderTextColor={colors.mutedForeground}
                  secureTextEntry
                />
                {forgotError && <Text style={styles.errorText}>{forgotError}</Text>}
                <View style={styles.modalActions}>
                  <Pressable style={styles.modalCancel} onPress={() => setForgotStep('request')}>
                    <Text style={styles.modalCancelText}>Geri</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.modalConfirm, forgotSubmitting && styles.submitButtonDisabled]}
                    onPress={submitForgotReset}
                    disabled={forgotSubmitting || !resetCode.trim() || newPassword.length < 6}
                  >
                    {forgotSubmitting ? (
                      <ActivityIndicator color={colors.primaryForeground} />
                    ) : (
                      <Text style={styles.modalConfirmText}>Şifreyi sıfırla</Text>
                    )}
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={reconnectOpen}
        transparent
        animationType="fade"
        onRequestClose={closeReconnect}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Kodla bağlan</Text>
            <Text style={styles.modalHint}>
              Başka bir cihazda oturum açıkken Biz sekmesindeki "Davetini paylaş" kartından kendine gönderdiğin
              davet kodunu gir -- e-posta/şifre girmeden aynı hesabına bu cihazdan da bağlanırsın.
            </Text>
            <TextInput
              style={styles.input}
              value={reconnectCode}
              onChangeText={(value) => {
                setReconnectCode(value.toUpperCase());
                if (reconnectError) setReconnectError(null);
              }}
              placeholder="Örn. AB12CD"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="characters"
              maxLength={8}
              autoFocus
            />
            {reconnectError && <Text style={styles.errorText}>{reconnectError}</Text>}
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancel} onPress={closeReconnect}>
                <Text style={styles.modalCancelText}>Vazgeç</Text>
              </Pressable>
              <Pressable
                style={[styles.modalConfirm, reconnectSubmitting && styles.submitButtonDisabled]}
                onPress={submitReconnect}
                disabled={reconnectSubmitting || !reconnectCode.trim()}
              >
                {reconnectSubmitting ? (
                  <ActivityIndicator color={colors.primaryForeground} />
                ) : (
                  <Text style={styles.modalConfirmText}>Bağlan</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  hero: { paddingHorizontal: 24, paddingTop: 48, paddingBottom: 36, alignItems: 'center' },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${colors.primary}26`,
    marginBottom: 18,
  },
  eyebrow: {
    color: colors.primary,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 3,
  },
  title: {
    marginTop: 10,
    color: colors.foreground,
    fontFamily: fonts.heading,
    fontSize: 30,
    lineHeight: 36,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 10,
    color: colors.mutedForeground,
    fontFamily: fonts.body,
    fontSize: 14,
  },
  form: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 32, gap: 16 },
  segmented: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  segment: { flex: 1, paddingVertical: 10, borderRadius: 20, alignItems: 'center' },
  segmentActive: { backgroundColor: colors.primary },
  segmentText: { color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 13, fontWeight: '700' },
  segmentTextActive: { color: colors.primaryForeground },
  field: { gap: 8 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 12, fontWeight: '700' },
  forgotLink: { color: colors.primary, fontFamily: fonts.body, fontSize: 12, fontWeight: '700' },
  input: {
    minHeight: 50,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.input,
    color: colors.foreground,
    fontFamily: fonts.body,
    fontSize: 15,
  },
  errorText: { color: colors.destructive, fontFamily: fonts.body, fontSize: 13 },
  submitButton: {
    minHeight: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    marginTop: 4,
  },
  submitButtonDisabled: { opacity: 0.6 },
  submitText: { color: colors.primaryForeground, fontFamily: fonts.body, fontSize: 15, fontWeight: '900' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 11, fontWeight: '700' },
  altButton: {
    minHeight: 50,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  altButtonText: { color: colors.foreground, fontFamily: fonts.body, fontSize: 14, fontWeight: '800' },
  demoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  demoText: { color: colors.primary, fontFamily: fonts.body, fontSize: 12, fontWeight: '700' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    padding: 20,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  modalTitle: { color: colors.foreground, fontFamily: fonts.heading, fontSize: 19 },
  modalHint: { color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 12, lineHeight: 18 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  modalCancel: {
    flex: 1,
    minHeight: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.secondary,
  },
  modalCancelText: { color: colors.secondaryForeground, fontFamily: fonts.body, fontSize: 13, fontWeight: '800' },
  modalConfirm: {
    flex: 1,
    minHeight: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  modalConfirmText: { color: colors.primaryForeground, fontFamily: fonts.body, fontSize: 13, fontWeight: '800' },
});
