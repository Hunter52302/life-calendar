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
import { useCategoryKeywords } from './src/hooks/useCategoryKeywords.js';
import { useLlmSettings } from './src/hooks/useLlmSettings.js';
import { usePersistentState } from './src/hooks/usePersistentState.js';
import { useAppUpdater } from './src/hooks/useAppUpdater.js';
import { getWeekStart, addDays } from './src/lib/utils.js';
import { getTheme } from './src/lib/theme.js';
import { useState } from 'react';

import AuthScreen     from './src/screens/AuthScreen.jsx';
import PlanScreen     from './src/screens/PlanScreen.jsx';
import LiveScreen     from './src/screens/LiveScreen.jsx';
import HabitsScreen   from './src/screens/HabitsScreen.jsx';
import RealityScreen  from './src/screens/RealityScreen.jsx';
import SettingsScreen from './src/screens/SettingsScreen.jsx';
import ParseModal     from './src/components/ParseModal.jsx';
import UpdateBanner   from './src/components/UpdateBanner.jsx';

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
  const updater     = useAppUpdater();
  const [assumeCompleted, setAssumeCompleted] = usePersistentState('lc-m-assume-completed', true);
  const eventsData  = useEvents(auth.authState, auth.masterKey, auth.isZkEnabled, assumeCompleted);
  const habitsData  = useHabits(auth.authState, auth.masterKey, auth.isZkEnabled);
  const profileData = useProfile(auth.authState, auth.masterKey, auth.isZkEnabled);
  const budgetsData = useBudgets(auth.authState);
  const categoryKeywordsData = useCategoryKeywords(auth.authState);
  const { llmSettings, setLlmSettings } = useLlmSettings(auth.authState, auth.masterKey, auth.isZkEnabled);
  const [weekStart, setWeekStart] = useState(getWeekStart());

  // ── Settings: Display ─────────────────────────────────────────────────────
  const [militaryTime,        setMilitaryTime]        = usePersistentState('lc-m-military-time', false);
  const [darkMode,            setDarkMode]            = usePersistentState('lc-m-dark-mode', false);
  const [weekNumbers,         setWeekNumbers]         = usePersistentState('lc-m-week-numbers', false);
  const [weekStartsMonday,    setWeekStartsMonday]    = usePersistentState('lc-m-week-starts-monday', false);
  const [showLiveTab,         setShowLiveTab]         = usePersistentState('lc-m-show-live-tab', true);
  const [showRealityTab,      setShowRealityTab]      = usePersistentState('lc-m-show-reality-tab', true);
  const [defaultView,         setDefaultView]         = usePersistentState('lc-m-default-view', 'Plan');
  const [pushEnabled,         setPushEnabled]         = usePersistentState('lc-m-push-enabled', false);

  // ── Settings: Minimalist / UI chrome ──────────────────────────────────────
  const [minimalistMode,      setMinimalistMode]      = usePersistentState('lc-m-minimalist-mode', false);
  const [showQuickAdd,        setShowQuickAdd]        = usePersistentState('lc-m-show-quick-add', true);
  const [showPrecisionToggle, setShowPrecisionToggle] = usePersistentState('lc-m-show-precision-toggle', true);
  const [showCategoriesMenu,  setShowCategoriesMenu]  = usePersistentState('lc-m-show-categories-menu', true);
  const [showFab,             setShowFab]             = usePersistentState('lc-m-show-fab', true);
  const [fabDraggable,        setFabDraggable]        = usePersistentState('lc-m-fab-draggable', false);

  // ── Settings: Font ────────────────────────────────────────────────────────
  const [fontPreference,      setFontPreference]      = usePersistentState('lc-m-font-preference', 'system');

  // ── Settings: Time Zones ──────────────────────────────────────────────────
  const [timezones, setTimezones] = usePersistentState('lc-m-timezones', ['America/New_York']);

  // ── Settings: Budgets ──────────────────────────────────────────────────────
  const { budgets, setBudget, deleteBudget } = budgetsData;

  // ── Settings: Integrations (Discord/Slack webhooks) ───────────────────────
  const [integrations, setIntegrations] = usePersistentState('lc-m-integrations', []);

  function addIntegration(data) {
    setIntegrations(p => [...p, { ...data, id: Date.now().toString(36), enabled: true }]);
  }
  function updateIntegration(id, updates) {
    setIntegrations(p => p.map(i => i.id === id ? { ...i, ...updates } : i));
  }
  function deleteIntegration(id) {
    setIntegrations(p => p.filter(i => i.id !== id));
  }

  // ── Settings: Profile ─────────────────────────────────────────────────────
  const { profile, setProfile } = profileData;

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

  const T = getTheme(darkMode);

  // ── Effective values: minimalistMode overrides individual toggles ─────────
  const effShowLiveTab         = !minimalistMode && showLiveTab;
  const effShowRealityTab      = !minimalistMode && showRealityTab;
  const effShowFab             = !minimalistMode && showFab;
  const effShowQuickAdd        = !minimalistMode && showQuickAdd;
  const effShowPrecisionToggle = !minimalistMode && showPrecisionToggle;
  const effShowCategoriesMenu  = !minimalistMode && showCategoriesMenu;

  const ctx = {
    auth,
    events:           eventsData,
    habits:           habitsData,
    categoryKeywords: categoryKeywordsData,
    llmSettings,      setLlmSettings,
    weekStart,
    prevWeek:         () => setWeekStart(ws => addDays(ws, -7)),
    nextWeek:         () => setWeekStart(ws => addDays(ws, 7)),
    openParseModal,
    assumeCompleted,  setAssumeCompleted,
    // display settings
    militaryTime,        setMilitaryTime,
    darkMode,            setDarkMode,
    weekNumbers,         setWeekNumbers,
    weekStartsMonday,    setWeekStartsMonday,
    showLiveTab,         setShowLiveTab,
    showRealityTab,      setShowRealityTab,
    defaultView,         setDefaultView,
    pushEnabled,         setPushEnabled,
    // minimalist / UI chrome (raw values for settings screen)
    minimalistMode,      setMinimalistMode,
    showQuickAdd,        setShowQuickAdd,
    showPrecisionToggle, setShowPrecisionToggle,
    showCategoriesMenu,  setShowCategoriesMenu,
    showFab,             setShowFab,
    fabDraggable,        setFabDraggable,
    // effective values (apply minimalistMode — use these in screens)
    effShowLiveTab,
    effShowRealityTab,
    effShowFab,
    effShowQuickAdd,
    effShowPrecisionToggle,
    effShowCategoriesMenu,
    // font
    fontPreference,      setFontPreference,
    // timezones
    timezones,           setTimezones,
    // budgets
    budgets,             setBudget,           deleteBudget,
    // integrations
    integrations,        addIntegration,      updateIntegration,   deleteIntegration,
    // profile
    profile,             setProfile,
    // theme colours (pre-computed so screens don't re-derive on every render)
    T,
    // OTA updates
    updater,
  };

  return (
    <AppContext.Provider value={ctx}>
      <SafeAreaProvider>
        <NavigationContainer>
          <Tab.Navigator
            initialRouteName={defaultView}
            screenOptions={({ route }) => ({
              headerShown: false,
              tabBarIcon: ({ color, size }) => (
                <Ionicons name={TAB_ICONS[route.name]} size={size} color={color} />
              ),
              tabBarActiveTintColor:   T.accent,
              tabBarInactiveTintColor: T.textFaint,
              tabBarStyle: {
                backgroundColor: T.tabBar,
                borderTopColor:  T.tabBorder,
                borderTopWidth:  StyleSheet.hairlineWidth,
              },
              tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
            })}
          >
            <Tab.Screen name="Plan"          component={PlanScreen} />
            {effShowLiveTab    && <Tab.Screen name="Live"          component={LiveScreen} />}
            <Tab.Screen name="Habits"        component={HabitsScreen} />
            {effShowRealityTab && <Tab.Screen name="See Your Life" component={RealityScreen} />}
            <Tab.Screen name="Settings"      component={SettingsScreen} />
          </Tab.Navigator>
        </NavigationContainer>
        <ParseModal
          visible={parseModalVisible}
          initialText={parseModalText}
          onClose={closeParseModal}
        />
        <UpdateBanner updater={updater} T={T} />
        <StatusBar style={darkMode ? 'light' : 'dark'} />
      </SafeAreaProvider>
    </AppContext.Provider>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB' },
});
