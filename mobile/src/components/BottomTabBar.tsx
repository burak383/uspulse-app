// Uygulamanın 6 ana sekmesi arasında gezinme çubuğu. Eskiden Yuva/Planlar/
// Anılar/Biz ekranlarının HER BİRİ kendi tab bar'ını (farklı ikon setleri,
// farklı stil ayrıntılarıyla) ayrı ayrı tanımlıyordu; Konum ve Sürüş de
// sekme olarak eklenince (bkz. navigation/types.ts TabRouteName) altışar
// öğeyi 4 farklı yerde senkron tutmak yerine TEK bir bileşene taşındı --
// bkz. Yuva.tsx/Planlar.tsx/AnLar.tsx/Biz.tsx/PartnerKonum.tsx/Surus.tsx
// (ve bunların .web.tsx sürümleri) hepsi artık bunu kullanıyor.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, fonts } from '../../theme';
import { TabRouteName } from '../../navigation/types';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const TABS: { route: TabRouteName; icon: IconName; label: string }[] = [
  { route: 'Yuva', icon: 'home-variant-outline', label: 'Yuva' },
  { route: 'Planlar', icon: 'calendar-month-outline', label: 'Planlar' },
  { route: 'Anilar', icon: 'image-multiple-outline', label: 'Anılar' },
  { route: 'Biz', icon: 'account-group-outline', label: 'Biz' },
  { route: 'PartnerKonum', icon: 'map-marker-outline', label: 'Konum' },
  { route: 'Surus', icon: 'car-outline', label: 'Sürüş' },
];

export function BottomTabBar({
  active,
  onNavigate,
}: {
  active: TabRouteName;
  onNavigate: (route: TabRouteName) => void;
}) {
  return (
    <View style={styles.tabBar}>
      {TABS.map((tab) => {
        const isActive = tab.route === active;
        return (
          <Pressable
            key={tab.route}
            accessibilityRole="button"
            accessibilityLabel={tab.label}
            style={[styles.tab, isActive && styles.activeTab]}
            onPress={() => onNavigate(tab.route)}
          >
            <MaterialCommunityIcons
              name={tab.icon}
              size={18}
              color={isActive ? colors.primaryForeground : colors.mutedForeground}
            />
            <Text
              numberOfLines={1}
              style={[styles.tabLabel, isActive && styles.activeTabLabel]}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 18,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.secondary,
    flexDirection: 'row',
    paddingHorizontal: 4,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 5,
    borderRadius: 20,
  },
  activeTab: {
    backgroundColor: colors.primary,
  },
  tabLabel: {
    fontFamily: fonts.body,
    fontSize: 9,
    fontWeight: '700',
    color: colors.mutedForeground,
  },
  activeTabLabel: {
    color: colors.primaryForeground,
  },
});

/** Tüm ekranlardaki mevcut ScrollView'ların, artık daha yüksek/6 öğeli olan bu
 * çubuğun arkasında kalmaması için kullanabileceği ortak alt boşluk. */
export const BOTTOM_TAB_BAR_CLEARANCE = 96;
