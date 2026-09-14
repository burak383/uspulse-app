import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
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

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
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
          <Stack.Screen name="Surus" component={DrivingScreen} />
          <Stack.Screen name="PartnerKonum" component={PartnerLocationScreen} />
          <Stack.Screen name="AvatarSecimi" component={AvatarSelectionScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
});
