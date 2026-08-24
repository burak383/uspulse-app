import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import { api, ApiError, setAuthToken } from '../api/client';
import { AuthResponse, Couple, ForgotPasswordResponse, MeResponse, PublicUser } from '../api/types';

const TOKEN_KEY = 'uspulse_token';
// expo-secure-store keys can only contain word characters, '.', '-'.
const BIOMETRIC_TOKEN_KEY = 'uspulse-biometric-token';
const BIOMETRIC_FLAG_KEY = 'uspulse_biometric_enabled';
const HAPTICS_FLAG_KEY = 'uspulse_haptics_enabled';

type Status = 'loading' | 'signedOut' | 'signedIn';

// Uygulama açıkken bir "dokunuş" bildirimi gelirse bunu göster (ve titret) --
// bu ayarlanmazsa Expo, ön plandaki bildirimleri varsayılan olarak sessizce yutar.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function labelForBiometricTypes(types: LocalAuthentication.AuthenticationType[]): string {
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return Platform.OS === 'ios' ? 'Face ID' : 'Yüz tanıma';
  }
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return 'Parmak izi';
  }
  if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
    return 'İris taraması';
  }
  return 'Biyometrik kimlik doğrulama';
}

interface AuthContextValue {
  status: Status;
  user: PublicUser | null;
  partner: PublicUser | null;
  couple: Couple | null;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  loginWithFacebook: (accessToken: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<ForgotPasswordResponse>;
  resetPassword: (email: string, code: string, newPassword: string) => Promise<void>;
  pair: (code: string) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  refresh: () => Promise<void>;
  clearError: () => void;
  // Biyometrik (Face ID / parmak izi) hızlı giriş.
  biometricHardwareReady: boolean;
  biometricLabel: string;
  biometricEnabled: boolean;
  enableBiometric: () => Promise<void>;
  disableBiometric: () => Promise<void>;
  loginWithBiometric: () => Promise<void>;
  // Partnere aranızdaki YAKLAŞIK mesafeyi göstermek için konum paylaşımı.
  // Kesin enlem/boylam hiçbir zaman partnere ya da istemci koduna dönmez.
  distanceKm: number | null;
  locationSharedByMe: boolean;
  locationSharedByPartner: boolean;
  locationSubmitting: boolean;
  shareLocationNow: () => Promise<void>;
  stopSharingLocation: () => Promise<void>;
  // "Kalbimi Gönder" titreşimi: kendi cihazında anlık geri bildirim VE
  // partnerin "dokunuşu" gerçek zamanlı bildirimle aldığında titreşim.
  hapticsEnabled: boolean;
  setHapticsEnabled: (next: boolean) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<PublicUser | null>(null);
  const [partner, setPartner] = useState<PublicUser | null>(null);
  const [couple, setCouple] = useState<Couple | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [biometricHardwareReady, setBiometricHardwareReady] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState('Biyometrik kimlik doğrulama');
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [locationSharedByMe, setLocationSharedByMe] = useState(false);
  const [locationSharedByPartner, setLocationSharedByPartner] = useState(false);
  const [locationSubmitting, setLocationSubmitting] = useState(false);
  const [hapticsEnabled, setHapticsEnabledState] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [hasHardware, isEnrolled, types, enabledFlag, hapticsFlag] = await Promise.all([
          LocalAuthentication.hasHardwareAsync(),
          LocalAuthentication.isEnrolledAsync(),
          LocalAuthentication.supportedAuthenticationTypesAsync(),
          AsyncStorage.getItem(BIOMETRIC_FLAG_KEY),
          AsyncStorage.getItem(HAPTICS_FLAG_KEY),
        ]);
        setBiometricHardwareReady(hasHardware && isEnrolled);
        setBiometricLabel(labelForBiometricTypes(types));
        setBiometricEnabled(enabledFlag === '1');
        // varsayılan açık: kayıtlı bir tercih yoksa (ilk açılış) titreşim açık kalır.
        setHapticsEnabledState(hapticsFlag !== '0');
      } catch {
        // biometrics simply won't be offered
      }
    })();
  }, []);

  // Android'de arka plandaki/uygulama kapalıyken gelen bir bildirimin
  // gerçekten titreşmesi için önce bir bildirim kanalı tanımlanmış olmalı.
  useEffect(() => {
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('touches', {
        name: 'Dokunuşlar',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 150, 250],
        lightColor: '#FF8F82',
      }).catch(() => {});
    }
  }, []);

  const setHapticsEnabled = useCallback(async (next: boolean) => {
    setHapticsEnabledState(next);
    await AsyncStorage.setItem(HAPTICS_FLAG_KEY, next ? '1' : '0');
  }, []);

  // Uygulama açıkken partnerinden bir "dokunuş" bildirimi gelirse titret.
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data as { type?: string } | undefined;
      if (data?.type === 'touch' && hapticsEnabled) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
    });
    return () => sub.remove();
  }, [hapticsEnabled]);

  const applyMe = useCallback((me: MeResponse) => {
    setUser(me.user);
    setPartner(me.partner);
    setCouple(me.couple);
    setDistanceKm(me.distanceKm);
    setLocationSharedByMe(me.locationSharedByMe);
    setLocationSharedByPartner(me.locationSharedByPartner);
  }, []);

  // Konumu izin varsa sessizce paylaşır; izin yoksa/istenmezse ya da GPS/ağ
  // hatası olursa görünmez şekilde vazgeçer -- giriş akışını ASLA engellemez
  // ya da hata göstermez. "Uygulamaya giriş yapıldığında konum alınsın"
  // isteğinin arka plandaki, kullanıcıyı rahatsız etmeyen karşılığı budur;
  // kalıcı red/izin durumları için açık, geri bildirimli shareLocationNow da var.
  const shareLocationBestEffort = useCallback(async () => {
    try {
      const current = await Location.getForegroundPermissionsAsync();
      let granted = current.status === Location.PermissionStatus.GRANTED;
      if (!granted && current.canAskAgain) {
        const requested = await Location.requestForegroundPermissionsAsync();
        granted = requested.status === Location.PermissionStatus.GRANTED;
      }
      if (!granted) return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      await api.put('/me/location', { lat: pos.coords.latitude, lng: pos.coords.longitude });
      setLocationSharedByMe(true);
    } catch {
      // konum paylaşılamadı: sessizce geç
    }
  }, []);

  // Bildirim izni varsa/istenebiliyorsa bir Expo push jetonu alıp sunucuya
  // kaydeder ki partnerin "Kalbimi Gönder"i bu cihazı gerçekten titretebilsin.
  // Aynı shareLocationBestEffort gibi tamamen sessiz: izin yok, EAS projesine
  // henüz bağlanmamış (bkz. app.json) ya da Expo Go'da Android push
  // desteklenmiyor (SDK 53+) gibi durumlarda görünmez şekilde vazgeçer.
  const registerPushTokenBestEffort = useCallback(async () => {
    try {
      const current = await Notifications.getPermissionsAsync();
      let granted = current.granted;
      if (!granted && current.canAskAgain) {
        const requested = await Notifications.requestPermissionsAsync();
        granted = requested.granted;
      }
      if (!granted) return;
      const projectId =
        (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
        Constants.easConfig?.projectId;
      if (!projectId) return;
      const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
      await api.put('/me/push-token', { token: tokenResponse.data });
    } catch {
      // push jetonu alınamadı: sessizce geç
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const me = await api.get<MeResponse>('/me');
      applyMe(me);
      setStatus('signedIn');
      // Sadece eşleşmiş kullanıcılar için anlamlı (mesafe hesaplamak / dokunuş
      // bildirimi göndermek üzere) -- eşleşmemiş bir hesaba konum/bildirim
      // izni sormanın bir faydası yok.
      if (me.user.coupleId) {
        shareLocationBestEffort();
        registerPushTokenBestEffort();
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await AsyncStorage.removeItem(TOKEN_KEY);
        setAuthToken(null);
        setUser(null);
        setPartner(null);
        setCouple(null);
        setDistanceKm(null);
        setLocationSharedByMe(false);
        setLocationSharedByPartner(false);
        setStatus('signedOut');
      }
    }
  }, [applyMe, shareLocationBestEffort, registerPushTokenBestEffort]);

  const shareLocationNow = useCallback(async () => {
    setError(null);
    setLocationSubmitting(true);
    try {
      const current = await Location.getForegroundPermissionsAsync();
      let granted = current.status === Location.PermissionStatus.GRANTED;
      if (!granted) {
        const requested = await Location.requestForegroundPermissionsAsync();
        granted = requested.status === Location.PermissionStatus.GRANTED;
      }
      if (!granted) {
        throw new Error('Konum izni verilmedi. Ayarlardan UsPulse için konum iznini açabilirsin.');
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      await api.put('/me/location', { lat: pos.coords.latitude, lng: pos.coords.longitude });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Konum paylaşılamadı.');
      throw e;
    } finally {
      setLocationSubmitting(false);
    }
  }, [refresh]);

  const stopSharingLocation = useCallback(async () => {
    setError(null);
    setLocationSubmitting(true);
    try {
      await api.delete('/me/location');
      setLocationSharedByMe(false);
      setDistanceKm(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Konum paylaşımı kapatılamadı.');
      throw e;
    } finally {
      setLocationSubmitting(false);
    }
  }, [refresh]);

  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem(TOKEN_KEY);
      if (!stored) {
        setStatus('signedOut');
        return;
      }
      setAuthToken(stored);
      await refresh();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAuthResponse = useCallback(async (res: AuthResponse) => {
    await AsyncStorage.setItem(TOKEN_KEY, res.token);
    setAuthToken(res.token);
    setUser(res.user);
    setPartner(null);
    setCouple(null);
    setStatus('signedIn');
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      setError(null);
      try {
        const res = await api.post<AuthResponse>('/auth/login', { email, password });
        await handleAuthResponse(res);
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Giriş başarısız oldu.');
        throw e;
      }
    },
    [handleAuthResponse, refresh],
  );

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      setError(null);
      try {
        const res = await api.post<AuthResponse>('/auth/register', { name, email, password });
        await handleAuthResponse(res);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Kayıt başarısız oldu.');
        throw e;
      }
    },
    [handleAuthResponse],
  );

  const loginWithGoogle = useCallback(
    async (idToken: string) => {
      setError(null);
      try {
        const res = await api.post<AuthResponse>('/auth/google', { idToken });
        await handleAuthResponse(res);
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Google ile giriş başarısız oldu.');
        throw e;
      }
    },
    [handleAuthResponse, refresh],
  );

  const loginWithFacebook = useCallback(
    async (accessToken: string) => {
      setError(null);
      try {
        const res = await api.post<AuthResponse>('/auth/facebook', { accessToken });
        await handleAuthResponse(res);
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Facebook ile giriş başarısız oldu.');
        throw e;
      }
    },
    [handleAuthResponse, refresh],
  );

  const forgotPassword = useCallback(async (email: string) => {
    setError(null);
    try {
      return await api.post<ForgotPasswordResponse>('/auth/forgot-password', { email });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'İstek başarısız oldu.');
      throw e;
    }
  }, []);

  const resetPassword = useCallback(
    async (email: string, code: string, newPassword: string) => {
      setError(null);
      try {
        const res = await api.post<AuthResponse>('/auth/reset-password', { email, code, newPassword });
        await handleAuthResponse(res);
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Şifre sıfırlama başarısız oldu.');
        throw e;
      }
    },
    [handleAuthResponse, refresh],
  );

  const pair = useCallback(
    async (code: string) => {
      setError(null);
      try {
        await api.post('/auth/pair', { code });
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Eşleşme başarısız oldu.');
        throw e;
      }
    },
    [refresh],
  );

  const logout = useCallback(async () => {
    // Bu cihaz artık bildirim almamalı -- jetonu silmeyi dene (auth başlığı
    // hâlâ geçerliyken, token'ı temizlemeden önce). Başarısız olursa önemli
    // değil, çıkışı engellemesin.
    await api.delete('/me/push-token').catch(() => {});
    await AsyncStorage.removeItem(TOKEN_KEY);
    setAuthToken(null);
    setUser(null);
    setPartner(null);
    setCouple(null);
    setDistanceKm(null);
    setLocationSharedByMe(false);
    setLocationSharedByPartner(false);
    setStatus('signedOut');
    // Face ID / parmak izi kaydı bilerek silinmiyor: kullanıcı çıkış yapıp
    // aynı cihazdan tekrar açtığında yine biyometrik olarak girebilsin diye.
    // Tamamen kaldırmak isteyen disableBiometric() çağırabilir.
  }, []);

  const deleteAccount = useCallback(async () => {
    setError(null);
    try {
      await api.delete('/me');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hesap silinemedi.');
      throw e;
    }
    // Hesap sunucuda silindi; cihazdaki oturum/biyometrik izleri de temizlenir.
    await AsyncStorage.removeItem(TOKEN_KEY);
    await SecureStore.deleteItemAsync(BIOMETRIC_TOKEN_KEY).catch(() => {});
    await AsyncStorage.removeItem(BIOMETRIC_FLAG_KEY);
    setAuthToken(null);
    setUser(null);
    setPartner(null);
    setCouple(null);
    setDistanceKm(null);
    setLocationSharedByMe(false);
    setLocationSharedByPartner(false);
    setBiometricEnabled(false);
    setStatus('signedOut');
  }, []);

  const enableBiometric = useCallback(async () => {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (!token) {
      throw new Error('Biyometrik girişi etkinleştirmek için önce giriş yapmalısın.');
    }
    await SecureStore.setItemAsync(BIOMETRIC_TOKEN_KEY, token);
    await AsyncStorage.setItem(BIOMETRIC_FLAG_KEY, '1');
    setBiometricEnabled(true);
  }, []);

  const disableBiometric = useCallback(async () => {
    await SecureStore.deleteItemAsync(BIOMETRIC_TOKEN_KEY).catch(() => {});
    await AsyncStorage.removeItem(BIOMETRIC_FLAG_KEY);
    setBiometricEnabled(false);
  }, []);

  const loginWithBiometric = useCallback(async () => {
    setError(null);
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !isEnrolled) {
        throw new Error('Bu cihazda biyometrik kimlik doğrulama kurulu değil.');
      }
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Kimliğini doğrula',
        cancelLabel: 'Vazgeç',
        disableDeviceFallback: false,
      });
      if (!result.success) {
        throw new Error('Kimlik doğrulama tamamlanamadı.');
      }
      const token = await SecureStore.getItemAsync(BIOMETRIC_TOKEN_KEY);
      if (!token) {
        throw new Error('Kayıtlı bir oturum bulunamadı. Lütfen şifreyle giriş yap.');
      }
      await AsyncStorage.setItem(TOKEN_KEY, token);
      setAuthToken(token);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Giriş başarısız oldu.');
      throw e;
    }
  }, [refresh]);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo(
    () => ({
      status,
      user,
      partner,
      couple,
      error,
      login,
      register,
      loginWithGoogle,
      loginWithFacebook,
      forgotPassword,
      resetPassword,
      pair,
      logout,
      deleteAccount,
      refresh,
      clearError,
      biometricHardwareReady,
      biometricLabel,
      biometricEnabled,
      enableBiometric,
      disableBiometric,
      loginWithBiometric,
      distanceKm,
      locationSharedByMe,
      locationSharedByPartner,
      locationSubmitting,
      shareLocationNow,
      stopSharingLocation,
      hapticsEnabled,
      setHapticsEnabled,
    }),
    [
      status,
      user,
      partner,
      couple,
      error,
      login,
      register,
      loginWithGoogle,
      loginWithFacebook,
      forgotPassword,
      resetPassword,
      pair,
      logout,
      deleteAccount,
      refresh,
      clearError,
      biometricHardwareReady,
      biometricLabel,
      biometricEnabled,
      enableBiometric,
      disableBiometric,
      loginWithBiometric,
      distanceKm,
      locationSharedByMe,
      locationSharedByPartner,
      locationSubmitting,
      shareLocationNow,
      stopSharingLocation,
      hapticsEnabled,
      setHapticsEnabled,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
