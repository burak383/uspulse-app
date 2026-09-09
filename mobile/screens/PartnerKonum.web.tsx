// react-native-maps'in web karşılığı yok (bkz. Surus.web.tsx'teki aynı not)
// -- bu yüzden bu ekranın da web'e özel basit bir sürümü var. Dosya
// adındaki ".web" uzantısı sayesinde Metro, web derlemesinde otomatik
// olarak BU dosyayı, Android/iOS derlemesinde ise haritalı gerçek sürümü
// (PartnerKonum.tsx) kullanır.
import React from 'react';
import { SafeAreaView, StatusBar, StyleSheet, Text, View, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { theme } from '../theme';
import { RootStackParamList } from '../navigation/types';

const colors = theme.colors;

type NavProp = NativeStackNavigationProp<RootStackParamList, 'PartnerKonum'>;

export default function PartnerLocationScreenWeb({ navigation }: { navigation: NavProp }) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Geri dön"
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialCommunityIcons name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={styles.title}>Konum</Text>
        <View style={{ width: 40 }} />
      </View>
      <View style={styles.centered}>
        <MaterialCommunityIcons name="map-marker-off-outline" size={40} color={colors.mutedForeground} />
        <Text style={styles.emptyTitle}>Bu ekran web'de kullanılamaz</Text>
        <Text style={styles.emptyCaption}>
          Konum haritası yalnızca Android/iOS uygulamasında görüntülenebilir.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
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
