// expo-secure-store'un web karşılığı yok -- Keychain (iOS) / Keystore
// (Android) kavramının web'de bir eşdeğeri bulunmuyor, bu yüzden kütüphane
// web'de boş bir modül dışa aktarıyor (ExpoSecureStore.web.js = `export
// default {}`). Native'de SecureStore.setItemAsync/getItemAsync/
// deleteItemAsync çağrıldığında sorun yok, ama web'de bu fonksiyonlar
// `undefined` olduğu için "ExpoSecureStore.default.setValueWithKeyAsync is
// not a function" gibi bir hata fırlatıyor.
//
// Web derlemesi bu projede yalnızca satın alma dışı akışları (Paywall hariç
// ekranları) test etmek için kullanılıyor -- gerçek dağıtım her zaman
// Android/iOS'ta, yani SecureStore'un tam desteklendiği platformlarda
// çalışıyor. Bu yüzden web'de düz AsyncStorage'a (tarayıcıda localStorage
// üzerinden çalışır) düşmek burada kabul edilebilir bir basitleştirme;
// gerçek cihazlarda oturum jetonu yine Keychain/Keystore'da saklanmaya
// devam ediyor.
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

export async function getSecureItemAsync(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return AsyncStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

export async function setSecureItemAsync(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function deleteSecureItemAsync(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
