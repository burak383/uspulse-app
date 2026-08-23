import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, Fraunces_600SemiBold } from '@expo-google-fonts/fraunces';
import { Manrope_600SemiBold } from '@expo-google-fonts/manrope';
import { AuthProvider } from './src/context/AuthContext';
import RootNavigator from './navigation/RootNavigator';
import { colors } from './theme';

const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.card,
    text: colors.foreground,
    primary: colors.primary,
    border: colors.border,
  },
};

export default function App() {
  // theme.ts declares "Fraunces" (headings) and "Manrope" (body) as the
  // design's fonts, but the original export never actually loaded them -
  // every screen would silently render in the OS system font. This loads
  // one representative weight per family under those exact family names, so
  // `fontFamily: fonts.heading` / `fonts.body` resolve to the real thing.
  const [fontsLoaded] = useFonts({
    Fraunces: Fraunces_600SemiBold,
    Manrope: Manrope_600SemiBold,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer theme={navigationTheme}>
          <StatusBar style="light" />
          <RootNavigator />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
