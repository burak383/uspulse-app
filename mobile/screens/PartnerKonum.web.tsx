// react-native-maps'in web karşılığı yok (bkz. Surus.web.tsx'teki aynı not)
// -- bu yüzden bu ekranın da web'e özel basit bir sürümü var. Dosya
// adındaki ".web" uzantısı sayesinde Metro, web derlemesinde otomatik
// olarak BU dosyayı, Android/iOS derlemesinde ise haritalı gerçek sürümü
// (PartnerKonum.tsx) kullanır.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
// bkz. Surus.tsx'teki aynı açıklama -- react-native'in kendi SafeAreaView'ı
// yerine react-native-safe-area-context kullanıyoruz.
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { theme } from '../theme';
import { RootStackParamList, TabRouteName } from '../navigation/types';
import { BottomTabBar } from '../src/components/BottomTabBar';

const colors = theme.colors;

type NavProp = NativeStackNavigationProp<RootStackParamList, 'PartnerKonum'>;

export default function PartnerLocationScreenWeb({ navigation }: { navigation: NavProp }) {
  const goTab = (route: TabRouteName) => navigation.navigate(route);
  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Durum çubuğu App.tsx'te genel olarak (expo-status-bar, style="light")
          ayarlanıyor -- bkz. AvatarSecimi.tsx'teki aynı açıklama. */}
      <View style={styles.header}>
        <Text style={styles.title}>Konum</Text>
      </View>
      <View style={styles.centered}>
        <MaterialCommunityIcons name="map-marker-off-outline" size={40} color={colors.mutedForeground} />
        <Text style={styles.emptyTitle}>Bu ekran web'de kullanılamaz</Text>
        <Text style={styles.emptyCaption}>
          Konum haritası yalnızca Android/iOS uygulamasında görüntülenebilir.
        </Text>
      </View>
      <BottomTabBar active="PartnerKonum" onNavigate={goTab} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  title: { fontFamily: theme.fonts.heading, fontSize: 20, color: colors.foreground },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 10 },
  emptyTitle: { fontFamily: theme.fonts.heading, fontSize: 17, color: colors.foreground, textAlign: 'center' },
  emptyCaption: {
    fontFamily: theme.fonts.body,
    fontSize: 13,
    color: colors.mutedForeground,
    textAlign: 'center',
    lineHeight: 19,
  },
});
