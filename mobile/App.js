import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { AppContext } from './src/context/AppContext.js';
import { useAuth } from './src/hooks/useAuth.js';
import { useEvents } from './src/hooks/useEvents.js';
import { useHabits } from './src/hooks/useHabits.js';
import { getWeekStart, addDays } from './src/lib/utils.js';
import { useState } from 'react';

import AuthScreen from './src/screens/AuthScreen.jsx';
import PlanScreen from './src/screens/PlanScreen.jsx';
import LiveScreen from './src/screens/LiveScreen.jsx';
import HabitsScreen from './src/screens/HabitsScreen.jsx';
import RealityScreen from './src/screens/RealityScreen.jsx';

const Tab = createBottomTabNavigator();

const TAB_ICONS = {
  Plan:            'calendar-outline',
  Live:            'time-outline',
  Habits:          'checkmark-circle-outline',
  'See Your Life': 'bar-chart-outline',
};

export default function App() {
  const auth       = useAuth();
  const eventsData = useEvents(auth.authState, auth.masterKey, auth.isZkEnabled);
  const habitsData = useHabits(auth.authState, auth.masterKey, auth.isZkEnabled);
  const [weekStart, setWeekStart] = useState(getWeekStart());

  // Loading
  if (auth.authState === 'checking') {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color="#7C3AED" size="large" />
        <StatusBar style="dark" />
      </View>
    );
  }

  // Auth required (or ZK vault locked)
  if (['setup', 'login', 'locked', 'offline'].includes(auth.authState)) {
    return (
      <SafeAreaProvider>
        <AuthScreen
          authState={auth.authState}
          onSetup={auth.setup}
          onLogin={auth.login}
          onRegister={auth.register}
          onUnlock={auth.unlock}
          onLogout={auth.logout}
          onContinueOffline={auth.continueOffline}
          onRetry={auth.retry}
        />
        <StatusBar style="dark" />
      </SafeAreaProvider>
    );
  }

  const ctx = {
    auth,
    events:   eventsData,
    habits:   habitsData,
    weekStart,
    prevWeek: () => setWeekStart(ws => addDays(ws, -7)),
    nextWeek: () => setWeekStart(ws => addDays(ws, 7)),
  };

  return (
    <AppContext.Provider value={ctx}>
      <SafeAreaProvider>
        <NavigationContainer>
          <Tab.Navigator
            screenOptions={({ route }) => ({
              headerShown: false,
              tabBarIcon: ({ color, size }) => (
                <Ionicons name={TAB_ICONS[route.name]} size={size} color={color} />
              ),
              tabBarActiveTintColor:   '#7C3AED',
              tabBarInactiveTintColor: '#9CA3AF',
              tabBarStyle: {
                backgroundColor:  '#fff',
                borderTopColor:   '#E5E7EB',
                borderTopWidth:   StyleSheet.hairlineWidth,
              },
              tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
            })}
          >
            <Tab.Screen name="Plan"          component={PlanScreen} />
            <Tab.Screen name="Live"          component={LiveScreen} />
            <Tab.Screen name="Habits"        component={HabitsScreen} />
            <Tab.Screen name="See Your Life" component={RealityScreen} />
          </Tab.Navigator>
        </NavigationContainer>
        <StatusBar style="dark" />
      </SafeAreaProvider>
    </AppContext.Provider>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB' },
});
