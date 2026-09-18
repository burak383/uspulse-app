import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../theme';
import { useAuth } from '../src/context/AuthContext';
import { RootStackParamList } from './types';

import AuthScreen from '../screens/AuthScreen';
import MatchScreen from '../screens/ELe';
import PaywallScreen from '../screens/Paywall';
import HomeScreen from '../screens/Yuva';
import PlansScreen from '../screens/Planlar';
import MemoriesScreen from '../screens/AnLar';
import TogetherScreen from '../screens/Biz';
import DailyQuestionScreen from '../screens/GNNSorusu';
import DrivingScreen from '../screens/Surus';
import PartnerLocationScreen from '../screens/PartnerKonum';
import AvatarSelectionScreen from '../screens/AvatarSecimi';
import ChatScreen from '../screens/Sohbet';
import LoveLanguageScreen from '../screens/AskDili';

const Stack = createNativeStackNavigator<RootStackParamList>();

function ScreenStack({ needsAvatar, accessBlocked }: { needsAvatar: boolean; accessBlocked: boolean }) {
  const { user, partner } = useAuth();
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!user ? (
        <Stack.Screen name="Auth" component={AuthScreen} />
      ) : !partner ? (
        <Stack.Screen name="Match" component={MatchScreen} />
      ) : needsAvatar ? (
        <Stack.Screen name="AvatarSecimi" component={AvatarSelectionScreen} />
      ) : accessBlocked ? (
        <Stack.Screen name="Paywall" component={PaywallScreen} />
      ) : (
        <>
          <Stack.Screen name="Yuva" component={HomeScreen} />
          <Stack.Screen name="Planlar" component={PlansScreen} />
          <Stack.Screen name="Anilar" component={MemoriesScreen} />
          <Stack.Screen name="Biz" component={TogetherScreen} />
          <Stack.Screen name="GununSorusu" component={DailyQuestionScreen} />
          <Stack.Screen name="Sohbet" component={ChatScreen} />
          <Stack.Screen name="AskDili" component={LoveLanguageScreen} />
          <Stack.Screen name="Surus" component={DrivingScreen} />
          <Stack.Screen name="PartnerKonum" component={PartnerLocationScreen} />
          <Stack.Screen name="AvatarSecimi" component={AvatarSelectionScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function RootNavigator({ theme }: { theme: Theme }) {
  const { status, user, partner, entitlement } = useAuth();

  if (status === 'loading') {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  // Deneme süresi dolmuş ve aktif aboneliği olmayan eşleşmiş çiftler için
  // tüm uygulama yerine Paywall gösterilir -- bkz.
  // server/src/middleware/subscription.ts (getEntitlement) ve routes/me.ts
  // (GET / entitlement alanı). Sunucu tarafı da her istekte ayrıca
  // requireEntitlement ile bunu doğruluyor (bkz. routes/*.ts), bu yüzden bu
  // ekran atlatılsa bile API çağrıları 402 ile reddedilir.
  const accessBlocked = Boolean(partner && entitlement && !entitlement.hasAccess);

  // Eşleştikten sonra ama avatar seçilmeden önce -- Paywall'la aynı desende
  // (tek zorunlu ekran) partnerin sizi nasıl göreceğini seçtiriyoruz. Bu adım
  // atlanamaz: hem yeni eşleşen çiftler hem de bu özellik eklenmeden ÖNCE
  // eşleşmiş olup hiç avatar seçmemiş kullanıcılar bir sonraki açılışta
  // buraya düşer (bkz. screens/AvatarSecimi.tsx). Avatar seçilince
  // user.avatarUrl dolar ve bu koşul kendiliğinden false olup Yuva'ya geçilir.
  const needsAvatar = Boolean(partner && !user?.avatarUrl);

  // "Tamamlandı" tuşuna basınca hiçbir şey olmuyormuş gibi görünen asıl kök
  // neden BURASIYDI (AvatarSecimi.tsx/Yuva.tsx'teki önceki 3 düzeltme --
  // hata yutulması, canGoBack() güvenilmezliği, useEffect/useFocusEffect
  // yarışı -- hepsi gerçek ama YETERSİZ düzeltmelerdi, çünkü aşağıdaki asıl
  // sorunu hiç ele almıyorlardı):
  //
  // React Navigation, bir Stack.Navigator'ın alt ekran listesi (children)
  // her render'da DEĞİŞSE bile, aktif ekranın route ADI yeni listede hâlâ
  // varsa navigasyon durumunu SIFIRLAMAZ -- aynı ekranda kalmaya devam eder.
  // Bu koşullu listelerin çoğunda sorun çıkmaz çünkü art arda gelen
  // durumların (Auth/Match/AvatarSecimi-ilk kurulum/Paywall) ekran isimleri
  // birbirinden tamamen farklı -- o yüzden route adı yeni listede hiç
  // bulunmuyor ve React Navigation otomatik olarak yeni listenin ilk
  // ekranına düşüyor.
  //
  // AMA "AvatarSecimi" -- hem ilk kurulum akışının TEK ekranı olarak (bkz.
  // yukarısı) HEM DE tam ekran listesinin SONUNDA (Biz.tsx'teki "Profil
  // fotoğrafını değiştir" düzenleme akışı için) yer alıyor. "Tamamlandı"ya
  // basılıp needsAvatar false olduğunda, ekran listesi tek-ekranlı
  // listeden tam listeye geçiyor -- ama "AvatarSecimi" adı HER İKİ listede
  // de var olduğundan React Navigation aktif ekranı hâlâ geçerli kabul
  // edip DEĞİŞTİRMİYOR: kullanıcı teknik olarak hâlâ "AvatarSecimi"
  // ekranında kalıyor, Yuva hiç mount olmuyor, dolayısıyla Yuva'daki
  // pendingTabRedirect/useFocusEffect mekanizması da hiç tetiklenmiyor.
  // (Diğer TÜM geçişlerde -- Auth->Match, Match->AvatarSecimi,
  // AvatarSecimi->Paywall, Paywall->tam liste -- bu çakışma yok, bu yüzden
  // sadece bu TEK geçiş bozuktu.)
  //
  // Düzeltme: Stack.Navigator'a, "hangi ekran grubunda olduğumuzu" temsil
  // eden bir `key` veriyoruz. React, key değiştiğinde bileşeni SIFIRDAN
  // yeniden monte eder -- bu da React Navigation'ın navigasyon durumunu
  // gerçekten sıfırlayıp yeni listenin ilk ekranına (Yuva) düşmesini
  // GARANTİ eder, ekran isimlerinin iki liste arasında çakışıp
  // çakışmadığına bakılmaksızın.
  const stage = !user
    ? 'auth'
    : !partner
      ? 'match'
      : needsAvatar
        ? 'avatar'
        : accessBlocked
          ? 'paywall'
          : 'app';

  // ÖNEMLİ: key'i Stack.Navigator'a değil, NavigationContainer'a veriyoruz.
  // Sadece Stack.Navigator'a key vermek YETERSİZ kaldı (denendi, işe
  // yaramadı) -- React Navigation'ın gerçek navigasyon durumu (hangi ekran
  // "focus"lı) NavigationContainer'ın kendi iç state'inde/ref'inde tutuluyor
  // gibi görünüyor; sadece alt Navigator'ı yeniden monte etmek bu durumu
  // sıfırlamaya yetmiyor. NavigationContainer'ın TAMAMINI (StatusBar'ı da
  // içine alacak şekilde) stage değişiminde yeniden monte etmek, React
  // Navigation'ın state'ini gerçekten SIFIRDAN kurmasını garanti ediyor.
  return (
    <NavigationContainer key={stage} theme={theme}>
      <StatusBar style="light" />
      <ScreenStack needsAvatar={needsAvatar} accessBlocked={accessBlocked} />
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
});
