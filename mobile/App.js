import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { AppContext } from './src/context/AppContext.js';
import { useAuth } from './src/hooks/useAuth.js';
import { useEvents } from './src/hooks/useEvents.js';
import { getWeekStart, addDays } from './src/lib/utils.js';
import { getTheme } from './src/lib/theme.js';
import { useState } from 'react';

import AuthScreen    from './src/screens/AuthScreen.jsx';
import PlanScreen    from './src/screens/PlanScreen.jsx';
import LiveScreen    from './src/screens/LiveScreen.jsx';
import RealityScreen from './src/screens/RealityScreen.jsx';
import SettingsScreen from './src/screens/SettingsScreen.jsx';

const Tab = createBottomTabNavigator();

const TAB_ICONS = {
  Plan:            'calendar-outline',
  Live:            'time-outline',
  'See Your Life': 'bar-chart-outline',
  Settings:        'settings-outline',
};

export default function App() {
  const auth       = useAuth();
  const eventsData = useEvents(auth.authState);
  const [weekStart, setWeekStart] = useState(getWeekStart());

  // ── Settings: Display ─────────────────────────────────────────────────────
  const [militaryTime,        setMilitaryTime]        = useState(false);
  const [darkMode,            setDarkMode]            = useState(false);
  const [weekNumbers,         setWeekNumbers]         = useState(false);
  const [weekStartsMonday,    setWeekStartsMonday]    = useState(false);
  const [showLiveTab,         setShowLiveTab]         = useState(true);
  const [showRealityTab,      setShowRealityTab]      = useState(true);
  const [defaultView,         setDefaultView]         = useState('Plan');
  const [pushEnabled,         setPushEnabled]         = useState(false);

  // ── Settings: Minimalist / UI chrome ──────────────────────────────────────
  const [minimalistMode,      setMinimalistMode]      = useState(false);
  const [showQuickAdd,        setShowQuickAdd]        = useState(true);
  const [showPrecisionToggle, setShowPrecisionToggle] = useState(true);
  const [showCategoriesMenu,  setShowCategoriesMenu]  = useState(true);
  const [showFab,             setShowFab]             = useState(true);
  const [fabDraggable,        setFabDraggable]        = useState(false);

  // ── Settings: Font ────────────────────────────────────────────────────────
  const [fontPreference,      setFontPreference]      = useState('system');

  // ── Settings: Time Zones ──────────────────────────────────────────────────
  const [timezones, setTimezones] = useState(['America/New_York']);

  // ── Settings: Budgets ─────────────────────────────────────────────────────
  const [budgets, setBudgets] = useState({}); // { [categoryId]: hours }

  function setBudget(id, hours)  { setBudgets(p => ({ ...p, [id]: hours })); }
  function deleteBudget(id)      { setBudgets(p => { const n = { ...p }; delete n[id]; return n; }); }

  // ── Settings: Integrations (Discord/Slack webhooks) ───────────────────────
  const [integrations, setIntegrations] = useState([]);

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
  const [profile, setProfile] = useState({
    username:        '',
    displayName:     '',
    email:           '',
    birthday:        '',
    homeAddress:     '',
    otherAddresses:  [],   // [{ id, label, address }]
    phones:          [],   // [{ id, label, number }]
  });

  // Loading
  if (auth.authState === 'checking') {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color="#7C3AED" size="large" />
        <StatusBar style="dark" />
      </View>
    );
  }

  // Auth required
  if (auth.authState === 'setup' || auth.authState === 'login' || auth.authState === 'offline') {
    return (
      <SafeAreaProvider>
        <AuthScreen
          authState={auth.authState}
          onSetup={auth.setup}
          onLogin={auth.login}
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
    events:              eventsData,
    weekStart,
    prevWeek:            () => setWeekStart(ws => addDays(ws, -7)),
    nextWeek:            () => setWeekStart(ws => addDays(ws, 7)),
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
            <Tab.Screen name="Plan"     component={PlanScreen} />
            {effShowLiveTab    && <Tab.Screen name="Live"          component={LiveScreen} />}
            {effShowRealityTab && <Tab.Screen name="See Your Life" component={RealityScreen} />}
            <Tab.Screen name="Settings" component={SettingsScreen} />
          </Tab.Navigator>
        </NavigationContainer>
        <StatusBar style={darkMode ? 'light' : 'dark'} />
      </SafeAreaProvider>
    </AppContext.Provider>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB' },
});
