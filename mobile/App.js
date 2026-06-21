import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { ShareIntentProvider, useShareIntentContext } from 'expo-share-intent';

import { AppContext } from './src/context/AppContext.js';
import { useAuth } from './src/hooks/useAuth.js';
import { useEvents } from './src/hooks/useEvents.js';
import { useHabits } from './src/hooks/useHabits.js';
import { useProfile } from './src/hooks/useProfile.js';
import { useBudgets } from './src/hooks/useBudgets.js';
import { getWeekStart, addDays } from './src/lib/utils.js';
import { useState } from 'react';

import AuthScreen from './src/screens/AuthScreen.jsx';
import PlanScreen from './src/screens/PlanScreen.jsx';
import LiveScreen from './src/screens/LiveScreen.jsx';
import HabitsScreen from './src/screens/HabitsScreen.jsx';
import RealityScreen from './src/screens/RealityScreen.jsx';
import SettingsScreen from './src/screens/SettingsScreen.jsx';
import ParseModal from './src/components/ParseModal.jsx';

const Tab = createBottomTabNavigator();

const TAB_ICONS = {
  Plan:            'calendar-outline',
  Live:            'time-outline',
  Habits:          'checkmark-circle-outline',
  'See Your Life': 'bar-chart-outline',
  Settings:        'settings-outline',
};

export default function App() {
  return (
    <ShareIntentProvider>
      <Main />
    </ShareIntentProvider>
  );
}

function Main() {
  const auth        = useAuth();
  const eventsData  = useEvents(auth.authState, auth.masterKey, auth.isZkEnabled);
  const habitsData  = useHabits(auth.authState, auth.masterKey, auth.isZkEnabled);
  const profileData = useProfile(auth.authState, auth.masterKey, auth.isZkEnabled);
  const budgetsData = useBudgets(auth.authState);
  const [weekStart, setWeekStart] = useState(getWeekStart());

  // Shared text arriving from the OS share sheet (SMS/email/etc., via
  // expo-share-intent) is funneled into the same ParseModal the in-app
  // "From Text" button opens, rendered once at the root so it's reachable
  // regardless of which tab is active when the share arrives. Visibility is
  // derived rather than synced via an effect, so a pending share intent and
  // the manual "From Text" trigger share one source of truth with no
  // render-after-mount delay.
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();
  const [manualParseOpen, setManualParseOpen] = useState(false);
  const [manualParseText, setManualParseText] = useState('');

  const sharedText = hasShareIntent ? shareIntent?.text : null;
  const parseModalVisible = manualParseOpen || !!sharedText;
  const parseModalText = sharedText || manualParseText;

  function openParseModal(text = '') {
    setManualParseText(text);
    setManualParseOpen(true);
  }

  function closeParseModal() {
    setManualParseOpen(false);
    setManualParseText('');
    if (hasShareIntent) resetShareIntent();
  }

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
    profile:  profileData,
    budgets:  budgetsData,
    weekStart,
    prevWeek: () => setWeekStart(ws => addDays(ws, -7)),
    nextWeek: () => setWeekStart(ws => addDays(ws, 7)),
    openParseModal,
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
            <Tab.Screen name="Settings"      component={SettingsScreen} />
          </Tab.Navigator>
        </NavigationContainer>
        <ParseModal
          visible={parseModalVisible}
          initialText={parseModalText}
          onClose={closeParseModal}
        />
        <StatusBar style="dark" />
      </SafeAreaProvider>
    </AppContext.Provider>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB' },
});
