import { useState, useEffect, useRef } from 'react';
import { DEFAULT_CATEGORIES } from './lib/constants';

// ── Common IANA timezones for the timezone picker ─────────────────────────────
const COMMON_TIMEZONES = [
  { id: 'America/New_York',              label: 'New York (ET)' },
  { id: 'America/Chicago',              label: 'Chicago (CT)' },
  { id: 'America/Denver',               label: 'Denver (MT)' },
  { id: 'America/Los_Angeles',          label: 'Los Angeles (PT)' },
  { id: 'America/Anchorage',            label: 'Alaska (AKT)' },
  { id: 'Pacific/Honolulu',             label: 'Hawaii (HST)' },
  { id: 'America/Toronto',              label: 'Toronto (ET)' },
  { id: 'America/Vancouver',            label: 'Vancouver (PT)' },
  { id: 'America/Phoenix',              label: 'Phoenix (MST)' },
  { id: 'America/Mexico_City',          label: 'Mexico City (CT)' },
  { id: 'America/Sao_Paulo',            label: 'São Paulo (BRT)' },
  { id: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires (ART)' },
  { id: 'America/Bogota',               label: 'Bogotá (COT)' },
  { id: 'Europe/London',                label: 'London (GMT/BST)' },
  { id: 'Europe/Paris',                 label: 'Paris (CET)' },
  { id: 'Europe/Berlin',                label: 'Berlin (CET)' },
  { id: 'Europe/Rome',                  label: 'Rome (CET)' },
  { id: 'Europe/Madrid',                label: 'Madrid (CET)' },
  { id: 'Europe/Amsterdam',             label: 'Amsterdam (CET)' },
  { id: 'Europe/Stockholm',             label: 'Stockholm (CET)' },
  { id: 'Europe/Moscow',                label: 'Moscow (MSK)' },
  { id: 'Europe/Istanbul',              label: 'Istanbul (TRT)' },
  { id: 'Africa/Cairo',                 label: 'Cairo (EET)' },
  { id: 'Africa/Lagos',                 label: 'Lagos (WAT)' },
  { id: 'Africa/Johannesburg',          label: 'Johannesburg (SAST)' },
  { id: 'Africa/Nairobi',               label: 'Nairobi (EAT)' },
  { id: 'Asia/Dubai',                   label: 'Dubai (GST)' },
  { id: 'Asia/Karachi',                 label: 'Karachi (PKT)' },
  { id: 'Asia/Kolkata',                 label: 'Kolkata / Mumbai (IST)' },
  { id: 'Asia/Dhaka',                   label: 'Dhaka (BST)' },
  { id: 'Asia/Bangkok',                 label: 'Bangkok (ICT)' },
  { id: 'Asia/Singapore',               label: 'Singapore (SGT)' },
  { id: 'Asia/Shanghai',                label: 'Shanghai / Beijing (CST)' },
  { id: 'Asia/Hong_Kong',               label: 'Hong Kong (HKT)' },
  { id: 'Asia/Tokyo',                   label: 'Tokyo (JST)' },
  { id: 'Asia/Seoul',                   label: 'Seoul (KST)' },
  { id: 'Australia/Sydney',             label: 'Sydney (AEST)' },
  { id: 'Australia/Melbourne',          label: 'Melbourne (AEST)' },
  { id: 'Australia/Perth',              label: 'Perth (AWST)' },
  { id: 'Pacific/Auckland',             label: 'Auckland (NZST)' },
  { id: 'Pacific/Fiji',                 label: 'Fiji (FJT)' },
  { id: 'UTC',                          label: 'UTC / GMT+0' },
];

const PRESET_COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#EAB308',
  '#22C55E', '#10B981', '#06B6D4', '#3B82F6',
  '#6366F1', '#8B5CF6', '#A855F7', '#EC4899',
  '#6B7280', '#374151',
];
import { getWeekStart, addDays, formatShortDate, generateRepeatInstances, generateId } from './lib/utils';
import { useEvents, IMPORT_COLORS } from './hooks/useEvents';
import { useHabits } from './hooks/useHabits';
import { useBudgets } from './hooks/useBudgets';
import { useIntegrations } from './hooks/useIntegrations';
import { useCrypto } from './context/CryptoContext';
import { deriveKey, generateSalt, generateVerifyBlob, verifyKey, encryptField, decryptField, isBase64 } from './lib/crypto';
import { eventsToIcal, parseIcal, parseIcalCalName, parseRrule, icalToAppEvent, downloadIcal } from './lib/ical';
import { exportDiffCsv, exportDiffJson, exportDiffPdf } from './lib/exportUtils';
import PlanView from './views/PlanView';
import ActualView from './views/ActualView';
import DiffView from './views/DiffView';
import SearchModal from './components/SearchModal';
import TutorialModal from './components/TutorialModal';
import QuickAddFAB from './components/QuickAddFAB';
import AuthGate from './components/AuthGate';
import { useAuth } from './hooks/useAuth';
import { useProfile } from './hooks/useProfile';
import InstallPrompt from './components/InstallPrompt';

const TABS = [
  { id: 'plan', label: 'Plan' },
  { id: 'actual', label: 'Live' },
  { id: 'reality', label: 'See Your Life' },
];

