import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../theme';
import { useAuth } from '../src/context/AuthContext';
import { RootStackParamList } from './types';

import AuthScreen from '../screens/AuthScreen';
import MatchScreen from '../screens/ELe';
import HomeScreen from '../screens/Yuva';
import PlansScreen from '../screens/Planlar';
import MemoriesScreen from '../screens/AnLar';
import TogetherScreen from '../screens/Biz';
import DailyQuestionScreen from '../screens/GNNSorusu';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { status, user, partner } = useAuth();

  if (status === 'loading') {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!user ? (
        <Stack.Screen name="Auth" component={AuthScreen} />
      ) : !partner ? (
        <Stack.Screen name="Match" component={MatchScreen} />
      ) : (
        <>
          <Stack.Screen name="Yuva" component={HomeScreen} />
          <Stack.Screen name="Planlar" component={PlansScreen} />
          <Stack.Screen name="Anilar" component={MemoriesScreen} />
          <Stack.Screen name="Biz" component={TogetherScreen} />
          <Stack.Screen name="GununSorusu" component={DailyQuestionScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
});
