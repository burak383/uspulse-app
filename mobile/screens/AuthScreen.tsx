import React, { useEffect, useState } from 'react';
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
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { colors, fonts } from '../theme';
import { useAuth } from '../src/context/AuthContext';

// Required once per app for expo-auth-session to close the browser tab and
// hand control back to the app after a Google redirect.
WebBrowser.maybeCompleteAuthSession();

const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || undefined;
const GOOGLE_ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || undefined;
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || undefined;
const GOOGLE_CONFIGURED = Boolean(GOOGLE_IOS_CLIENT_ID || GOOGLE_ANDROID_CLIENT_ID || GOOGLE_WEB_CLIENT_ID);

// expo-auth-session's Google provider throws synchronously (crashing the
// screen) if the client ID for the *current* platform isn't a non-empty
// string, even before the user ever presses the button. Since real IDs are
// optional (see handleGooglePress below, which is the actual "is this set
// up" gate), every platform gets a harmless placeholder here so the hook
// never sees `undefined` -- promptAsync() is never reached for a
// placeholder because handleGooglePress short-circuits on GOOGLE_CONFIGURED.
const GOOGLE_PLACEHOLDER_CLIENT_ID = 'not-configured.apps.googleusercontent.com';

// New screen (not part of the original FireVibe export): the design only
// shipped a pairing screen (Eşleş / ELe.tsx), with no way to actually create
// an account. This is the minimal login/register gate in front of it so the
// backend's auth can be reached at all.
export default function AuthScreen() {
  const {
    login,
    register,
    loginWithGoogle,
    forgotPassword,
    resetPassword,
    error,
    clearError,
    biometricHardwareReady,
    biometricLabel,
    biometricEnabled,
    enableBiometric,
    loginWithBiometric,
  } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [biometricSubmitting, setBiometricSubmitting] = useState(false);

  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState<'request' | 'reset'>('request');
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);
  const [forgotError, setForgotError] = useState<string | null>(null);

  // Google auth request is created unconditionally (the hook can't be
  // called conditionally); an undefined clientId for a platform just means
  // that platform's flow can't start, which we already guard against below.
  const [, googleResponse, promptGoogleAsync] = Google.useAuthRequest({
    iosClientId: GOOGLE_IOS_CLIENT_ID || GOOGLE_PLACEHOLDER_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID || GOOGLE_PLACEHOLDER_CLIENT_ID,
    webClientId: GOOGLE_WEB_CLIENT_ID || GOOGLE_PLACEHOLDER_CLIENT_ID,
  });

  useEffect(() => {
    if (googleResponse?.type === 'success') {
      const idToken =
        googleResponse.authentication?.idToken ?? (googleResponse.params as { id_token?: string })?.id_token;
      if (!idToken) {
        Alert.alert('Google ile giriş başarısız oldu.', 'Kimlik jetonu alınamadı.');
        return;
      }
      setGoogleSubmitting(true);
      loginWithGoogle(idToken)
        .catch(() => {
          // error is surfaced via context
        })
        .finally(() => setGoogleSubmitting(false));
    } else if (googleResponse?.type === 'error') {
      Alert.alert('Google ile giriş başarısız oldu.', googleResponse.error?.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleResponse]);

  const offerBiometricEnrollment = () => {
    if (!biometricHardwareReady || biometricEnabled) return;
    Alert.alert(
      `${biometricLabel} ile hızlı giriş`,
      `Bir daha şifre girmeden ${biometricLabel} ile giriş yapmak ister misin?`,
      [
        { text: 'Şimdi değil', style: 'cancel' },
        {
          text: 'Etkinleştir',
          onPress: () => {
            enableBiometric().catch(() => {
              Alert.alert(`${biometricLabel} etkinleştirilemedi.`);
            });
          },
        },
      ],
    );
  };

  const submit = async () => {
    clearError();
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await login(email.trim().toLowerCase(), password);
      } else {
        await register(name.trim(), email.trim().toLowerCase(), password);
      }
      offerBiometricEnrollment();
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
        "Bu özelliği açmak için Google Cloud Console'dan OAuth istemci kimlikleri oluşturup mobile/.env dosyasına, aynı kimlikleri de server/.env içindeki GOOGLE_CLIENT_IDS değerine eklemeniz gerekir. Ayrıntılar için README'ye bakın.",
      );
      return;
    }
    try {
      await promptGoogleAsync();
    } catch {
      Alert.alert('Google ile giriş başlatılamadı.');
    }
  };

  const handleBiometricPress = async () => {
    setBiometricSubmitting(true);
    try {
      await loginWithBiometric();
    } catch {
      // error is surfaced via context
    } finally {
      setBiometricSubmitting(false);
    }
  };

  const fillDemo = () => {
    setMode('login');
    setEmail('elif@uspulse.app');
    setPassword('uspulse1234');
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

            {biometricHardwareReady && biometricEnabled && (
              <Pressable
                style={[styles.altButton, biometricSubmitting && styles.submitButtonDisabled]}
                onPress={handleBiometricPress}
                disabled={biometricSubmitting}
              >
                {biometricSubmitting ? (
                  <ActivityIndicator color={colors.foreground} />
                ) : (
                  <>
                    <MaterialCommunityIcons
                      name={biometricLabel === 'Parmak izi' ? 'fingerprint' : 'face-recognition'}
                      size={18}
                      color={colors.foreground}
                    />
                    <Text style={styles.altButtonText}>{biometricLabel} ile giriş yap</Text>
                  </>
                )}
              </Pressable>
            )}

            <Pressable onPress={fillDemo} style={styles.demoButton}>
              <MaterialCommunityIcons name="account-heart-outline" size={16} color={colors.primary} />
              <Text style={styles.demoText}>Demo hesabıyla dene (Elif)</Text>
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