const FONT_PRESETS = [
  { key: 'system',       label: 'System (Default)',      value: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", googleUrl: null,        group: 'Default' },
  { key: 'opendyslexic', label: 'OpenDyslexic',          value: "'OpenDyslexic', sans-serif",          googleUrl: 'https://fonts.cdnfonts.com/css/opendyslexic',                                                     group: 'Accessibility' },
  { key: 'atkinson',     label: 'Atkinson Hyperlegible', value: "'Atkinson Hyperlegible', sans-serif",  googleUrl: 'https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&display=swap',        group: 'Accessibility' },
  { key: 'lexend',       label: 'Lexend',                value: "'Lexend', sans-serif",                 googleUrl: 'https://fonts.googleapis.com/css2?family=Lexend:wght@400;600&display=swap',                       group: 'Accessibility' },
  { key: 'inter',        label: 'Inter',                 value: "'Inter', sans-serif",                  googleUrl: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap',                        group: 'Sans-serif' },
  { key: 'nunito',       label: 'Nunito',                value: "'Nunito', sans-serif",                 googleUrl: 'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600&display=swap',                       group: 'Sans-serif' },
  { key: 'opensans',     label: 'Open Sans',             value: "'Open Sans', sans-serif",              googleUrl: 'https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600&display=swap',                    group: 'Sans-serif' },
  { key: 'merriweather', label: 'Merriweather',          value: "'Merriweather', serif",                googleUrl: 'https://fonts.googleapis.com/css2?family=Merriweather:wght@400;700&display=swap',                 group: 'Serif' },
  { key: 'lora',         label: 'Lora',                  value: "'Lora', serif",                        googleUrl: 'https://fonts.googleapis.com/css2?family=Lora:wght@400;600&display=swap',                         group: 'Serif' },
  { key: 'jetbrains',    label: 'JetBrains Mono',        value: "'JetBrains Mono', monospace",          googleUrl: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&display=swap',               group: 'Monospace' },
];

function fmtKeybind(kb) {
  if (!kb) return '';
  const parts = [];
  if (kb.ctrl)  parts.push('Ctrl');
  if (kb.alt)   parts.push('Alt');
  if (kb.shift) parts.push('Shift');
  if (kb.meta)  parts.push('⌘');
  const k = kb.key;
  parts.push(k === ' ' ? 'Space' : k.length === 1 ? k.toUpperCase() : k);
  return parts.join('+');
}

/**
 * Parse raw ICS text into app events for a given calendar, expanding RRULEs.
 * Shared by file imports and URL subscriptions.
 */
function icsToAppEvents(content, calendar, precision, calId, calColor) {
  const parsed = parseIcal(content);
  return parsed.flatMap(p => {
    const ev = icalToAppEvent(p, calendar, precision);
    if (!ev) return [];
    const base = { ...ev, source_calendar_id: calId, color: calColor };
    const rrule = parseRrule(p.rrule);
    if (!rrule) return [base];
    let instances = generateRepeatInstances(base, rrule.repeat);
    if (rrule.untilDate) instances = instances.filter(e => {
      const d = new Date(e.week_start + 'T00:00:00');
      d.setDate(d.getDate() + e.day_of_week);
      return d <= rrule.untilDate;
    });
    if (rrule.count) instances = instances.slice(0, rrule.count);
    return instances.map(e => ({ ...e, source_calendar_id: calId, color: calColor }));
  });
}

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${checked ? 'bg-blue-500' : 'bg-gray-200 dark:bg-gray-600'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-4' : ''}`} />
    </button>
  );
}

export default function App() {
  const { authState, zkInfo, isAdmin, accountEmail, register, login, logout, continueOffline, markUnlocked, setAccountEmail } = useAuth();
  const [activeTab, setActiveTab] = useState('plan');
  const [weekStart, setWeekStart] = useState(() => getWeekStart());
  const [theme, setTheme] = useState(() => localStorage.getItem('lc-theme') || 'light');
  const [militaryTime, setMilitaryTime] = useState(() => localStorage.getItem('lc-military') === 'true');
  const [enabledViews, setEnabledViews] = useState(() => {
    try { return JSON.parse(localStorage.getItem('lc-enabled-views') || '[]'); } catch { return []; }
  });
  const [showWeekNumbers, setShowWeekNumbers] = useState(() => localStorage.getItem('lc-week-numbers') === 'true');
  const [pinnedCategories, setPinnedCategories] = useState(() => {
    try {
      const stored = localStorage.getItem('lc-pinned-cats');
      return stored ? JSON.parse(stored) : ['sleep', 'work', 'school', 'personal', 'free-time'];
    } catch { return ['sleep', 'work', 'school', 'personal', 'free-time']; }
  });
  const [showSettings, setShowSettings] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [connectedOpen, setConnectedOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [habitsOpen, setHabitsOpen] = useState(false);
  const [budgetsOpen, setBudgetsOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [zkOpen, setZkOpen] = useState(false);
  const [zkEnabling, setZkEnabling] = useState(false);
  const [zkPassword, setZkPassword] = useState('');
  const [zkProgress, setZkProgress] = useState(null); // null | 'deriving' | 'encrypting' | 'done' | 'error'
  const [addIntegrationOpen, setAddIntegrationOpen] = useState(false);
  const [newIntType, setNewIntType] = useState('discord_webhook');
  const [newIntLabel, setNewIntLabel] = useState('');
  const [newIntUrl, setNewIntUrl] = useState('');
  const [intTestState, setIntTestState] = useState({}); // { [id]: 'testing'|'ok'|'error' }
  // ── Admin panel ──────────────────────────────────────────────────────────
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminUsers, setAdminUsers] = useState(null);   // null until first load
  const [adminError, setAdminError] = useState('');
  const [adminPwdDrafts, setAdminPwdDrafts] = useState({}); // { [userId]: newPassword }
  const [pendingDeleteUser, setPendingDeleteUser] = useState(null);
  const [accountEmailDraft, setAccountEmailDraft] = useState('');
  const [accountEmailMsg, setAccountEmailMsg] = useState('');
  // ── Calendar subscriptions (ICS URLs) + outbound feed ────────────────────
  const [subUrl, setSubUrl] = useState('');
  const [subBusy, setSubBusy] = useState(false);
  const [subError, setSubError] = useState('');
  const [syncingCalId, setSyncingCalId] = useState(null);
  const [feedInfo, setFeedInfo] = useState(null);   // null (not loaded) | { enabled, path? }
  const [feedCopied, setFeedCopied] = useState(false);
  // ── User profile ─────────────────────────────────────────────────────────
  const { profile, setProfile, syncProfile } = useProfile(authState);
  // Drafts for the settings form (so edits don't commit until the user saves)
  const [birthdayDraft,    setBirthdayDraft]    = useState(profile.birthday    || '');
  const [homeAddrDraft,    setHomeAddrDraft]    = useState(profile.homeAddress || '');
  const [usernameDraft,    setUsernameDraft]    = useState(profile.username    || '');
  const [displayNameDraft, setDisplayNameDraft] = useState(profile.displayName || '');
  const [emailDraft,       setEmailDraft]       = useState(profile.email       || '');
  const [addingAddr, setAddingAddr] = useState(false);
  const [newAddrLabel, setNewAddrLabel] = useState('');
  const [newAddrValue, setNewAddrValue] = useState('');
  const [editingAddrId, setEditingAddrId] = useState(null);
  const [editAddrDraft, setEditAddrDraft] = useState({ label: '', address: '' });
  const [pendingDeleteAddr, setPendingDeleteAddr] = useState(null);
  const [addingPhone, setAddingPhone] = useState(false);
  const [newPhoneLabel, setNewPhoneLabel] = useState('');
  const [newPhoneValue, setNewPhoneValue] = useState('');
  const [editingPhoneId, setEditingPhoneId] = useState(null);
  const [editPhoneDraft, setEditPhoneDraft] = useState({ label: '', number: '' });
  const [pendingDeletePhone, setPendingDeletePhone] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  // ── PWA share target ──────────────────────────────────────────────────────
  const [shareText, setShareText] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    const t = p.get('share_text') || '';
    if (t) window.history.replaceState({}, '', '/');
    return t;
  });

  const [pendingDeleteCategory, setPendingDeleteCategory] = useState(null);
  const [editingCatColor, setEditingCatColor] = useState(null);
  const [editingCatLabel, setEditingCatLabel] = useState(null);
  const [catLabelDraft, setCatLabelDraft] = useState('');
  const [colorConflictPending, setColorConflictPending] = useState(null); // { catId, color, isNew }
  const [addingCat, setAddingCat] = useState(false);
  const [newCatLabel, setNewCatLabel] = useState('');
  const [newCatColor, setNewCatColor] = useState('#3B82F6');
  const [newCatPickingColor, setNewCatPickingColor] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchJump, setSearchJump] = useState(null); // { tab, dayOfWeek, _id }
  const [fabVisible, setFabVisible]   = useState(() => localStorage.getItem('lc-fab-visible') !== 'false');
  // ── Font picker ─────────────────────────────────────────────────────────
  const [fontKey, setFontKey] = useState(() => localStorage.getItem('lc-font-key') || 'system');
  const [customFont, setCustomFont] = useState(() => {
    try { return JSON.parse(localStorage.getItem('lc-custom-font') || 'null'); } catch { return null; }
  });
  const [fontSearch, setFontSearch] = useState('');
  // ── Minimalist mode ──────────────────────────────────────────────────────
  const [minimalistMode,      setMinimalistMode]      = useState(() => localStorage.getItem('lc-minimalist')         === 'true');
  const [showLiveTab,         setShowLiveTab]         = useState(() => localStorage.getItem('lc-show-live-tab')      !== 'false');
  const [showRealityTab,      setShowRealityTab]      = useState(() => localStorage.getItem('lc-show-reality-tab')   !== 'false');
  const [searchBarVisible,    setSearchBarVisible]    = useState(() => localStorage.getItem('lc-show-search')        !== 'false');
  const [precisionVisible,    setPrecisionVisible]    = useState(() => localStorage.getItem('lc-show-precision')     !== 'false');
  const [categoriesVisible,   setCategoriesVisible]   = useState(() => localStorage.getItem('lc-show-categories')    !== 'false');
  const [fabDraggable, setFabDraggable] = useState(() => localStorage.getItem('lc-fab-draggable') === 'true');
  const [fabPosResetKey, setFabPosResetKey] = useState(0);
  const [settingsSearch, setSettingsSearch] = useState('');
  const [searchKeybind, setSearchKeybind] = useState(() => {
    try { const s = localStorage.getItem('lc-search-keybind'); return s ? JSON.parse(s) : null; }
    catch { return null; }
  });
  const [searchOptionsOpen, setSearchOptionsOpen] = useState(false);
  const [recordingKeybind, setRecordingKeybind] = useState(false);
  const [keybindError, setKeybindError] = useState('');
  const [timezones, setTimezones] = useState(() => {
    try {
      const s = localStorage.getItem('lc-timezones');
      if (s) { const a = JSON.parse(s); if (Array.isArray(a) && a.length) return a; }
    } catch { /* ignore */ }
    return [Intl.DateTimeFormat().resolvedOptions().timeZone];
  });
  const [timezonesOpen, setTimezonesOpen] = useState(false);
  const [addingTz, setAddingTz]           = useState(false);
  const [tzSearch,  setTzSearch]          = useState('');
  const [planPrecision, setPlanPrecision] = useState(1);
  const [livePrecision, setLivePrecision] = useState(1);
  const [exportFormat, setExportFormat] = useState('csv');
  const [showTutorial, setShowTutorial] = useState(false);
  const [showTabMenu, setShowTabMenu] = useState(false);
  const [mobileDefaultView, setMobileDefaultView] = useState(
    () => localStorage.getItem('lc-mobile-default-view') || 'month'
  );
  const [exporting, setExporting] = useState(false);
  const [importNotice, setImportNotice] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null); // cal id or '__legacy_plan' / '__legacy_actual'
  const [editingCalColor, setEditingCalColor] = useState(null); // linked calendar id being color-edited
  const diffStateRef = useRef(null);

  useEffect(() => { localStorage.setItem('lc-theme', theme); }, [theme]);
  useEffect(() => { localStorage.setItem('lc-military', militaryTime); }, [militaryTime]);
  useEffect(() => { localStorage.setItem('lc-enabled-views', JSON.stringify(enabledViews)); }, [enabledViews]);
  useEffect(() => { localStorage.setItem('lc-week-numbers', showWeekNumbers); }, [showWeekNumbers]);
  useEffect(() => { localStorage.setItem('lc-pinned-cats', JSON.stringify(pinnedCategories)); }, [pinnedCategories]);
  // lc-profile localStorage is managed by useProfile hook
  useEffect(() => { localStorage.setItem('lc-fab-visible',   String(fabVisible));   }, [fabVisible]);
  useEffect(() => { localStorage.setItem('lc-fab-draggable', String(fabDraggable)); }, [fabDraggable]);
  useEffect(() => { localStorage.setItem('lc-minimalist',       String(minimalistMode));    }, [minimalistMode]);
  useEffect(() => { localStorage.setItem('lc-show-live-tab',    String(showLiveTab));       }, [showLiveTab]);
  useEffect(() => { localStorage.setItem('lc-show-reality-tab', String(showRealityTab));    }, [showRealityTab]);
  useEffect(() => { localStorage.setItem('lc-show-search',      String(searchBarVisible));  }, [searchBarVisible]);
  useEffect(() => { localStorage.setItem('lc-show-precision',   String(precisionVisible));  }, [precisionVisible]);
  useEffect(() => { localStorage.setItem('lc-show-categories',  String(categoriesVisible)); }, [categoriesVisible]);
  useEffect(() => { localStorage.setItem('lc-font-key', fontKey); }, [fontKey]);
  useEffect(() => {
    if (customFont) localStorage.setItem('lc-custom-font', JSON.stringify(customFont));
    else localStorage.removeItem('lc-custom-font');
  }, [customFont]);
  // Apply selected font to the whole app via CSS variable
  useEffect(() => {
    const preset = FONT_PRESETS.find(f => f.key === fontKey);
    if (fontKey === 'custom' && customFont) {
      let styleEl = document.getElementById('lc-custom-font-style');
      if (!styleEl) { styleEl = document.createElement('style'); styleEl.id = 'lc-custom-font-style'; document.head.appendChild(styleEl); }
      styleEl.textContent = `@font-face { font-family: 'LCCustom'; src: url('${customFont.dataUrl}'); }`;
      document.documentElement.style.setProperty('--lc-font', "'LCCustom', sans-serif");
    } else if (preset) {
      let linkEl = document.getElementById('lc-font-link');
      if (preset.googleUrl) {
        if (!linkEl) { linkEl = document.createElement('link'); linkEl.id = 'lc-font-link'; linkEl.rel = 'stylesheet'; document.head.appendChild(linkEl); }
        linkEl.href = preset.googleUrl;
      } else {
        document.getElementById('lc-font-link')?.remove();
      }
      document.documentElement.style.setProperty('--lc-font', preset.value);
    }
  }, [fontKey, customFont]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { localStorage.setItem('lc-timezones', JSON.stringify(timezones)); }, [timezones]);
  useEffect(() => { localStorage.setItem('lc-mobile-default-view', mobileDefaultView); }, [mobileDefaultView]);
  useEffect(() => {
    if (searchKeybind) localStorage.setItem('lc-search-keybind', JSON.stringify(searchKeybind));
    else localStorage.removeItem('lc-search-keybind');
  }, [searchKeybind]);

  // Ctrl+K / Cmd+K (default) + optional custom keybind open search
  useEffect(() => {
    function matchCustom(e) {
      if (!searchKeybind) return false;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const kb  = searchKeybind;
      return key === (kb.key.length === 1 ? kb.key.toLowerCase() : kb.key)
        && !!e.ctrlKey  === !!kb.ctrl
        && !!e.altKey   === !!kb.alt
        && !!e.shiftKey === !!kb.shift
        && !!e.metaKey  === !!kb.meta;
    }
    function handleKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setShowSearch(s => !s); return; }
      if (matchCustom(e)) { e.preventDefault(); setShowSearch(s => !s); }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [searchKeybind]);

  // Auto-generate all-day birthday plan events for the next 5 years whenever
  // the saved birthday changes. replaceEventsBySource atomically swaps them out.
  useEffect(() => {
    if (!profile.birthday) {
      replaceEventsBySource('birthday', []);
      return;
    }
    const [, mStr, dStr] = profile.birthday.split('-');
    const month = parseInt(mStr, 10);
    const day   = parseInt(dStr,  10);
    const thisYear = new Date().getFullYear();
    const events = [];
    for (let y = thisYear; y <= thisYear + 4; y++) {
      const date = new Date(y, month - 1, day);
      events.push({
        label: '🎂 Birthday', category: 'personal', color: '#A855F7',
        week_start: getWeekStart(date), day_of_week: date.getDay(),
        slot_start: 0, slot_duration: 0, precision: 1,
        calendar: 'plan', is_all_day: true, source: 'birthday',
      });
    }
    replaceEventsBySource('birthday', events);
  }, [profile.birthday]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Effective feature flags (minimalist mode overrides individual settings) ──
  const eff = {
    showLiveTab:        !minimalistMode && showLiveTab,
    showRealityTab:     !minimalistMode && showRealityTab,
    searchBar:          !minimalistMode && searchBarVisible,
    precisionToggle:    !minimalistMode && precisionVisible,
    categoriesMenu:     !minimalistMode && categoriesVisible,
    fabVisible:         !minimalistMode && fabVisible,
    showWeekNumbers:    !minimalistMode && showWeekNumbers,
    enabledViews:       minimalistMode  ? [] : enabledViews,
  };

  const visibleTabs = TABS.filter(t =>
    (t.id !== 'actual'  || eff.showLiveTab) &&
    (t.id !== 'reality' || eff.showRealityTab)
  );

  // If the active tab gets hidden, fall back to plan
  useEffect(() => {
    if (!visibleTabs.find(t => t.id === activeTab)) setActiveTab('plan');
  }, [eff.showLiveTab, eff.showRealityTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auth handlers (ZK key derivation happens client-side) ────────────────
  async function handleRegister(email, password) {
    // ZK on by default: derive the master key locally before the account
    // exists; the server only ever sees the salt + verification blob.
    const salt = generateSalt();
    const key  = await deriveKey(password, salt);
    const blob = await generateVerifyBlob(key);
    await register(email, password, salt, blob);
    setMasterKey(key);
    setIsZkEnabled(true);
    markUnlocked();
  }

  async function handleLogin(email, password) {
    const res = await login(email, password);
    if (res.zk_enabled) {
      const key = await deriveKey(password, res.kdf_salt);
      if (await verifyKey(key, res.zk_verify)) {
        setMasterKey(key);
        setIsZkEnabled(true);
        markUnlocked();
      }
      // verify failed (e.g. admin reset the password) — stay 'locked';
      // AuthGate prompts for the previous/encryption password.
    }
  }

  async function handleUnlock(password) {
    if (!zkInfo) return;
    const key = await deriveKey(password, zkInfo.kdf_salt);
    if (!(await verifyKey(key, zkInfo.zk_verify))) {
      throw new Error('Incorrect password — your data stays encrypted until the right one is entered.');
    }
    setMasterKey(key);
    setIsZkEnabled(true);
    markUnlocked();
  }

  // ── Admin panel actions ───────────────────────────────────────────────────
  async function loadAdminUsers() {
    setAdminError('');
    try { setAdminUsers(await api.admin.listUsers()); }
    catch (err) { setAdminError(err.message); }
  }

  async function handleAdminBlock(userId, blocked) {
    try { await api.admin.setBlocked(userId, blocked); await loadAdminUsers(); }
    catch (err) { setAdminError(err.message); }
  }

  async function handleAdminResetPassword(userId) {
    const pwd = adminPwdDrafts[userId];
    if (!pwd || pwd.length < 8) { setAdminError('New password must be at least 8 characters.'); return; }
    try {
      await api.admin.resetPassword(userId, pwd);
      setAdminPwdDrafts(d => { const n = { ...d }; delete n[userId]; return n; });
      setAdminError('');
    } catch (err) { setAdminError(err.message); }
  }

  async function handleAdminDelete(userId) {
    try { await api.admin.deleteUser(userId); setPendingDeleteUser(null); await loadAdminUsers(); }
    catch (err) { setAdminError(err.message); }
  }

  async function handleSetAccountEmail() {
    if (!accountEmailDraft.trim()) return;
    setAccountEmailMsg('');
    try {
      await setAccountEmail(accountEmailDraft.trim());
      setAccountEmailMsg('Login email saved.');
      setAccountEmailDraft('');
    } catch (err) { setAccountEmailMsg(err.message); }
  }

  async function handleEnableZk() {
    if (!zkPassword.trim()) return;
    setZkProgress('deriving');
    try {
      // Resume an interrupted migration with the same salt — generating a
      // fresh one on retry would double-encrypt whatever already succeeded
      // last time (ciphertext encrypted again, with the original plaintext
      // unrecoverable). Fields already encrypted are skipped via isBase64.
      const resumeSalt = localStorage.getItem('lc-zk-migration-salt');
      const salt = resumeSalt || generateSalt();
      if (!resumeSalt) localStorage.setItem('lc-zk-migration-salt', salt);

      const key  = await deriveKey(zkPassword, salt);
      const blob = await generateVerifyBlob(key);
      setZkProgress('encrypting');
      // Encrypt existing events and habits — straight to the API so local
      // state (and the UI) keeps showing plaintext.
      const allEvents  = getEvents('plan').concat(getEvents('actual'));
      for (const ev of allEvents) {
        const updates = {};
        if (ev.label && !isBase64(ev.label)) updates.label = await encryptField(key, ev.label);
        if (ev.notes && !isBase64(ev.notes)) updates.notes = await encryptField(key, ev.notes);
        if (Object.keys(updates).length) await api.events.update(ev.id, updates);
      }
      for (const h of habits) {
        if (h.label && !isBase64(h.label)) {
          await api.habits.update(h.id, { label: await encryptField(key, h.label) });
        }
      }
      // Encrypt profile fields (username stays plaintext)
      const encField = async (val) => (val && !isBase64(val)) ? await encryptField(key, val) : (val || null);
      const encProfile = {
        username:       profile.username || null,
        displayName:    await encField(profile.displayName),
        email:          await encField(profile.email),
        phones:         profile.phones?.length      ? await encField(JSON.stringify(profile.phones))          : profile.phones,
        birthday:       await encField(profile.birthday),
        homeAddress:    await encField(profile.homeAddress),
        otherAddresses: profile.otherAddresses?.length ? await encField(JSON.stringify(profile.otherAddresses)) : profile.otherAddresses,
      };
      await api.profile.set(encProfile);
      // Only flip the server over to this key once every record above has
      // been safely re-encrypted — otherwise a half-migrated mix of
      // plaintext and ciphertext would be left behind under zk_enabled=false.
      await api.auth.enableZk(salt, blob);
      localStorage.removeItem('lc-zk-migration-salt');
      setMasterKey(key);
      setIsZkEnabled(true);
      await syncProfile(key);
      setZkProgress('done');
      setZkPassword('');
    } catch (err) {
      console.error('ZK enable failed:', err);
      setZkProgress('error');
    }
  }

  async function handleTestIntegration(id) {
    setIntTestState(s => ({ ...s, [id]: 'testing' }));
    try {
      await testIntegration(id);
      setIntTestState(s => ({ ...s, [id]: 'ok' }));
      setTimeout(() => setIntTestState(s => { const n = {...s}; delete n[id]; return n; }), 3000);
    } catch {
      setIntTestState(s => ({ ...s, [id]: 'error' }));
      setTimeout(() => setIntTestState(s => { const n = {...s}; delete n[id]; return n; }), 4000);
    }
  }

  async function handleAddIntegration() {
    if (!newIntLabel.trim()) return;
    const data = { type: newIntType, label: newIntLabel.trim() };
    if (['discord_webhook','slack_webhook','generic_webhook'].includes(newIntType)) {
      if (!newIntUrl.trim()) return;
      data.endpoint_url = newIntUrl.trim();
    }
    await addIntegration(data);
    setNewIntLabel(''); setNewIntUrl(''); setAddIntegrationOpen(false);
  }

  async function handleEnablePush() {
    try {
      await subscribePush();
      await addSchedule({ trigger_type: 'event_reminder', offset_minutes: -30 });
      await addSchedule({ trigger_type: 'habit_reminder', time_of_day: '20:00' });
    } catch (err) {
      console.warn('Push setup failed:', err);
    }
  }

  function handleFontUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      setCustomFont({ name: file.name.replace(/\.[^.]+$/, ''), dataUrl: ev.target.result });
      setFontKey('custom');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  function togglePin(catId) {
    setPinnedCategories(prev =>
      prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]
    );
  }

  function openManageCategories() {
    setShowSettings(true);
    setCategoriesOpen(true);
  }

  function handleSearchNavigate(event) {
    const tab = event._calendar === 'plan' ? 'plan' : 'actual';
    setActiveTab(tab);
    setWeekStart(getWeekStart(new Date(event.week_start + 'T00:00:00')));
    setSearchJump({ tab, dayOfWeek: event.day_of_week ?? 0, _id: Date.now() });
  }

  const {
    events = [],
    customCategories, categoryOverrides,
    addEvent, addEvents, updateEvent, deleteEvent,
    getWeekEvents, getEvents,
    addCategory, deleteCategory, updateCategory,
    deletedDefaultIds = [], replaceEventsBySource = () => {},
    replaceEventsBySourceCalendar = () => {},
    linkedCalendars = [],
    addLinkedCalendar = () => ({ id: null, color: '#6B7280' }),
    deleteLinkedCalendar = () => {},
    updateLinkedCalendar = () => {},
    updateLinkedCalendarColor = () => {},
    updateLinkedCalendarExclude = () => {},
    clearLegacyEvents = () => {},
    syncing = false,
  } = useEvents(authState);

  const { budgets, setBudget, deleteBudget } = useBudgets(authState);
  const { habits, habitsWithStreaks, completions, addHabit, updateHabit, deleteHabit, toggleCompletion } = useHabits(authState);
  const { integrations, schedules, addIntegration, updateIntegration, deleteIntegration, testIntegration, addSchedule, deleteSchedule, subscribePush, unsubscribePush } = useIntegrations(authState);
  const { masterKey, isZkEnabled, setMasterKey, setIsZkEnabled } = useCrypto();

  const allCategories = [...DEFAULT_CATEGORIES, ...customCategories]
    .filter(cat => !deletedDefaultIds.includes(cat.id))
    .map(cat => ({ ...cat, ...(categoryOverrides[cat.id] || {}) }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const planEvents = getEvents('plan');
  const actualEvents = getEvents('actual');
  const weekPlanEvents = getWeekEvents(weekStart, 'plan');
  const weekActualEvents = getWeekEvents(weekStart, 'actual');
  const weekEnd = addDays(weekStart, 6);

  function toggleView(v) {
    setEnabledViews(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);
  }

  function showImportNotice(added) {
    const msg = added > 0
      ? `${added} event${added !== 1 ? 's' : ''} imported`
      : 'No events found in file';
    setImportNotice(msg);
    setTimeout(() => setImportNotice(null), 5000);
  }

  function handlePlanExportIcal() {
    downloadIcal(eventsToIcal(planEvents, 'Life Calendar – Plan'), 'life-calendar-plan.ics');
  }
  function handlePlanImportIcal(e) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const content = ev.target.result;
      const calName = parseIcalCalName(content) || file.name.replace(/\.ics$/i, '');
      const { id: calId, color: calColor } = addLinkedCalendar({
        name: calName,
        filename: file.name,
        calendar: 'plan',
        importedAt: new Date().toISOString().split('T')[0],
      });
      const appEvents = icsToAppEvents(content, 'plan', planPrecision, calId, calColor);
      if (appEvents.length > 0) addEvents(appEvents);
      showImportNotice(appEvents.length);
    };
    reader.readAsText(file); e.target.value = '';
  }

  // ── Calendar subscriptions (auto-refreshing ICS URLs) ────────────────────
  async function handleSubscribeUrl() {
    const url = subUrl.trim();
    if (!url) return;
    setSubBusy(true); setSubError('');
    const calendar = activeTab === 'actual' ? 'actual' : 'plan';
    const precision = calendar === 'plan' ? planPrecision : livePrecision;
    try {
      const { ics } = await api.ical.fetch(url);
      const calName = parseIcalCalName(ics) || new URL(url.replace(/^webcal:/, 'https:')).hostname;
      const { id: calId, color: calColor } = addLinkedCalendar({
        name: calName,
        calendar,
        url,
        syncEnabled: true,
        importedAt: new Date().toISOString().split('T')[0],
        lastSyncedAt: Math.floor(Date.now() / 1000),
      });
      const appEvents = icsToAppEvents(ics, calendar, precision, calId, calColor);
      replaceEventsBySourceCalendar(calId, appEvents);
      showImportNotice(appEvents.length);
      setSubUrl('');
    } catch (err) {
      setSubError(err.message ?? 'Could not subscribe to this calendar.');
    } finally {
      setSubBusy(false);
    }
  }

  async function syncSubscribedCalendar(cal) {
    const precision = cal.calendar === 'plan' ? planPrecision : livePrecision;
    const { ics } = await api.ical.fetch(cal.url);
    const appEvents = icsToAppEvents(ics, cal.calendar, precision, cal.id, cal.color);
    replaceEventsBySourceCalendar(cal.id, appEvents);
    updateLinkedCalendar(cal.id, { lastSyncedAt: Math.floor(Date.now() / 1000) });
  }

  async function handleSyncNow(cal) {
    setSyncingCalId(cal.id);
    try { await syncSubscribedCalendar(cal); }
    catch (err) { console.warn('Calendar sync failed:', err); }
    finally { setSyncingCalId(null); }
  }

  // Auto-refresh all subscribed calendars shortly after login and every 30 min.
  const syncSubsRef = useRef(() => {});
  syncSubsRef.current = async () => {
    for (const cal of linkedCalendars) {
      if (!cal.url || !cal.syncEnabled) continue;
      try { await syncSubscribedCalendar(cal); }
      catch (err) { console.warn(`Sync failed for "${cal.name}":`, err); }
    }
  };
  useEffect(() => {
    if (authState !== 'ready') return;
    const t  = setTimeout(()  => syncSubsRef.current(), 8000);
    const iv = setInterval(() => syncSubsRef.current(), 30 * 60 * 1000);
    return () => { clearTimeout(t); clearInterval(iv); };
  }, [authState]);

  // Load outbound feed status once the Connected Calendars section opens
  useEffect(() => {
    if (!connectedOpen || authState !== 'ready' || feedInfo !== null) return;
    api.feed.status().then(setFeedInfo).catch(() => {});
  }, [connectedOpen, authState]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleFeedToggle() {
    try {
      if (feedInfo?.enabled) {
        await api.feed.disable();
        setFeedInfo({ enabled: false });
      } else {
        setFeedInfo(await api.feed.enable());
      }
    } catch (err) { console.warn('Feed toggle failed:', err); }
  }

  function handleCopyFeedUrl() {
    if (!feedInfo?.path) return;
    navigator.clipboard?.writeText(`${window.location.origin}${feedInfo.path}`);
    setFeedCopied(true);
    setTimeout(() => setFeedCopied(false), 2000);
  }

  function handleLiveExportIcal() {
    downloadIcal(eventsToIcal(actualEvents, 'Life Calendar – Live'), 'life-calendar-live.ics');
  }
  function handleLiveImportIcal(e) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const content = ev.target.result;
      const calName = parseIcalCalName(content) || file.name.replace(/\.ics$/i, '');
      const { id: calId, color: calColor } = addLinkedCalendar({
        name: calName,
        filename: file.name,
        calendar: 'actual',
        importedAt: new Date().toISOString().split('T')[0],
      });
      const appEvents = icsToAppEvents(content, 'actual', livePrecision, calId, calColor);
      if (appEvents.length > 0) addEvents(appEvents);
      showImportNotice(appEvents.length);
    };
    reader.readAsText(file); e.target.value = '';
  }

  async function handleRealityCheckExport() {
    if (!diffStateRef.current) return;
    setExporting(true);
    try {
      const { diff, startDate, endDate } = diffStateRef.current;
      if (exportFormat === 'csv') exportDiffCsv(diff, startDate, endDate);
      else if (exportFormat === 'json') exportDiffJson(diff, startDate, endDate);
      else await exportDiffPdf(diff, startDate, endDate);
    } finally {
      setExporting(false);
    }
  }

  // ── Settings search helpers ──────────────────────────────────────────────
  const sq = settingsSearch.trim().toLowerCase();
  const SECTION_KWS = {
    appearance: ['appearance', 'dark', 'theme', 'mode', 'military', 'time', 'week', 'numbers', 'views', 'quarter', 'half', 'floating', 'button', 'drag', 'mobile', 'phone', 'default', 'view', 'minimalist', 'minimal', 'simple', 'live', 'reality', 'search', 'precision', 'categories', 'font', 'typeface', 'dyslexic', 'opendyslexic', 'readable', 'accessibility', 'text', 'upload'],
    search:     ['search', 'shortcut', 'keybind', 'keyboard', 'hotkey', 'find'],
    categories: ['category', 'categories', 'color', 'label', 'tag'],
    connected:  ['connected', 'calendar', 'calendars', 'import', 'export', 'ics', 'subscribe', 'subscription', 'url', 'feed', 'publish', 'google', 'outlook', 'apple', 'sync', 'webcal'],
    account:    ['account', 'profile', 'user', 'birthday', 'address', 'home', 'username', 'display', 'name', 'email', 'phone', 'phones'],
    linked:     ['linked', 'calendar', 'calendars', 'sync', 'source'],
    timezone:   ['timezone', 'time zone', 'zone', 'clock', 'utc', 'gmt', 'world', 'international', 'country'],
    habits:        ['habit', 'habits', 'streak', 'routine', 'check-in', 'checkin', 'daily', 'tracker'],
    budgets:       ['budget', 'budgets', 'target', 'hours', 'weekly', 'goal', 'time budget'],
    notifications: ['notification', 'notifications', 'push', 'discord', 'slack', 'webhook', 'reminder', 'alert', 'integration', 'integrations', 'remind'],
    zk:            ['encrypt', 'encryption', 'zero-knowledge', 'privacy', 'secure', 'security', 'bitwarden', 'zk', 'password', 'private'],
    admin:         ['admin', 'administrator', 'users', 'accounts', 'manage users', 'block', 'ban', 'reset password', 'moderation'],
  };
  // sv: is this section visible given the current search query?
  function sv(kws) { return !sq || kws.some(kw => kw.includes(sq)); }
  // so: should this section be open? (force-open when search matches)
  function so(open, kws) { return (!!sq && kws.some(kw => kw.includes(sq))) || open; }
  const settingsNoResults = !!sq && !Object.values(SECTION_KWS).some(kws => sv(kws));

  // Show auth screen when not yet authenticated (or ZK-locked)
  if (['checking', 'setup', 'login', 'locked', 'offline'].includes(authState)) {
    return (
      <AuthGate
        authState={authState}
        onLogin={handleLogin}
        onRegister={handleRegister}
        onUnlock={handleUnlock}
        onLogout={logout}
        onContinueOffline={continueOffline}
        theme={theme}
      />
    );
  }
  // authState === 'ready' or 'offline-ok' → render the full app below

  return (
    <div className={theme === 'dark' ? 'dark' : ''}>
      {importNotice && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium pointer-events-none">
          <span>✓</span>
          <span>{importNotice}</span>
        </div>
      )}
      {showSearch && (
        <SearchModal
          planEvents={planEvents}
          actualEvents={actualEvents}
          allCategories={allCategories}
          militaryTime={militaryTime}
          onNavigate={handleSearchNavigate}
          onClose={() => setShowSearch(false)}
        />
      )}
      {showTutorial && (
        <TutorialModal onClose={() => setShowTutorial(false)} />
      )}
      <div className="flex flex-col h-[100dvh] bg-white dark:bg-gray-900 overflow-hidden pl-safe pr-safe">
        {/* Header */}
        <header className="relative flex items-center justify-between gap-4 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 bg-white dark:bg-gray-900" style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))' }}>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-base font-bold text-gray-900 dark:text-gray-100 whitespace-nowrap">PLS Calendar</span>
            {syncing && (
              <span title="Syncing…" className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse flex-shrink-0" />
            )}
            {authState === 'offline-ok' && (
              <span title="Offline — data saved locally" className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
            )}
            {/* Search button */}
            {eff.searchBar && (
            <button
              type="button"
              onClick={() => setShowSearch(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300 transition-colors text-sm"
              aria-label="Search events"
              title={`Search events (Ctrl+K${searchKeybind ? ` / ${fmtKeybind(searchKeybind)}` : ''})`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
              <span className="hidden sm:inline text-xs">Search</span>
              <kbd className="hidden md:inline-flex items-center text-[10px] border border-gray-200 dark:border-gray-600 rounded px-1 py-0.5 font-mono text-gray-400 dark:text-gray-500">
                {searchKeybind ? fmtKeybind(searchKeybind) : '⌘K'}
              </kbd>
            </button>
            )}
          </div>

          {/* Center tab label — visible when tab pills are hidden (< lg) */}
          <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none hidden sm:block lg:hidden">
            <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
              {activeTab === 'plan' ? 'Plan' : activeTab === 'actual' ? 'Live' : 'See Your Life'}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Tab switcher — mobile/tablet: dropdown, wide desktop: pills */}
            <div className="relative lg:hidden">
              <button
                type="button"
                onClick={() => setShowTabMenu(s => !s)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-sm font-semibold text-gray-900 dark:text-white"
              >
                {visibleTabs.find(t => t.id === activeTab)?.label}
                <svg className={`w-3.5 h-3.5 text-gray-500 dark:text-gray-400 transition-transform ${showTabMenu ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showTabMenu && (
                <>
                  <div className="fixed inset-0 z-[60]" onClick={() => setShowTabMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden z-[70]">
                    {visibleTabs.map(tab => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => { setActiveTab(tab.id); setShowTabMenu(false); }}
                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                          activeTab === tab.id
                            ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white font-semibold'
                            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <nav className="hidden lg:flex gap-1 rounded-lg bg-gray-100 dark:bg-gray-800 p-1">
              {visibleTabs.map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>

            {/* Settings button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowSettings(s => !s)}
                className={`p-2 rounded-lg transition-colors text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 ${showSettings ? 'bg-gray-100 dark:bg-gray-700' : ''}`}
                aria-label="Settings"
              >
                ⚙
              </button>

              {showSettings && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => { setShowSettings(false); setEditingCalColor(null); setSettingsSearch(''); }} />
                  <div className="absolute right-0 top-10 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-4 z-50 w-72 max-w-[calc(100vw-0.5rem)] max-h-[80vh] overflow-y-auto">
                    <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Settings</p>

                    {/* Settings search filter */}
                    <div className="relative mb-3">
                      <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                      </svg>
                      <input
                        type="text"
                        placeholder="Search settings…"
                        value={settingsSearch}
                        onChange={e => setSettingsSearch(e.target.value)}
                        className="w-full pl-7 pr-6 py-1.5 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 border border-transparent focus:border-blue-400 dark:focus:border-blue-500 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 outline-none transition-colors"
                      />
                      {settingsSearch && (
                        <button
                          type="button"
                          onClick={() => setSettingsSearch('')}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-base leading-none"
                        >×</button>
                      )}
                    </div>

                    <div className="space-y-1">

                      {/* ── Appearance (collapsible) ── */}
                      {sv(SECTION_KWS.appearance) && (
                      <div className="rounded-lg overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setAppearanceOpen(v => !v)}
                          className="flex items-center justify-between w-full px-2 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Appearance</span>
                          <span className="text-[10px] text-gray-400 dark:text-gray-500">{so(appearanceOpen, SECTION_KWS.appearance) ? '▲' : '▼'}</span>
                        </button>
                        {so(appearanceOpen, SECTION_KWS.appearance) && (
                          <div className="px-2 pb-2 space-y-3">
                            {/* ── Minimalist Mode ── */}
                            {sv(['minimalist', 'minimal', 'simple', 'live', 'reality', 'search', 'precision', 'categories']) && (
                              <div className="space-y-2">
                                <label className="flex items-center justify-between gap-3 cursor-pointer">
                                  <div>
                                    <span className="text-sm text-gray-700 dark:text-gray-200 font-medium">Most Minimal</span>
                                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Hides everything below for a clean, distraction-free experience</p>
                                  </div>
                                  <Toggle checked={minimalistMode} onChange={() => setMinimalistMode(v => !v)} />
                                </label>
                                <div className={`space-y-2 pl-2 border-l-2 border-gray-100 dark:border-gray-700 ${minimalistMode ? 'opacity-40 pointer-events-none' : ''}`}>
                                  {sv(['live']) && (
                                    <label className="flex items-center justify-between gap-3 cursor-pointer">
                                      <span className="text-sm text-gray-600 dark:text-gray-400">Live Calendar tab</span>
                                      <Toggle checked={showLiveTab} onChange={() => setShowLiveTab(v => !v)} />
                                    </label>
                                  )}
                                  {sv(['reality', 'see your life']) && (
                                    <label className="flex items-center justify-between gap-3 cursor-pointer">
                                      <span className="text-sm text-gray-600 dark:text-gray-400">See Your Life tab</span>
                                      <Toggle checked={showRealityTab} onChange={() => setShowRealityTab(v => !v)} />
                                    </label>
                                  )}
                                  {sv(['floating', 'button', 'quick add']) && (
                                    <label className="flex items-center justify-between gap-3 cursor-pointer">
                                      <span className="text-sm text-gray-600 dark:text-gray-400">Quick Add button</span>
                                      <Toggle checked={fabVisible} onChange={() => setFabVisible(v => !v)} />
                                    </label>
                                  )}
                                  {sv(['search']) && (
                                    <label className="flex items-center justify-between gap-3 cursor-pointer">
                                      <span className="text-sm text-gray-600 dark:text-gray-400">Search bar</span>
                                      <Toggle checked={searchBarVisible} onChange={() => setSearchBarVisible(v => !v)} />
                                    </label>
                                  )}
                                  {sv(['precision', '30m', '1h']) && (
                                    <label className="flex items-center justify-between gap-3 cursor-pointer">
                                      <span className="text-sm text-gray-600 dark:text-gray-400">Precision toggle (30m / 1h)</span>
                                      <Toggle checked={precisionVisible} onChange={() => setPrecisionVisible(v => !v)} />
                                    </label>
                                  )}
                                  {sv(['categories']) && (
                                    <label className="flex items-center justify-between gap-3 cursor-pointer">
                                      <span className="text-sm text-gray-600 dark:text-gray-400">Categories menu</span>
                                      <Toggle checked={categoriesVisible} onChange={() => setCategoriesVisible(v => !v)} />
                                    </label>
                                  )}
                                  {sv(['views', 'quarter', 'half', 'extra']) && (
                                    <label className="flex items-center justify-between gap-3 cursor-pointer">
                                      <span className="text-sm text-gray-600 dark:text-gray-400">Quarter & Half-year views</span>
                                      <Toggle
                                        checked={enabledViews.length > 0}
                                        onChange={() => setEnabledViews(v => v.length > 0 ? [] : ['quarter', 'half'])}
                                      />
                                    </label>
                                  )}
                                  {sv(['week', 'numbers']) && (
                                    <label className="flex items-center justify-between gap-3 cursor-pointer">
                                      <span className="text-sm text-gray-600 dark:text-gray-400">Week numbers</span>
                                      <Toggle checked={showWeekNumbers} onChange={() => setShowWeekNumbers(v => !v)} />
                                    </label>
                                  )}
                                </div>
                              </div>
                            )}
                            {/* ── Font Picker ── */}
                            {sv(['font', 'typeface', 'dyslexic', 'opendyslexic', 'readable', 'accessibility', 'text', 'upload']) && (
                              <div className={`space-y-2${!sq ? ' border-t border-gray-100 dark:border-gray-700 pt-3' : ''}`}>
                                <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Font</p>
                                {/* Search */}
                                <div className="relative">
                                  <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                                  </svg>
                                  <input
                                    type="text"
                                    placeholder="Search fonts…"
                                    value={fontSearch}
                                    onChange={e => setFontSearch(e.target.value)}
                                    className="w-full pl-6 pr-2 py-1 text-xs rounded-md bg-gray-100 dark:bg-gray-700 border border-transparent focus:border-blue-400 text-gray-800 dark:text-gray-200 placeholder-gray-400 outline-none"
                                  />
                                </div>
                                {/* Preset list */}
                                <div className="space-y-0.5 max-h-48 overflow-y-auto">
                                  {FONT_PRESETS
                                    .filter(f => !fontSearch || f.label.toLowerCase().includes(fontSearch.toLowerCase()) || f.group.toLowerCase().includes(fontSearch.toLowerCase()))
                                    .map(f => (
                                      <button
                                        key={f.key}
                                        type="button"
                                        onClick={() => { setFontKey(f.key); setFontSearch(''); }}
                                        className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-left transition-colors ${
                                          fontKey === f.key
                                            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                            : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                                        }`}
                                      >
                                        <div className="flex items-center gap-2 min-w-0">
                                          <span className={`w-3 h-3 rounded-full flex-shrink-0 border-2 ${fontKey === f.key ? 'border-blue-500 bg-blue-500' : 'border-gray-300 dark:border-gray-500'}`} />
                                          <span className="text-xs truncate">{f.label}</span>
                                          <span className="text-[10px] text-gray-400 dark:text-gray-500 flex-shrink-0">{f.group}</span>
                                        </div>
                                        <span className="text-sm flex-shrink-0" style={{ fontFamily: f.value }}>Abc</span>
                                      </button>
                                    ))
                                  }
                                  {/* Custom font row */}
                                  {(!fontSearch || 'custom upload'.includes(fontSearch.toLowerCase())) && (
                                    <div className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-md ${fontKey === 'custom' ? 'bg-blue-50 dark:bg-blue-900/30' : ''}`}>
                                      <div className="flex items-center gap-2 min-w-0">
                                        <span className={`w-3 h-3 rounded-full flex-shrink-0 border-2 ${fontKey === 'custom' ? 'border-blue-500 bg-blue-500' : 'border-gray-300 dark:border-gray-500'}`} />
                                        <span className="text-xs text-gray-700 dark:text-gray-300 truncate">
                                          {customFont ? customFont.name : 'Upload custom…'}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1 flex-shrink-0">
                                        {customFont && (
                                          <button
                                            type="button"
                                            onClick={() => { setCustomFont(null); setFontKey('system'); }}
                                            className="text-[10px] text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                                            title="Remove custom font"
                                          >✕</button>
                                        )}
                                        <label className="cursor-pointer text-[10px] text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition-colors">
                                          {customFont ? 'Replace' : 'Upload'}
                                          <input type="file" accept=".ttf,.otf,.woff,.woff2" className="hidden" onChange={handleFontUpload} />
                                        </label>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            <div className={`space-y-3${!sq ? ' border-t border-gray-100 dark:border-gray-700 pt-3' : ''}`}>
                            {sv(['dark', 'mode', 'theme']) && (
                              <label className="flex items-center justify-between gap-3 cursor-pointer">
                                <span className="text-sm text-gray-600 dark:text-gray-400">Dark mode</span>
                                <Toggle checked={theme === 'dark'} onChange={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} />
                              </label>
                            )}
                            {sv(['military', 'time']) && (
                              <label className="flex items-center justify-between gap-3 cursor-pointer">
                                <span className="text-sm text-gray-600 dark:text-gray-400">Military time</span>
                                <Toggle checked={militaryTime} onChange={() => setMilitaryTime(t => !t)} />
                              </label>
                            )}
                            {sv(['week', 'numbers', 'month', 'view']) && (
                              <label className="flex items-center justify-between gap-3 cursor-pointer">
                                <span className="text-sm text-gray-600 dark:text-gray-400">Week numbers in month view</span>
                                <Toggle checked={showWeekNumbers} onChange={() => setShowWeekNumbers(v => !v)} />
                              </label>
                            )}
                            {/* ── Mobile default view ── */}
                            {sv(['mobile', 'phone', 'default', 'view']) && (
                              <div className={`pt-1 space-y-2${!sq ? ' border-t border-gray-100 dark:border-gray-700' : ''}`}>
                                <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider pt-2">Mobile default view</p>
                                <p className="text-xs text-gray-400 dark:text-gray-500 -mt-1">What view opens first on phones</p>
                                <div className="flex gap-1 rounded-lg bg-gray-100 dark:bg-gray-700 p-1">
                                  {[{ id: 'day', label: 'Day' }, { id: 'week', label: 'Week' }, { id: 'month', label: 'Month' }].map(v => (
                                    <button
                                      key={v.id}
                                      type="button"
                                      onClick={() => setMobileDefaultView(v.id)}
                                      className={`flex-1 py-1 rounded-md text-xs font-medium transition-colors ${
                                        mobileDefaultView === v.id
                                          ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                                          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                                      }`}
                                    >
                                      {v.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* ── Floating Button Options ── */}
                            {sv(['floating', 'button', 'drag', 'show']) && (
                              <div className={`pt-1 space-y-2${!sq ? ' border-t border-gray-100 dark:border-gray-700' : ''}`}>
                                <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider pt-2">Floating Button</p>
                                <label className="flex items-center justify-between gap-3 cursor-pointer">
                                  <span className="text-sm text-gray-600 dark:text-gray-400">Show floating button</span>
                                  <Toggle checked={fabVisible} onChange={() => setFabVisible(v => !v)} />
                                </label>
                                {fabVisible && (
                                  <>
                                    <label className="flex items-center justify-between gap-3 cursor-pointer">
                                      <span className="text-sm text-gray-600 dark:text-gray-400">Allow dragging</span>
                                      <Toggle checked={fabDraggable} onChange={() => setFabDraggable(v => !v)} />
                                    </label>
                                    {fabDraggable && (
                                      <button
                                        type="button"
                                        onClick={() => setFabPosResetKey(k => k + 1)}
                                        className="w-full text-left text-sm text-gray-500 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                      >
                                        ↺ Reset button position
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                            )}
                            {sv(['views', 'quarter', 'half', 'extra']) && (
                              <div className={`pt-1 space-y-2${!sq ? ' border-t border-gray-100 dark:border-gray-700' : ''}`}>
                                <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider pt-2">Extra views</p>
                                {[{ id: 'quarter', label: 'Quarter view' }, { id: 'half', label: 'Half-year view' }].map(v => (
                                  <label key={v.id} className="flex items-center gap-2.5 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={enabledViews.includes(v.id)}
                                      onChange={() => toggleView(v.id)}
                                      className="w-4 h-4 rounded accent-blue-500"
                                    />
                                    <span className="text-sm text-gray-600 dark:text-gray-400">{v.label}</span>
                                  </label>
                                ))}
                              </div>
                            )}
                            </div>{/* end other-settings wrapper */}
                          </div>
                        )}
                      </div>
                      )}

                      {/* ── Search Options (collapsible) ── */}
                      {sv(SECTION_KWS.search) && (
                      <div className="rounded-lg overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setSearchOptionsOpen(v => !v)}
                          className="flex items-center justify-between w-full px-2 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Search Options</span>
                          <span className="text-[10px] text-gray-400 dark:text-gray-500">{so(searchOptionsOpen, SECTION_KWS.search) ? '▲' : '▼'}</span>
                        </button>
                        {so(searchOptionsOpen, SECTION_KWS.search) && (
                          <div className="px-2 pb-3 space-y-3">
                            <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-snug">
                              Set a custom keyboard shortcut to open search. The default <kbd className="px-1 py-0.5 text-[10px] rounded border border-gray-200 dark:border-gray-600 font-mono">Ctrl+K</kbd> / <kbd className="px-1 py-0.5 text-[10px] rounded border border-gray-200 dark:border-gray-600 font-mono">⌘K</kbd> always works alongside it.
                            </p>

                            <div>
                              <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5">Custom shortcut</p>

                              {/* Recorder button */}
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onKeyDown={e => {
                                    if (!recordingKeybind) return;
                                    e.preventDefault();
                                    e.stopPropagation();
                                    // Ignore bare modifier presses
                                    if (['Control','Alt','Shift','Meta'].includes(e.key)) return;
                                    // Require at least one modifier
                                    if (!e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) {
                                      setKeybindError('Add a modifier key — Ctrl, Alt, or Shift — to avoid conflicts.');
                                      return;
                                    }
                                    // Block Ctrl+K / Cmd+K (already the default)
                                    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                                      setKeybindError('Ctrl+K / ⌘K is already the default — pick a different combo.');
                                      return;
                                    }
                                    setSearchKeybind({ key: e.key, ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey, meta: e.metaKey });
                                    setKeybindError('');
                                    setRecordingKeybind(false);
                                  }}
                                  onBlur={() => { setRecordingKeybind(false); setKeybindError(''); }}
                                  onClick={() => { setRecordingKeybind(true); setKeybindError(''); }}
                                  className={`flex-1 text-left text-sm px-3 py-2 rounded-lg border transition-colors focus:outline-none ${
                                    recordingKeybind
                                      ? 'border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 animate-pulse'
                                      : searchKeybind
                                        ? 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                        : 'border-dashed border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 hover:border-gray-400 dark:hover:border-gray-500'
                                  }`}
                                >
                                  {recordingKeybind ? (
                                    <span className="flex items-center gap-1.5">
                                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping inline-block" />
                                      Press your key combo…
                                    </span>
                                  ) : searchKeybind ? (
                                    <kbd className="font-mono font-semibold">{fmtKeybind(searchKeybind)}</kbd>
                                  ) : (
                                    'Click to record shortcut'
                                  )}
                                </button>

                                {/* Cancel / Clear */}
                                {recordingKeybind ? (
                                  <button
                                    type="button"
                                    onClick={() => { setRecordingKeybind(false); setKeybindError(''); }}
                                    className="text-xs px-2.5 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                  >Cancel</button>
                                ) : searchKeybind ? (
                                  <button
                                    type="button"
                                    onClick={() => { setSearchKeybind(null); setKeybindError(''); }}
                                    className="text-xs px-2.5 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-800 transition-colors"
                                  >Clear</button>
                                ) : null}
                              </div>

                              {/* Error */}
                              {keybindError && (
                                <p className="mt-1.5 text-[11px] text-red-500 dark:text-red-400 leading-snug">{keybindError}</p>
                              )}

                              {/* Confirmation */}
                              {searchKeybind && !recordingKeybind && !keybindError && (
                                <p className="mt-1.5 text-[11px] text-green-600 dark:text-green-400">
                                  ✓ <kbd className="font-mono">{fmtKeybind(searchKeybind)}</kbd> will open search
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      )}

                      {/* ── Time Zones (collapsible) ── */}
                      {sv(SECTION_KWS.timezone) && (
                      <div className="rounded-lg overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setTimezonesOpen(v => !v)}
                          className="flex items-center justify-between w-full px-2 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Time Zones</span>
                          <span className="text-[10px] text-gray-400 dark:text-gray-500">{so(timezonesOpen, SECTION_KWS.timezone) ? '▲' : '▼'}</span>
                        </button>
                        {so(timezonesOpen, SECTION_KWS.timezone) && (
                          <div className="px-2 pb-3 space-y-2">
                            <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-snug">
                              Set your primary time zone and add up to 4 more for quick reference — handy for cross-timezone meetings.
                            </p>

                            {/* Timezone list */}
                            <div className="space-y-1">
                              {timezones.map((tz, idx) => {
                                let timeStr = '';
                                try {
                                  timeStr = new Intl.DateTimeFormat(undefined, {
                                    timeZone: tz, hour: '2-digit', minute: '2-digit',
                                    hour12: !militaryTime,
                                  }).format(new Date());
                                } catch { timeStr = '—'; }
                                const tzInfo = COMMON_TIMEZONES.find(t => t.id === tz);
                                const tzLabel = tzInfo?.label ?? tz.replace(/_/g, ' ');
                                return (
                                  <div key={tz} className="flex items-center gap-2 py-0.5 px-1">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        {idx === 0 && (
                                          <span className="text-[9px] font-bold text-blue-500 dark:text-blue-400 uppercase tracking-wider border border-blue-300 dark:border-blue-700 rounded px-1">Primary</span>
                                        )}
                                        <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{tzLabel}</span>
                                      </div>
                                      <p className="text-xs font-mono text-gray-400 dark:text-gray-500 mt-0.5">{timeStr}</p>
                                    </div>
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                      {idx > 0 && (
                                        <button
                                          type="button"
                                          title="Make primary"
                                          onClick={() => setTimezones(prev => {
                                            const next = [...prev];
                                            next.splice(idx, 1);
                                            next.unshift(tz);
                                            return next;
                                          })}
                                          className="w-6 h-6 flex items-center justify-center rounded text-gray-300 dark:text-gray-600 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-sm"
                                          title="Set as primary"
                                        >↑</button>
                                      )}
                                      <button
                                        type="button"
                                        disabled={timezones.length === 1}
                                        onClick={() => setTimezones(prev => prev.filter((_, i) => i !== idx))}
                                        className="w-6 h-6 flex items-center justify-center rounded text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-base leading-none disabled:opacity-30 disabled:cursor-not-allowed"
                                        title="Remove"
                                      >×</button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Add timezone */}
                            {timezones.length < 5 && !addingTz && (
                              <button
                                type="button"
                                onClick={() => { setAddingTz(true); setTzSearch(''); }}
                                className="w-full text-left text-sm text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                              >+ Add time zone</button>
                            )}
                            {timezones.length >= 5 && (
                              <p className="text-[11px] text-gray-400 dark:text-gray-500 px-1">Maximum of 5 time zones reached.</p>
                            )}

                            {addingTz && (
                              <div className="space-y-1.5">
                                <input
                                  autoFocus
                                  type="text"
                                  placeholder="Search city or timezone…"
                                  value={tzSearch}
                                  onChange={e => setTzSearch(e.target.value)}
                                  className="w-full text-sm bg-gray-100 dark:bg-gray-700 rounded-lg px-2.5 py-1.5 text-gray-900 dark:text-white outline-none border border-gray-200 dark:border-gray-600 focus:border-blue-400 dark:focus:border-blue-500 placeholder-gray-400 dark:placeholder-gray-500"
                                />
                                {tzSearch.length >= 1 && (
                                  <div className="max-h-36 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-sm">
                                    {COMMON_TIMEZONES.filter(t =>
                                      !timezones.includes(t.id) &&
                                      (t.label.toLowerCase().includes(tzSearch.toLowerCase()) ||
                                       t.id.toLowerCase().includes(tzSearch.toLowerCase()))
                                    ).length === 0 ? (
                                      <p className="text-xs text-gray-400 dark:text-gray-500 px-3 py-2 text-center">No matches</p>
                                    ) : (
                                      COMMON_TIMEZONES.filter(t =>
                                        !timezones.includes(t.id) &&
                                        (t.label.toLowerCase().includes(tzSearch.toLowerCase()) ||
                                         t.id.toLowerCase().includes(tzSearch.toLowerCase()))
                                      ).map(t => (
                                        <button
                                          key={t.id} type="button"
                                          onClick={() => { setTimezones(prev => [...prev, t.id]); setAddingTz(false); setTzSearch(''); }}
                                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-0"
                                        >
                                          {t.label}
                                        </button>
                                      ))
                                    )}
                                  </div>
                                )}
                                <button
                                  type="button"
                                  onClick={() => { setAddingTz(false); setTzSearch(''); }}
                                  className="text-xs text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
                                >Cancel</button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      )}

                      {/* ── Manage Categories (collapsible) ── */}
                      {sv(SECTION_KWS.categories) && (
                      <div className="rounded-lg overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setCategoriesOpen(v => !v)}
                          className="flex items-center justify-between w-full px-2 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Manage Categories</span>
                          <span className="text-[10px] text-gray-400 dark:text-gray-500">{so(categoriesOpen, SECTION_KWS.categories) ? '▲' : '▼'}</span>
                        </button>
                        {so(categoriesOpen, SECTION_KWS.categories) && (
                          <div className="px-2 pb-2 space-y-0.5">
                            {allCategories.map(cat => {
                              const isConfirming = pendingDeleteCategory === cat.id;
                              const isPickingColor = editingCatColor === cat.id;
                              const isEditingLabel = editingCatLabel === cat.id;
                              return (
                                <div key={cat.id} className="rounded-lg">
                                  <div className="flex items-center gap-1.5 py-1">
                                    {/* Color dot — click to toggle color picker */}
                                    <button
                                      type="button"
                                      title="Change color"
                                      onClick={() => { setEditingCatColor(isPickingColor ? null : cat.id); setEditingCatLabel(null); setColorConflictPending(null); }}
                                      className="flex-shrink-0 w-4 h-4 rounded-full border-2 hover:scale-110 transition-transform"
                                      style={{ backgroundColor: cat.color, borderColor: isPickingColor ? '#9CA3AF' : 'transparent' }}
                                    />

                                    {/* Label — static or inline input */}
                                    {isEditingLabel ? (
                                      <input
                                        autoFocus
                                        value={catLabelDraft}
                                        onChange={e => setCatLabelDraft(e.target.value)}
                                        onBlur={() => {
                                          const t = catLabelDraft.trim();
                                          if (t && t !== cat.label) updateCategory(cat.id, { label: t });
                                          setEditingCatLabel(null);
                                        }}
                                        onKeyDown={e => {
                                          if (e.key === 'Enter') e.target.blur();
                                          if (e.key === 'Escape') setEditingCatLabel(null);
                                        }}
                                        className="flex-1 min-w-0 text-sm bg-gray-100 dark:bg-gray-700 rounded px-1.5 py-0.5 text-gray-900 dark:text-white outline-none border border-blue-400 dark:border-blue-500"
                                      />
                                    ) : (
                                      <span className="flex-1 min-w-0 text-sm text-gray-700 dark:text-gray-300 truncate">{cat.label}</span>
                                    )}

                                    {/* Pencil — edit label */}
                                    {!isConfirming && !isEditingLabel && (
                                      <button
                                        type="button"
                                        title="Rename category"
                                        onClick={() => { setEditingCatLabel(cat.id); setCatLabelDraft(cat.label); setEditingCatColor(null); }}
                                        className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded text-gray-300 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm leading-none"
                                        title="Edit name"
                                      >✏</button>
                                    )}

                                    {/* Delete */}
                                    {!isConfirming && !isEditingLabel && (
                                      <button
                                        type="button"
                                        onClick={() => { setPendingDeleteCategory(cat.id); setEditingCatColor(null); setEditingCatLabel(null); }}
                                        className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-base leading-none"
                                        title="Delete category"
                                      >×</button>
                                    )}
                                  </div>

                                  {/* Inline color picker */}
                                  {isPickingColor && (
                                    <div className="px-1 pb-2">
                                      {colorConflictPending?.catId === cat.id ? (
                                        <div className="space-y-2 py-1">
                                          <p className="text-xs text-amber-500 dark:text-amber-400 leading-snug">You already have another category with this color. Would you like to continue?</p>
                                          <div className="flex gap-1.5">
                                            <button type="button" onClick={() => { updateCategory(cat.id, { color: colorConflictPending.color }); setEditingCatColor(null); setColorConflictPending(null); }}
                                              className="flex-1 text-xs py-1 rounded bg-blue-500 hover:bg-blue-600 text-white font-medium transition-colors">Yes</button>
                                            <button type="button" onClick={() => setColorConflictPending(null)}
                                              className="flex-1 text-xs py-1 rounded border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">No</button>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="flex flex-wrap gap-1.5">
                                          {PRESET_COLORS.map(c => {
                                            const inUse = allCategories.some(other => other.color === c && other.id !== cat.id);
                                            return (
                                              <button key={c} type="button"
                                                onClick={() => {
                                                  if (inUse) { setColorConflictPending({ catId: cat.id, color: c, isNew: false }); }
                                                  else { updateCategory(cat.id, { color: c }); setEditingCatColor(null); }
                                                }}
                                                className={`w-5 h-5 rounded-full border-2 transition-all hover:scale-110 ${c === cat.color ? 'border-gray-400 dark:border-white scale-110' : 'border-transparent hover:border-gray-300 dark:hover:border-gray-500'}`}
                                                style={{ backgroundColor: c }}
                                              />
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* Delete confirmation */}
                                  {isConfirming && (
                                    <div className="flex items-center gap-2 pb-1.5 pl-0.5">
                                      <span className="text-xs text-red-500 dark:text-red-400 flex-1">Delete "{cat.label}"?</span>
                                      <button
                                        type="button"
                                        onClick={() => setPendingDeleteCategory(null)}
                                        className="text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                      >Cancel</button>
                                      <button
                                        type="button"
                                        onClick={() => { deleteCategory(cat.id); setPendingDeleteCategory(null); }}
                                        className="text-xs px-2 py-1 rounded bg-red-500 hover:bg-red-600 text-white font-medium transition-colors"
                                      >Delete</button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}

                            {/* Add new category form */}
                            {addingCat ? (
                              <div className="pt-1.5 space-y-2">
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    title="Pick color"
                                    onClick={() => setNewCatPickingColor(v => !v)}
                                    className="flex-shrink-0 w-5 h-5 rounded-full border-2 border-gray-300 dark:border-gray-500 hover:scale-110 transition-transform"
                                    style={{ backgroundColor: newCatColor }}
                                  />
                                  <input
                                    autoFocus
                                    value={newCatLabel}
                                    onChange={e => setNewCatLabel(e.target.value)}
                                    placeholder="Category name"
                                    className="flex-1 text-sm bg-gray-100 dark:bg-gray-700 rounded px-2 py-1 text-gray-900 dark:text-white outline-none border border-gray-200 dark:border-gray-600 focus:border-blue-400 dark:focus:border-blue-500 placeholder-gray-400 dark:placeholder-gray-500"
                                    onKeyDown={e => {
                                      if (e.key === 'Enter' && newCatLabel.trim()) {
                                        addCategory({ label: newCatLabel.trim(), color: newCatColor });
                                        setNewCatLabel(''); setAddingCat(false); setNewCatPickingColor(false);
                                      }
                                      if (e.key === 'Escape') { setAddingCat(false); setNewCatPickingColor(false); }
                                    }}
                                  />
                                </div>
                                {newCatPickingColor && (
                                  <div>
                                    {colorConflictPending?.isNew ? (
                                      <div className="space-y-2 py-1 px-1">
                                        <p className="text-xs text-amber-500 dark:text-amber-400 leading-snug">You already have another category with this color. Would you like to continue?</p>
                                        <div className="flex gap-1.5">
                                          <button type="button" onClick={() => { setNewCatColor(colorConflictPending.color); setNewCatPickingColor(false); setColorConflictPending(null); }}
                                            className="flex-1 text-xs py-1 rounded bg-blue-500 hover:bg-blue-600 text-white font-medium transition-colors">Yes</button>
                                          <button type="button" onClick={() => setColorConflictPending(null)}
                                            className="flex-1 text-xs py-1 rounded border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">No</button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="flex flex-wrap gap-1.5 px-1">
                                        {PRESET_COLORS.map(c => {
                                          const inUse = allCategories.some(other => other.color === c);
                                          return (
                                            <button key={c} type="button"
                                              onClick={() => {
                                                if (inUse) { setColorConflictPending({ catId: null, color: c, isNew: true }); }
                                                else { setNewCatColor(c); setNewCatPickingColor(false); }
                                              }}
                                              className={`w-5 h-5 rounded-full border-2 transition-all hover:scale-110 ${c === newCatColor ? 'border-gray-400 dark:border-white scale-110' : 'border-transparent hover:border-gray-300 dark:hover:border-gray-500'}`}
                                              style={{ backgroundColor: c }}
                                            />
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                )}
                                <div className="flex gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => { setAddingCat(false); setNewCatPickingColor(false); setNewCatLabel(''); }}
                                    className="flex-1 text-xs py-1 rounded border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                  >Cancel</button>
                                  <button
                                    type="button"
                                    disabled={!newCatLabel.trim()}
                                    onClick={() => {
                                      if (!newCatLabel.trim()) return;
                                      addCategory({ label: newCatLabel.trim(), color: newCatColor });
                                      setNewCatLabel(''); setAddingCat(false); setNewCatPickingColor(false);
                                    }}
                                    className="flex-1 text-xs py-1 rounded bg-blue-500 hover:bg-blue-600 disabled:opacity-40 text-white font-medium transition-colors"
                                  >Add</button>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => { setAddingCat(true); setNewCatLabel(''); setNewCatColor('#3B82F6'); }}
                                className="w-full text-left text-sm text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors mt-1"
                              >+ Add category</button>
                            )}
                          </div>
                        )}
                      </div>
                      )}

                      {/* ── Time Budgets (collapsible) ── */}
                      {sv(SECTION_KWS.budgets) && (
                      <div className="rounded-lg overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setBudgetsOpen(v => !v)}
                          className="flex items-center justify-between w-full px-2 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Time Budgets</span>
                          <span className="text-[10px] text-gray-400 dark:text-gray-500">{so(budgetsOpen, SECTION_KWS.budgets) ? '▲' : '▼'}</span>
                        </button>
                        {so(budgetsOpen, SECTION_KWS.budgets) && (
                          <div className="px-2 pb-2 space-y-1">
                            <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-snug mb-2">
                              Set weekly hour targets per category. They appear as progress bars in the See Your Life tab.
                            </p>
                            {allCategories.map(cat => {
                              const val = budgets[cat.id] ?? '';
                              return (
                                <div key={cat.id} className="flex items-center gap-2 py-0.5">
                                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                                  <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 truncate">{cat.label}</span>
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    <input
                                      type="number"
                                      min="0"
                                      max="168"
                                      step="0.5"
                                      value={val}
                                      onChange={e => {
                                        const n = parseFloat(e.target.value);
                                        if (e.target.value === '' || isNaN(n)) deleteBudget(cat.id);
                                        else setBudget(cat.id, n);
                                      }}
                                      placeholder="—"
                                      className="w-16 text-sm text-right bg-gray-100 dark:bg-gray-700 rounded-lg px-2 py-1 text-gray-900 dark:text-white outline-none border border-gray-200 dark:border-gray-600 focus:border-blue-400 dark:focus:border-blue-500 placeholder-gray-400"
                                    />
                                    <span className="text-xs text-gray-400 dark:text-gray-500">h/wk</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      )}

                      {/* ── Habit Tracker Settings (collapsible) ── */}
                      {sv(SECTION_KWS.habits) && (
                      <div className="rounded-lg overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setHabitsOpen(v => !v)}
                          className="flex items-center justify-between w-full px-2 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Habit Tracker</span>
                          <span className="text-[10px] text-gray-400 dark:text-gray-500">{so(habitsOpen, SECTION_KWS.habits) ? '▲' : '▼'}</span>
                        </button>
                        {so(habitsOpen, SECTION_KWS.habits) && (
                          <div className="px-2 pb-2 space-y-1">
                            <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-snug mb-2">
                              Manage your daily habits. You can also add, edit, and check off habits directly in the See Your Life tab.
                            </p>
                            {habits.length === 0 && (
                              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-2">No habits yet.</p>
                            )}
                            {habits.map(habit => (
                              <div key={habit.id} className="flex items-center gap-2 py-0.5">
                                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: habit.color }} />
                                <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 truncate">{habit.label}</span>
                                <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
                                  {(habit.target_days ?? [0,1,2,3,4,5,6]).length === 7 ? 'Daily' :
                                   JSON.stringify(habit.target_days) === '[1,2,3,4,5]' ? 'Weekdays' :
                                   JSON.stringify(habit.target_days) === '[0,6]' ? 'Weekends' :
                                   `${(habit.target_days ?? []).length}d/wk`}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => deleteHabit(habit.id)}
                                  className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 dark:text-gray-500 hover:text-red-500 transition-colors flex-shrink-0"
                                  title="Delete habit"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      )}

                      {/* ── Notifications & Integrations (collapsible) ── */}
                      {sv(SECTION_KWS.notifications) && (
                      <div className="rounded-lg overflow-hidden">
                        <button type="button" onClick={() => setNotificationsOpen(v => !v)}
                          className="flex items-center justify-between w-full px-2 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Notifications & Integrations</span>
                          <span className="text-[10px] text-gray-400 dark:text-gray-500">{so(notificationsOpen, SECTION_KWS.notifications) ? '▲' : '▼'}</span>
                        </button>
                        {so(notificationsOpen, SECTION_KWS.notifications) && (
                          <div className="px-2 pb-3 space-y-3">
                            <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-snug">
                              Get reminders via Discord, Slack, or browser push. The app only sends timing info — event labels stay private unless you set an Integration Hint.
                            </p>

                            {/* Browser push */}
                            {'Notification' in window && (
                              <div className="flex items-center justify-between gap-2">
                                <div>
                                  <span className="text-sm text-gray-700 dark:text-gray-200">Browser Push</span>
                                  <p className="text-[10px] text-gray-400 dark:text-gray-500">
                                    {Notification.permission === 'granted' ? 'Enabled' : Notification.permission === 'denied' ? 'Blocked in browser settings' : 'Not enabled'}
                                  </p>
                                </div>
                                {Notification.permission !== 'denied' && (
                                  <button type="button" onClick={handleEnablePush}
                                    className="text-xs px-2.5 py-1.5 rounded-lg bg-violet-500 hover:bg-violet-600 text-white font-medium transition-colors flex-shrink-0">
                                    {Notification.permission === 'granted' ? 'Refresh' : 'Enable'}
                                  </button>
                                )}
                              </div>
                            )}

                            {/* Existing integrations */}
                            {integrations.length > 0 && (
                              <div className="space-y-1.5">
                                {integrations.map(intg => (
                                  <div key={intg.id} className="flex items-center gap-2 py-0.5">
                                    <span className="text-lg leading-none flex-shrink-0">
                                      {intg.type === 'discord_webhook' ? '🎮' : intg.type === 'slack_webhook' ? '💬' : intg.type === 'web_push' ? '🔔' : intg.type === 'expo_push' ? '📱' : '🔗'}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                      <span className="text-sm text-gray-700 dark:text-gray-200 truncate block">{intg.label || intg.type}</span>
                                      <span className="text-[10px] text-gray-400 dark:text-gray-500">{intg.enabled ? 'Active' : 'Disabled'}</span>
                                    </div>
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                      {intTestState[intg.id] === 'ok'      && <span className="text-[10px] text-green-500">✓ sent</span>}
                                      {intTestState[intg.id] === 'error'   && <span className="text-[10px] text-red-500">✗ failed</span>}
                                      {intTestState[intg.id] === 'testing' && <span className="text-[10px] text-gray-400">sending…</span>}
                                      <button type="button" onClick={() => handleTestIntegration(intg.id)}
                                        className="text-[10px] px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">Test</button>
                                      <Toggle checked={intg.enabled} onChange={() => updateIntegration(intg.id, { enabled: !intg.enabled })} />
                                      <button type="button" onClick={() => deleteIntegration(intg.id)}
                                        className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-colors">
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Add integration form */}
                            {addIntegrationOpen ? (
                              <div className="space-y-2 bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                                <select value={newIntType} onChange={e => setNewIntType(e.target.value)}
                                  className="w-full text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1.5 text-gray-900 dark:text-white outline-none">
                                  <option value="discord_webhook">Discord Webhook</option>
                                  <option value="slack_webhook">Slack Webhook</option>
                                  <option value="generic_webhook">Custom Webhook</option>
                                </select>
                                <input value={newIntLabel} onChange={e => setNewIntLabel(e.target.value)}
                                  placeholder="Nickname (e.g. My Discord)"
                                  className="w-full text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1.5 text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:border-blue-400" />
                                {['discord_webhook','slack_webhook','generic_webhook'].includes(newIntType) && (
                                  <input value={newIntUrl} onChange={e => setNewIntUrl(e.target.value)}
                                    placeholder="Webhook URL"
                                    className="w-full text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1.5 text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:border-blue-400" />
                                )}
                                <div className="flex gap-2">
                                  <button type="button" onClick={() => setAddIntegrationOpen(false)}
                                    className="flex-1 text-sm px-3 py-1.5 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 transition-colors">Cancel</button>
                                  <button type="button" onClick={handleAddIntegration}
                                    className="flex-1 text-sm px-3 py-1.5 rounded-lg bg-violet-500 hover:bg-violet-600 text-white font-medium transition-colors">Add</button>
                                </div>
                              </div>
                            ) : (
                              <button type="button" onClick={() => setAddIntegrationOpen(true)}
                                className="w-full text-left text-sm text-violet-500 hover:text-violet-600 dark:text-violet-400 px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                + Add Discord / Slack / Webhook
                              </button>
                            )}

                            {/* Notification schedules summary */}
                            {schedules.length > 0 && (
                              <div className="border-t border-gray-100 dark:border-gray-700 pt-2 space-y-1">
                                <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Active Schedules</p>
                                {schedules.filter(s => s.enabled).map(s => (
                                  <div key={s.id} className="flex items-center justify-between gap-2 text-xs text-gray-600 dark:text-gray-400">
                                    <span>{s.trigger_type === 'event_reminder' ? `Event reminder (${Math.abs(s.offset_minutes)}min before)` : s.trigger_type === 'habit_reminder' ? `Habit reminder at ${s.time_of_day}` : s.trigger_type === 'daily_summary' ? `Daily summary at ${s.time_of_day}` : s.trigger_type}</span>
                                    <button type="button" onClick={() => deleteSchedule(s.id)} className="text-gray-400 hover:text-red-500 transition-colors">✕</button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      )}

                      {/* ── Zero-Knowledge Encryption (collapsible) ── */}
                      {sv(SECTION_KWS.zk) && (
                      <div className="rounded-lg overflow-hidden">
                        <button type="button" onClick={() => setZkOpen(v => !v)}
                          className="flex items-center justify-between w-full px-2 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Zero-Knowledge Encryption</span>
                            {isZkEnabled && <span className="text-[9px] bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded-full font-semibold">ON</span>}
                          </div>
                          <span className="text-[10px] text-gray-400 dark:text-gray-500">{so(zkOpen, SECTION_KWS.zk) ? '▲' : '▼'}</span>
                        </button>
                        {so(zkOpen, SECTION_KWS.zk) && (
                          <div className="px-2 pb-3 space-y-3">
                            {isZkEnabled ? (
                              <div className="flex items-start gap-2 bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
                                <span className="text-lg">🔒</span>
                                <div>
                                  <p className="text-sm font-semibold text-green-800 dark:text-green-300">Encryption is active</p>
                                  <p className="text-[11px] text-green-700 dark:text-green-400 mt-0.5 leading-snug">Your event names and habit labels are encrypted. The server cannot read your content.</p>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 space-y-1">
                                  <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">Before you enable</p>
                                  <ul className="text-[11px] text-amber-700 dark:text-amber-400 space-y-0.5 leading-snug list-disc pl-3">
                                    <li>Your password becomes your encryption key — if you forget it, your data is permanently unreadable</li>
                                    <li>All existing events and habits will be encrypted (one-time migration)</li>
                                    <li>Discord/Slack reminders will show generic text unless you set Integration Hints</li>
                                    <li>This cannot be undone without a full data export and re-import</li>
                                  </ul>
                                </div>
                                {zkProgress === 'done' ? (
                                  <p className="text-sm text-green-600 dark:text-green-400 font-medium">✓ Encryption enabled successfully</p>
                                ) : zkProgress === 'error' ? (
                                  <p className="text-sm text-red-500">Something went wrong. Please try again.</p>
                                ) : (
                                  <>
                                    <input
                                      type="password"
                                      value={zkPassword}
                                      onChange={e => setZkPassword(e.target.value)}
                                      placeholder="Confirm your password to enable encryption"
                                      className="w-full text-sm bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1.5 text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:border-blue-400"
                                    />
                                    <button type="button"
                                      disabled={!zkPassword.trim() || zkProgress === 'deriving' || zkProgress === 'encrypting'}
                                      onClick={handleEnableZk}
                                      className="w-full text-sm px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white font-semibold transition-colors">
                                      {zkProgress === 'deriving'   ? 'Deriving key…' :
                                       zkProgress === 'encrypting' ? 'Encrypting data…' :
                                       'Enable Zero-Knowledge Encryption'}
                                    </button>
                                  </>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                      )}

                      {/* ── Admin Panel (collapsible, admins only) ── */}
                      {isAdmin && sv(SECTION_KWS.admin) && (
                      <div className="rounded-lg overflow-hidden">
                        <button type="button"
                          onClick={() => { setAdminOpen(v => !v); if (!adminUsers) loadAdminUsers(); }}
                          className="flex items-center justify-between w-full px-2 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Admin · Manage Users</span>
                            <span className="text-[9px] bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 px-1.5 py-0.5 rounded-full font-semibold">ADMIN</span>
                          </div>
                          <span className="text-[10px] text-gray-400 dark:text-gray-500">{so(adminOpen, SECTION_KWS.admin) ? '▲' : '▼'}</span>
                        </button>
                        {so(adminOpen, SECTION_KWS.admin) && (
                          <div className="px-2 pb-3 space-y-2">
                            <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-snug">
                              Zero-trust: you can only see account emails — never anyone's calendar, profile, or encrypted data.
                            </p>
                            {adminError && <p className="text-xs text-red-500">{adminError}</p>}
                            {adminUsers === null ? (
                              <p className="text-xs text-gray-400">Loading…</p>
                            ) : adminUsers.map(u => (
                              <div key={u.id} className="rounded-lg border border-gray-200 dark:border-gray-700 p-2 space-y-1.5">
                                <div className="flex items-center justify-between gap-2 min-w-0">
                                  <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{u.email ?? '(no email — legacy account)'}</span>
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    {u.role === 'admin' && <span className="text-[9px] bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 px-1.5 py-0.5 rounded-full font-semibold">ADMIN</span>}
                                    {u.zk_enabled && <span className="text-[9px] bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded-full font-semibold">ZK</span>}
                                    {u.is_blocked && <span className="text-[9px] bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 px-1.5 py-0.5 rounded-full font-semibold">BLOCKED</span>}
                                  </div>
                                </div>
                                <p className="text-[10px] text-gray-400 dark:text-gray-500">Joined {new Date(u.created_at * 1000).toLocaleDateString()}</p>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <input
                                    type="password"
                                    value={adminPwdDrafts[u.id] ?? ''}
                                    onChange={e => setAdminPwdDrafts(d => ({ ...d, [u.id]: e.target.value }))}
                                    placeholder="New password"
                                    className="flex-1 min-w-[120px] text-xs bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1 text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:border-blue-400"
                                  />
                                  <button type="button" onClick={() => handleAdminResetPassword(u.id)}
                                    disabled={!(adminPwdDrafts[u.id]?.length >= 8)}
                                    className="text-xs px-2 py-1 rounded-lg bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 disabled:opacity-40 text-gray-700 dark:text-gray-200 font-medium transition-colors">
                                    Reset
                                  </button>
                                  <button type="button" onClick={() => handleAdminBlock(u.id, !u.is_blocked)}
                                    className="text-xs px-2 py-1 rounded-lg bg-amber-100 dark:bg-amber-900/40 hover:bg-amber-200 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300 font-medium transition-colors">
                                    {u.is_blocked ? 'Unblock' : 'Block'}
                                  </button>
                                  {pendingDeleteUser === u.id ? (
                                    <>
                                      <button type="button" onClick={() => handleAdminDelete(u.id)}
                                        className="text-xs px-2 py-1 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium transition-colors">
                                        Confirm delete
                                      </button>
                                      <button type="button" onClick={() => setPendingDeleteUser(null)}
                                        className="text-xs px-2 py-1 rounded-lg bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium transition-colors">
                                        Cancel
                                      </button>
                                    </>
                                  ) : (
                                    <button type="button" onClick={() => setPendingDeleteUser(u.id)}
                                      className="text-xs px-2 py-1 rounded-lg bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-900/60 text-red-600 dark:text-red-400 font-medium transition-colors">
                                      Delete
                                    </button>
                                  )}
                                </div>
                                {u.zk_enabled && (adminPwdDrafts[u.id]?.length > 0) && (
                                  <p className="text-[10px] text-amber-600 dark:text-amber-400 leading-snug">
                                    ZK account: after a reset they'll need their previous password to unlock their encrypted data.
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      )}

                      {/* ── Connected Calendars (collapsible) ── */}
                      {(activeTab === 'plan' || activeTab === 'actual') && sv(SECTION_KWS.connected) && (
                        <div className="rounded-lg overflow-hidden">
                          <button
                            type="button"
                            onClick={() => setConnectedOpen(v => !v)}
                            className="flex items-center justify-between w-full px-2 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                          >
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Connected Calendars</span>
                            <span className="text-[10px] text-gray-400 dark:text-gray-500">{so(connectedOpen, SECTION_KWS.connected) ? '▲' : '▼'}</span>
                          </button>
                          {so(connectedOpen, SECTION_KWS.connected) && (
                            <div className="px-2 pb-2 space-y-1">
                              <button
                                type="button"
                                onClick={activeTab === 'plan' ? handlePlanExportIcal : handleLiveExportIcal}
                                className="w-full text-left text-sm text-gray-600 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                              >
                                ↑ Export .ics
                              </button>
                              {activeTab === 'plan' && (
                                <label className="flex w-full text-sm text-gray-600 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer">
                                  ↓ Import .ics
                                  <input type="file" accept=".ics" className="hidden" onChange={handlePlanImportIcal} />
                                </label>
                              )}
                              {activeTab !== 'plan' && (
                                <p className="px-2 pt-0.5 pb-1 text-[11px] text-gray-400 dark:text-gray-500 leading-snug">
                                  To import an .ics, go to the{' '}
                                  <button
                                    type="button"
                                    onClick={() => setActiveTab('plan')}
                                    className="text-blue-500 dark:text-blue-400 hover:underline font-medium"
                                  >
                                    Plan tab
                                  </button>
                                  .
                                </p>
                              )}

                              {/* ── Subscribe to an external calendar URL ── */}
                              <div className="pt-2 mt-1 border-t border-gray-100 dark:border-gray-700 space-y-1.5">
                                <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-2">Subscribe to a calendar</p>
                                <p className="px-2 text-[11px] text-gray-400 dark:text-gray-500 leading-snug">
                                  Paste a secret ICS address (Google Calendar → Settings → "Secret address in iCal format", or any webcal/ics URL).
                                  It auto-refreshes every 30 minutes while the app is open.
                                </p>
                                <div className="flex gap-1.5 items-center px-2">
                                  <input
                                    type="url"
                                    value={subUrl}
                                    onChange={e => { setSubUrl(e.target.value); setSubError(''); }}
                                    placeholder="https://calendar.google.com/…/basic.ics"
                                    className="flex-1 min-w-0 text-xs bg-gray-100 dark:bg-gray-700 rounded-lg px-2 py-1.5 text-gray-900 dark:text-white outline-none border border-gray-200 dark:border-gray-600 focus:border-blue-400 placeholder-gray-400 dark:placeholder-gray-500"
                                  />
                                  <button
                                    type="button"
                                    disabled={!subUrl.trim() || subBusy}
                                    onClick={handleSubscribeUrl}
                                    className="flex-shrink-0 text-xs px-2.5 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 disabled:opacity-40 text-white font-medium transition-colors"
                                  >
                                    {subBusy ? 'Adding…' : `Add to ${activeTab === 'actual' ? 'Live' : 'Plan'}`}
                                  </button>
                                </div>
                                {subError && <p className="px-2 text-[11px] text-red-500">{subError}</p>}
                              </div>

                              {/* ── Publish your calendar as an ICS feed ── */}
                              <div className="pt-2 mt-1 border-t border-gray-100 dark:border-gray-700 space-y-1.5">
                                <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-2">Publish your calendar</p>
                                <p className="px-2 text-[11px] text-gray-400 dark:text-gray-500 leading-snug">
                                  Get a secret URL that Google, Outlook or Apple Calendar can subscribe to.
                                  {isZkEnabled && ' With encryption on, events appear as "Busy" — times visible, content private.'}
                                </p>
                                <div className="px-2 space-y-1.5">
                                  <button
                                    type="button"
                                    onClick={handleFeedToggle}
                                    className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                                      feedInfo?.enabled
                                        ? 'bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-900/60 text-red-600 dark:text-red-400'
                                        : 'bg-blue-500 hover:bg-blue-600 text-white'
                                    }`}
                                  >
                                    {feedInfo?.enabled ? 'Disable feed' : 'Enable feed'}
                                  </button>
                                  {feedInfo?.enabled && feedInfo.path && (
                                    <div className="flex gap-1.5 items-center">
                                      <input
                                        readOnly
                                        value={`${window.location.origin}${feedInfo.path}`}
                                        onFocus={e => e.target.select()}
                                        className="flex-1 min-w-0 text-[11px] bg-gray-100 dark:bg-gray-700 rounded-lg px-2 py-1.5 text-gray-600 dark:text-gray-300 outline-none border border-gray-200 dark:border-gray-600 font-mono"
                                      />
                                      <button
                                        type="button"
                                        onClick={handleCopyFeedUrl}
                                        className="flex-shrink-0 text-xs px-2.5 py-1.5 rounded-lg bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 font-medium transition-colors"
                                      >
                                        {feedCopied ? 'Copied ✓' : 'Copy'}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* ── Account Settings (collapsible) ── */}
                      {sv(SECTION_KWS.account) && (
                      <div className="rounded-lg overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setAccountOpen(v => !v)}
                          className="flex items-center justify-between w-full px-2 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Account Settings</span>
                          <span className="text-[10px] text-gray-400 dark:text-gray-500">{so(accountOpen, SECTION_KWS.account) ? '▲' : '▼'}</span>
                        </button>
                        {so(accountOpen, SECTION_KWS.account) && (
                          <div className="px-2 pb-2 space-y-1">

                            {/* ── Login email (account identity, plaintext — used for sign-in) ── */}
                            {sv(['email', 'login', 'account']) && (
                            <div className="space-y-1.5 px-2 pb-2">
                              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Login Email</p>
                              {accountEmail ? (
                                <p className="text-sm text-gray-600 dark:text-gray-400">{accountEmail}</p>
                              ) : (
                                <>
                                  <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-snug">
                                    Your account predates email sign-in. Add an email so you can log in once more accounts exist.
                                  </p>
                                  <div className="flex gap-1.5 items-center">
                                    <input
                                      type="email"
                                      value={accountEmailDraft}
                                      onChange={e => setAccountEmailDraft(e.target.value)}
                                      placeholder="you@example.com"
                                      className="flex-1 min-w-0 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg px-2 py-1.5 text-gray-900 dark:text-white outline-none border border-gray-200 dark:border-gray-600 focus:border-blue-400 dark:focus:border-blue-500 placeholder-gray-400 dark:placeholder-gray-500"
                                    />
                                    <button
                                      type="button"
                                      disabled={!accountEmailDraft.trim()}
                                      onClick={handleSetAccountEmail}
                                      className="flex-shrink-0 text-xs px-2.5 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-default text-white font-medium transition-colors"
                                    >Save</button>
                                  </div>
                                </>
                              )}
                              {accountEmailMsg && <p className="text-[11px] text-gray-500 dark:text-gray-400">{accountEmailMsg}</p>}
                            </div>
                            )}

                            {/* ── User Profile (nested collapsible) ── */}
                            <div className="rounded-lg overflow-hidden">
                              <button
                                type="button"
                                onClick={() => setProfileOpen(v => !v)}
                                className="flex items-center justify-between w-full px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                              >
                                <span className="text-sm text-gray-600 dark:text-gray-400">User Profile</span>
                                <span className="text-[10px] text-gray-400 dark:text-gray-500">{so(profileOpen, SECTION_KWS.account) ? '▲' : '▼'}</span>
                              </button>

                              {so(profileOpen, SECTION_KWS.account) && (
                              <div className="px-2 pb-2 space-y-4">

                            {/* ── Username ── */}
                            {sv(['username', 'handle', 'user']) && (
                            <div className="space-y-1.5">
                              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Username</p>
                              <div className="flex gap-1.5 items-center">
                                <input
                                  type="text"
                                  value={usernameDraft}
                                  onChange={e => setUsernameDraft(e.target.value)}
                                  placeholder="@handle"
                                  className="flex-1 min-w-0 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg px-2 py-1.5 text-gray-900 dark:text-white outline-none border border-gray-200 dark:border-gray-600 focus:border-blue-400 dark:focus:border-blue-500 placeholder-gray-400 dark:placeholder-gray-500"
                                />
                                <button
                                  type="button"
                                  disabled={usernameDraft.trim() === (profile.username || '')}
                                  onClick={() => setProfile(p => ({ ...p, username: usernameDraft.trim() }))}
                                  className="flex-shrink-0 text-xs px-2.5 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-default text-white font-medium transition-colors"
                                >Save</button>
                              </div>
                            </div>
                            )}

                            {/* ── Display Name ── */}
                            {sv(['display', 'name', 'profile']) && (
                            <div className={`space-y-1.5 pt-1${!sq ? ' border-t border-gray-100 dark:border-gray-700' : ''}`}>
                              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider pt-1">Display Name</p>
                              <div className="flex gap-1.5 items-center">
                                <input
                                  type="text"
                                  value={displayNameDraft}
                                  onChange={e => setDisplayNameDraft(e.target.value)}
                                  placeholder="Your preferred name"
                                  className="flex-1 min-w-0 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg px-2 py-1.5 text-gray-900 dark:text-white outline-none border border-gray-200 dark:border-gray-600 focus:border-blue-400 dark:focus:border-blue-500 placeholder-gray-400 dark:placeholder-gray-500"
                                />
                                <button
                                  type="button"
                                  disabled={displayNameDraft.trim() === (profile.displayName || '')}
                                  onClick={() => setProfile(p => ({ ...p, displayName: displayNameDraft.trim() }))}
                                  className="flex-shrink-0 text-xs px-2.5 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-default text-white font-medium transition-colors"
                                >Save</button>
                              </div>
                            </div>
                            )}

                            {/* ── Email ── */}
                            {sv(['email', 'contact']) && (
                            <div className={`space-y-1.5 pt-1${!sq ? ' border-t border-gray-100 dark:border-gray-700' : ''}`}>
                              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider pt-1">Email</p>
                              <div className="flex gap-1.5 items-center">
                                <input
                                  type="text"
                                  value={emailDraft}
                                  onChange={e => setEmailDraft(e.target.value)}
                                  placeholder="you@example.com"
                                  className="flex-1 min-w-0 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg px-2 py-1.5 text-gray-900 dark:text-white outline-none border border-gray-200 dark:border-gray-600 focus:border-blue-400 dark:focus:border-blue-500 placeholder-gray-400 dark:placeholder-gray-500"
                                />
                                <button
                                  type="button"
                                  disabled={emailDraft.trim() === (profile.email || '')}
                                  onClick={() => setProfile(p => ({ ...p, email: emailDraft.trim() }))}
                                  className="flex-shrink-0 text-xs px-2.5 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-default text-white font-medium transition-colors"
                                >Save</button>
                              </div>
                            </div>
                            )}

                            {/* ── Birthday ── */}
                            {sv(['birthday', 'birth']) && (
                            <div className="space-y-1.5">
                              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Birthday</p>
                              <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-snug">Automatically added to your Plan calendar each year.</p>
                              <div className="flex gap-1.5 items-center">
                                <input
                                  type="date"
                                  value={birthdayDraft}
                                  onChange={e => setBirthdayDraft(e.target.value)}
                                  className="flex-1 min-w-0 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg px-2 py-1.5 text-gray-900 dark:text-white outline-none border border-gray-200 dark:border-gray-600 focus:border-blue-400 dark:focus:border-blue-500"
                                />
                                <button
                                  type="button"
                                  disabled={birthdayDraft === profile.birthday}
                                  onClick={() => setProfile(p => ({ ...p, birthday: birthdayDraft }))}
                                  className="flex-shrink-0 text-xs px-2.5 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-default text-white font-medium transition-colors"
                                >Save</button>
                              </div>
                              {profile.birthday && (
                                <button
                                  type="button"
                                  onClick={() => { setBirthdayDraft(''); setProfile(p => ({ ...p, birthday: '' })); }}
                                  className="text-[11px] text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 transition-colors"
                                >Remove birthday</button>
                              )}
                            </div>
                            )}

                            {/* ── Home Address ── */}
                            {sv(['home', 'address']) && (
                            <div className={`space-y-1.5 pt-1${!sq ? ' border-t border-gray-100 dark:border-gray-700' : ''}`}>
                              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider pt-1">Home Address</p>
                              <input
                                type="text"
                                value={homeAddrDraft}
                                onChange={e => setHomeAddrDraft(e.target.value)}
                                placeholder="123 Main St, City, State 12345"
                                className="w-full text-sm bg-gray-100 dark:bg-gray-700 rounded-lg px-2 py-1.5 text-gray-900 dark:text-white outline-none border border-gray-200 dark:border-gray-600 focus:border-blue-400 dark:focus:border-blue-500 placeholder-gray-400 dark:placeholder-gray-500"
                              />
                              <button
                                type="button"
                                disabled={homeAddrDraft.trim() === profile.homeAddress}
                                onClick={() => setProfile(p => ({ ...p, homeAddress: homeAddrDraft.trim() }))}
                                className="text-xs px-2.5 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-default text-white font-medium transition-colors"
                              >Save</button>
                            </div>
                            )}

                            {/* ── Other Addresses ── */}
                            {sv(['address', 'addresses', 'other']) && (
                            <div className={`space-y-1.5 pt-1${!sq ? ' border-t border-gray-100 dark:border-gray-700' : ''}`}>
                              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider pt-1">Other Addresses</p>

                              {profile.otherAddresses.length === 0 && !addingAddr && (
                                <p className="text-[11px] text-gray-400 dark:text-gray-500">No saved addresses yet.</p>
                              )}

                              {/* Existing addresses */}
                              <div className="space-y-1">
                                {profile.otherAddresses.map(addr => {
                                  const isEditing    = editingAddrId === addr.id;
                                  const isConfirming = pendingDeleteAddr === addr.id;
                                  return (
                                    <div key={addr.id} className="rounded-lg">
                                      {isEditing ? (
                                        <div className="space-y-1.5 py-1">
                                          <input
                                            autoFocus
                                            value={editAddrDraft.label}
                                            onChange={e => setEditAddrDraft(d => ({ ...d, label: e.target.value }))}
                                            placeholder="Label (e.g. Work)"
                                            className="w-full text-sm bg-gray-100 dark:bg-gray-700 rounded px-2 py-1 text-gray-900 dark:text-white outline-none border border-blue-400 dark:border-blue-500"
                                          />
                                          <input
                                            value={editAddrDraft.address}
                                            onChange={e => setEditAddrDraft(d => ({ ...d, address: e.target.value }))}
                                            placeholder="Full address"
                                            className="w-full text-sm bg-gray-100 dark:bg-gray-700 rounded px-2 py-1 text-gray-900 dark:text-white outline-none border border-gray-200 dark:border-gray-600 focus:border-blue-400 dark:focus:border-blue-500"
                                          />
                                          <div className="flex gap-1.5">
                                            <button type="button" onClick={() => setEditingAddrId(null)}
                                              className="flex-1 text-xs py-1 rounded border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Cancel</button>
                                            <button type="button"
                                              disabled={!editAddrDraft.label.trim() || !editAddrDraft.address.trim()}
                                              onClick={() => {
                                                setProfile(p => ({ ...p, otherAddresses: p.otherAddresses.map(a => a.id === addr.id ? { ...a, label: editAddrDraft.label.trim(), address: editAddrDraft.address.trim() } : a) }));
                                                setEditingAddrId(null);
                                              }}
                                              className="flex-1 text-xs py-1 rounded bg-blue-500 hover:bg-blue-600 disabled:opacity-40 text-white font-medium transition-colors">Save</button>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="flex items-start gap-1.5 py-1">
                                          <div className="flex-1 min-w-0">
                                            <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 truncate">{addr.label}</p>
                                            <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate">{addr.address}</p>
                                          </div>
                                          {!isConfirming && (
                                            <>
                                              <button type="button"
                                                onClick={() => { setEditingAddrId(addr.id); setEditAddrDraft({ label: addr.label, address: addr.address }); setPendingDeleteAddr(null); }}
                                                className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded text-gray-300 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm"
                                                title="Edit">✏</button>
                                              <button type="button"
                                                onClick={() => setPendingDeleteAddr(addr.id)}
                                                className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-base leading-none"
                                                title="Delete">×</button>
                                            </>
                                          )}
                                        </div>
                                      )}
                                      {isConfirming && (
                                        <div className="flex items-center gap-2 pb-1.5">
                                          <span className="text-xs text-red-500 dark:text-red-400 flex-1">Remove "{addr.label}"?</span>
                                          <button type="button" onClick={() => setPendingDeleteAddr(null)}
                                            className="text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Cancel</button>
                                          <button type="button"
                                            onClick={() => { setProfile(p => ({ ...p, otherAddresses: p.otherAddresses.filter(a => a.id !== addr.id) })); setPendingDeleteAddr(null); }}
                                            className="text-xs px-2 py-1 rounded bg-red-500 hover:bg-red-600 text-white font-medium transition-colors">Remove</button>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>

                              {/* Add address form */}
                              {addingAddr ? (
                                <div className="space-y-1.5 pt-1">
                                  <input
                                    autoFocus
                                    value={newAddrLabel}
                                    onChange={e => setNewAddrLabel(e.target.value)}
                                    placeholder="Label (e.g. Work, Gym, School)"
                                    className="w-full text-sm bg-gray-100 dark:bg-gray-700 rounded-lg px-2 py-1.5 text-gray-900 dark:text-white outline-none border border-blue-400 dark:border-blue-500 placeholder-gray-400 dark:placeholder-gray-500"
                                  />
                                  <input
                                    value={newAddrValue}
                                    onChange={e => setNewAddrValue(e.target.value)}
                                    placeholder="Full address"
                                    className="w-full text-sm bg-gray-100 dark:bg-gray-700 rounded-lg px-2 py-1.5 text-gray-900 dark:text-white outline-none border border-gray-200 dark:border-gray-600 focus:border-blue-400 dark:focus:border-blue-500 placeholder-gray-400 dark:placeholder-gray-500"
                                    onKeyDown={e => {
                                      if (e.key === 'Enter' && newAddrLabel.trim() && newAddrValue.trim()) {
                                        setProfile(p => ({ ...p, otherAddresses: [...p.otherAddresses, { id: generateId(), label: newAddrLabel.trim(), address: newAddrValue.trim() }] }));
                                        setNewAddrLabel(''); setNewAddrValue(''); setAddingAddr(false);
                                      }
                                      if (e.key === 'Escape') { setAddingAddr(false); setNewAddrLabel(''); setNewAddrValue(''); }
                                    }}
                                  />
                                  <div className="flex gap-1.5">
                                    <button type="button" onClick={() => { setAddingAddr(false); setNewAddrLabel(''); setNewAddrValue(''); }}
                                      className="flex-1 text-xs py-1 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Cancel</button>
                                    <button type="button"
                                      disabled={!newAddrLabel.trim() || !newAddrValue.trim()}
                                      onClick={() => {
                                        setProfile(p => ({ ...p, otherAddresses: [...p.otherAddresses, { id: generateId(), label: newAddrLabel.trim(), address: newAddrValue.trim() }] }));
                                        setNewAddrLabel(''); setNewAddrValue(''); setAddingAddr(false);
                                      }}
                                      className="flex-1 text-xs py-1 rounded-lg bg-blue-500 hover:bg-blue-600 disabled:opacity-40 text-white font-medium transition-colors">Add</button>
                                  </div>
                                </div>
                              ) : (
                                <button type="button"
                                  onClick={() => { setAddingAddr(true); setNewAddrLabel(''); setNewAddrValue(''); setPendingDeleteAddr(null); setEditingAddrId(null); }}
                                  className="w-full text-left text-sm text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 px-1 py-1 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                  + Add address
                                </button>
                              )}
                            </div>
                            )}

                            {/* ── Phone Numbers ── */}
                            {sv(['phone', 'phones', 'number', 'contact']) && (
                            <div className={`space-y-1.5 pt-1${!sq ? ' border-t border-gray-100 dark:border-gray-700' : ''}`}>
                              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider pt-1">Phone Numbers</p>

                              {profile.phones.length === 0 && !addingPhone && (
                                <p className="text-[11px] text-gray-400 dark:text-gray-500">No saved numbers yet.</p>
                              )}

                              <div className="space-y-1">
                                {profile.phones.map(phone => {
                                  const isEditing    = editingPhoneId === phone.id;
                                  const isConfirming = pendingDeletePhone === phone.id;
                                  return (
                                    <div key={phone.id} className="rounded-lg">
                                      {isEditing ? (
                                        <div className="space-y-1.5 py-1">
                                          <input
                                            autoFocus
                                            value={editPhoneDraft.label}
                                            onChange={e => setEditPhoneDraft(d => ({ ...d, label: e.target.value }))}
                                            placeholder="Label (e.g. Mobile)"
                                            className="w-full text-sm bg-gray-100 dark:bg-gray-700 rounded px-2 py-1 text-gray-900 dark:text-white outline-none border border-blue-400 dark:border-blue-500"
                                          />
                                          <input
                                            value={editPhoneDraft.number}
                                            onChange={e => setEditPhoneDraft(d => ({ ...d, number: e.target.value }))}
                                            placeholder="Phone number"
                                            className="w-full text-sm bg-gray-100 dark:bg-gray-700 rounded px-2 py-1 text-gray-900 dark:text-white outline-none border border-gray-200 dark:border-gray-600 focus:border-blue-400 dark:focus:border-blue-500"
                                          />
                                          <div className="flex gap-1.5">
                                            <button type="button" onClick={() => setEditingPhoneId(null)}
                                              className="flex-1 text-xs py-1 rounded border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Cancel</button>
                                            <button type="button"
                                              disabled={!editPhoneDraft.label.trim() || !editPhoneDraft.number.trim()}
                                              onClick={() => {
                                                setProfile(p => ({ ...p, phones: p.phones.map(ph => ph.id === phone.id ? { ...ph, label: editPhoneDraft.label.trim(), number: editPhoneDraft.number.trim() } : ph) }));
                                                setEditingPhoneId(null);
                                              }}
                                              className="flex-1 text-xs py-1 rounded bg-blue-500 hover:bg-blue-600 disabled:opacity-40 text-white font-medium transition-colors">Save</button>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="flex items-start gap-1.5 py-1">
                                          <div className="flex-1 min-w-0">
                                            <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 truncate">{phone.label}</p>
                                            <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate">{phone.number}</p>
                                          </div>
                                          {!isConfirming && (
                                            <>
                                              <button type="button"
                                                onClick={() => { setEditingPhoneId(phone.id); setEditPhoneDraft({ label: phone.label, number: phone.number }); setPendingDeletePhone(null); }}
                                                className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded text-gray-300 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm"
                                                title="Edit">✏</button>
                                              <button type="button"
                                                onClick={() => setPendingDeletePhone(phone.id)}
                                                className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-base leading-none"
                                                title="Delete">×</button>
                                            </>
                                          )}
                                        </div>
                                      )}
                                      {isConfirming && (
                                        <div className="flex items-center gap-2 pb-1.5">
                                          <span className="text-xs text-red-500 dark:text-red-400 flex-1">Remove "{phone.label}"?</span>
                                          <button type="button" onClick={() => setPendingDeletePhone(null)}
                                            className="text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Cancel</button>
                                          <button type="button"
                                            onClick={() => { setProfile(p => ({ ...p, phones: p.phones.filter(ph => ph.id !== phone.id) })); setPendingDeletePhone(null); }}
                                            className="text-xs px-2 py-1 rounded bg-red-500 hover:bg-red-600 text-white font-medium transition-colors">Remove</button>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>

                              {addingPhone ? (
                                <div className="space-y-1.5 pt-1">
                                  <input
                                    autoFocus
                                    value={newPhoneLabel}
                                    onChange={e => setNewPhoneLabel(e.target.value)}
                                    placeholder="Label (e.g. Mobile, Work)"
                                    className="w-full text-sm bg-gray-100 dark:bg-gray-700 rounded-lg px-2 py-1.5 text-gray-900 dark:text-white outline-none border border-blue-400 dark:border-blue-500 placeholder-gray-400 dark:placeholder-gray-500"
                                  />
                                  <input
                                    value={newPhoneValue}
                                    onChange={e => setNewPhoneValue(e.target.value)}
                                    placeholder="Phone number"
                                    className="w-full text-sm bg-gray-100 dark:bg-gray-700 rounded-lg px-2 py-1.5 text-gray-900 dark:text-white outline-none border border-gray-200 dark:border-gray-600 focus:border-blue-400 dark:focus:border-blue-500 placeholder-gray-400 dark:placeholder-gray-500"
                                    onKeyDown={e => {
                                      if (e.key === 'Enter' && newPhoneLabel.trim() && newPhoneValue.trim()) {
                                        setProfile(p => ({ ...p, phones: [...p.phones, { id: generateId(), label: newPhoneLabel.trim(), number: newPhoneValue.trim() }] }));
                                        setNewPhoneLabel(''); setNewPhoneValue(''); setAddingPhone(false);
                                      }
                                      if (e.key === 'Escape') { setAddingPhone(false); setNewPhoneLabel(''); setNewPhoneValue(''); }
                                    }}
                                  />
                                  <div className="flex gap-1.5">
                                    <button type="button" onClick={() => { setAddingPhone(false); setNewPhoneLabel(''); setNewPhoneValue(''); }}
                                      className="flex-1 text-xs py-1 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Cancel</button>
                                    <button type="button"
                                      disabled={!newPhoneLabel.trim() || !newPhoneValue.trim()}
                                      onClick={() => {
                                        setProfile(p => ({ ...p, phones: [...p.phones, { id: generateId(), label: newPhoneLabel.trim(), number: newPhoneValue.trim() }] }));
                                        setNewPhoneLabel(''); setNewPhoneValue(''); setAddingPhone(false);
                                      }}
                                      className="flex-1 text-xs py-1 rounded-lg bg-blue-500 hover:bg-blue-600 disabled:opacity-40 text-white font-medium transition-colors">Add</button>
                                  </div>
                                </div>
                              ) : (
                                <button type="button"
                                  onClick={() => { setAddingPhone(true); setNewPhoneLabel(''); setNewPhoneValue(''); setPendingDeletePhone(null); setEditingPhoneId(null); }}
                                  className="w-full text-left text-sm text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 px-1 py-1 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                  + Add phone number
                                </button>
                              )}
                            </div>
                            )}

                              </div>
                              )}
                            </div>

                          </div>
                        )}
                      </div>
                      )}

                    </div>

                    {/* No-results state */}
                    {settingsNoResults && (
                      <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">
                        No results for &ldquo;<span className="font-medium text-gray-500 dark:text-gray-400">{settingsSearch}</span>&rdquo;
                      </p>
                    )}

                    {activeTab === 'reality' && (
                      <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Export Data</p>
                        <div className="flex gap-1 rounded-lg bg-gray-100 dark:bg-gray-700 p-1 mb-2">
                          {['csv', 'json', 'pdf'].map(fmt => (
                            <button key={fmt} type="button" onClick={() => setExportFormat(fmt)}
                              className={`flex-1 py-1 rounded-md text-xs font-semibold uppercase tracking-wide transition-colors ${
                                exportFormat === fmt
                                  ? 'bg-white dark:bg-gray-500 text-gray-900 dark:text-white shadow-sm'
                                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                              }`}>
                              {fmt}
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={handleRealityCheckExport}
                          disabled={exporting}
                          className="w-full py-1.5 rounded-lg bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs font-semibold hover:bg-gray-700 dark:hover:bg-white disabled:opacity-50 transition-colors"
                        >
                          {exporting ? 'Exporting…' : '↓ Download'}
                        </button>
                      </div>
                    )}

                    {/* Linked Calendars — always visible when any exist */}
                    {(() => {
                      const legacyPlan = events.filter(e => e.calendar === 'plan' && !e.source_calendar_id && e.source !== 'manual').length;
                      const legacyActual = events.filter(e => e.calendar === 'actual' && !e.source_calendar_id && e.source !== 'manual').length;
                      const hasAny = linkedCalendars.length > 0 || legacyPlan > 0 || legacyActual > 0;
                      if (!hasAny || !sv(SECTION_KWS.linked)) return null;
                      return (
                        <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                            Linked Calendars
                          </p>
                          <div className="space-y-1">
                            {[...linkedCalendars].reverse().map(cal => {
                              const count = events.filter(e => e.source_calendar_id === cal.id).length;
                              const isConfirming = pendingDelete === cal.id;
                              const calColor = cal.color || '#6B7280';
                              const isPickingColor = editingCalColor === cal.id;
                              return (
                                <div key={cal.id} className="rounded-lg overflow-hidden">
                                  <div className="flex items-start gap-2 py-1">
                                    {/* Color dot — click to toggle inline picker */}
                                    <button
                                      type="button"
                                      title="Change color"
                                      onClick={() => setEditingCalColor(isPickingColor ? null : cal.id)}
                                      className="flex-shrink-0 mt-1.5 w-3.5 h-3.5 rounded-full border-2 border-white/30 dark:border-gray-700 shadow-sm hover:scale-125 transition-transform"
                                      style={{ backgroundColor: calColor }}
                                    />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className={`inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide flex-shrink-0 ${
                                          cal.calendar === 'plan'
                                            ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                                            : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'
                                        }`}>
                                          {cal.calendar === 'plan' ? 'Plan' : 'Live'}
                                        </span>
                                        <span className="text-sm text-gray-800 dark:text-gray-200 truncate font-medium">
                                          {cal.name}
                                        </span>
                                      </div>
                                      <div className="flex items-center justify-between mt-0.5">
                                        <p className="text-xs text-gray-400 dark:text-gray-500">
                                          {count} event{count !== 1 ? 's' : ''} · {cal.importedAt}
                                          {cal.url && (
                                            <>
                                              {' · '}
                                              <button
                                                type="button"
                                                disabled={syncingCalId === cal.id}
                                                onClick={() => handleSyncNow(cal)}
                                                className="text-blue-500 dark:text-blue-400 hover:underline disabled:opacity-50 font-medium"
                                                title={cal.lastSyncedAt ? `Last synced ${new Date(cal.lastSyncedAt * 1000).toLocaleString()}` : 'Subscribed calendar'}
                                              >
                                                {syncingCalId === cal.id ? 'Syncing…' : '↻ Sync now'}
                                              </button>
                                            </>
                                          )}
                                        </p>
                                        <label className="flex items-center gap-1 cursor-pointer flex-shrink-0 ml-2" title="Exclude this calendar from Reality Check">
                                          <input
                                            type="checkbox"
                                            checked={!!cal.excludeFromReality}
                                            onChange={e => updateLinkedCalendarExclude(cal.id, e.target.checked)}
                                            className="w-3 h-3 rounded accent-blue-500"
                                          />
                                          <span className="text-[10px] text-gray-400 dark:text-gray-500 whitespace-nowrap">Skip RC</span>
                                        </label>
                                      </div>
                                      {/* Inline color swatches */}
                                      {isPickingColor && (
                                        <div className="flex flex-wrap gap-1.5 mt-2 mb-1">
                                          {IMPORT_COLORS.map(c => (
                                            <button
                                              key={c}
                                              type="button"
                                              onClick={() => { updateLinkedCalendarColor(cal.id, c); setEditingCalColor(null); }}
                                              className={`w-5 h-5 rounded-full border-2 transition-all hover:scale-110 ${c === calColor ? 'border-gray-300 dark:border-white scale-110' : 'border-transparent hover:border-gray-300 dark:hover:border-gray-500'}`}
                                              style={{ backgroundColor: c }}
                                            />
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                    {!isConfirming && (
                                      <button
                                        type="button"
                                        onClick={() => { setEditingCalColor(null); setPendingDelete(cal.id); }}
                                        className="flex-shrink-0 mt-0.5 w-6 h-6 flex items-center justify-center rounded text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-base leading-none"
                                        title="Remove calendar"
                                      >×</button>
                                    )}
                                  </div>
                                  {isConfirming && (
                                    <div className="flex items-center gap-2 pb-1.5 pl-0.5">
                                      <span className="text-xs text-red-500 dark:text-red-400 flex-1">
                                        Remove {count} event{count !== 1 ? 's' : ''}?
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => setPendingDelete(null)}
                                        className="text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                      >Cancel</button>
                                      <button
                                        type="button"
                                        onClick={() => { deleteLinkedCalendar(cal.id); setPendingDelete(null); }}
                                        className="text-xs px-2 py-1 rounded bg-red-500 hover:bg-red-600 text-white font-medium transition-colors"
                                      >Delete</button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}

                            {/* Legacy / untracked rows */}
                            {[
                              { key: '__legacy_plan', label: 'Unlinked plan events', count: legacyPlan, calendar: 'plan' },
                              { key: '__legacy_actual', label: 'Unlinked live events', count: legacyActual, calendar: 'actual' },
                            ].filter(r => r.count > 0).map(row => {
                              const isConfirming = pendingDelete === row.key;
                              return (
                                <div key={row.key} className="rounded-lg overflow-hidden">
                                  <div className="flex items-start gap-2 py-1 opacity-70">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <span className="inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide flex-shrink-0 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                                          {row.calendar === 'plan' ? 'Plan' : 'Live'}
                                        </span>
                                        <span className="text-sm text-gray-600 dark:text-gray-400 font-medium truncate">{row.label}</span>
                                      </div>
                                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 pl-0.5">
                                        {row.count} event{row.count !== 1 ? 's' : ''} · not linked to a source
                                      </p>
                                    </div>
                                    {!isConfirming && (
                                      <button
                                        type="button"
                                        onClick={() => setPendingDelete(row.key)}
                                        className="flex-shrink-0 mt-0.5 w-6 h-6 flex items-center justify-center rounded text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-base leading-none"
                                        title="Remove unlinked events"
                                      >×</button>
                                    )}
                                  </div>
                                  {isConfirming && (
                                    <div className="flex items-center gap-2 pb-1.5 pl-0.5">
                                      <span className="text-xs text-red-500 dark:text-red-400 flex-1">
                                        Remove {row.count} unlinked event{row.count !== 1 ? 's' : ''}?
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => setPendingDelete(null)}
                                        className="text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                      >Cancel</button>
                                      <button
                                        type="button"
                                        onClick={() => { clearLegacyEvents(row.calendar); setPendingDelete(null); }}
                                        className="text-xs px-2 py-1 rounded bg-red-500 hover:bg-red-600 text-white font-medium transition-colors"
                                      >Delete</button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                      {/* ── Tutorial ── */}
                      <div className="pt-1 border-t border-gray-100 dark:border-gray-700 mt-1">
                        <button
                          type="button"
                          onClick={() => { setShowSettings(false); setShowTutorial(true); }}
                          className="flex items-center gap-2 w-full px-2 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
                        >
                          <svg className="w-4 h-4 text-indigo-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                          </svg>
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Tutorial</span>
                          <span className="ml-auto text-[10px] text-gray-400 dark:text-gray-500">8 steps</span>
                        </button>
                      </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-hidden pb-safe">
          {activeTab === 'plan' && (
            <PlanView
              events={planEvents}
              weekStart={weekStart}
              precision={planPrecision}
              onPrecisionChange={setPlanPrecision}
              allCategories={allCategories}
              militaryTime={militaryTime}
              enabledViews={eff.enabledViews}
              showWeekNumbers={eff.showWeekNumbers}
              showPrecisionToggle={eff.precisionToggle}
              showCategoriesMenu={eff.categoriesMenu}
              pinnedCategories={pinnedCategories}
              onTogglePin={togglePin}
              onManageCategories={openManageCategories}
              mobileDefaultView={mobileDefaultView}
              onAddEvent={addEvent}
              onAddEvents={addEvents}
              onUpdateEvent={updateEvent}
              onDeleteEvent={deleteEvent}
              onUpdateCategory={updateCategory}
              onAddCategory={addCategory}
              onNavigateToDate={dateStr => setWeekStart(getWeekStart(new Date(dateStr + 'T00:00:00')))}
              jumpTo={searchJump?.tab === 'plan' ? searchJump : null}
            />
          )}
          {activeTab === 'actual' && (
            <ActualView
              planEvents={planEvents}
              actualEvents={actualEvents}
              weekStart={weekStart}
              precision={livePrecision}
              onPrecisionChange={setLivePrecision}
              allCategories={allCategories}
              militaryTime={militaryTime}
              enabledViews={eff.enabledViews}
              showWeekNumbers={eff.showWeekNumbers}
              showPrecisionToggle={eff.precisionToggle}
              showCategoriesMenu={eff.categoriesMenu}
              pinnedCategories={pinnedCategories}
              onTogglePin={togglePin}
              mobileDefaultView={mobileDefaultView}
              onManageCategories={openManageCategories}
              onAddEvent={addEvent}
              onAddEvents={addEvents}
              onUpdateEvent={updateEvent}
              onDeleteEvent={deleteEvent}
              onUpdateCategory={updateCategory}
              onAddCategory={addCategory}
              onNavigateToDate={dateStr => setWeekStart(getWeekStart(new Date(dateStr + 'T00:00:00')))}
              jumpTo={searchJump?.tab === 'actual' ? searchJump : null}
            />
          )}
          {activeTab === 'reality' && (
            <DiffView
              planEvents={planEvents}
              actualEvents={actualEvents}
              allCategories={allCategories}
              linkedCalendars={linkedCalendars}
              onDiffChange={state => { diffStateRef.current = state; }}
              budgets={budgets}
              habitsWithStreaks={habitsWithStreaks}
              completions={completions}
              onToggleHabit={toggleCompletion}
              onAddHabit={addHabit}
              onUpdateHabit={updateHabit}
              onDeleteHabit={deleteHabit}
            />
          )}
        </main>

        {/* Install prompt — "Add to Home Screen" banner */}
        <InstallPrompt />

        {/* Floating quick-add button */}
        {eff.fabVisible && (
          <QuickAddFAB
            allCategories={allCategories}
            homeAddress={profile.homeAddress || ''}
            militaryTime={militaryTime}
            draggable={fabDraggable}
            posResetKey={fabPosResetKey}
            onAddEvent={event => addEvent({ ...event, calendar: 'plan' })}
            onAddActual={event => addEvent({ ...event, calendar: 'actual' })}
            onSwitchTab={setActiveTab}
            initialParseText={shareText}
            onClearParseText={() => setShareText('')}
          />
        )}
      </div>
    </div>
  );
}
