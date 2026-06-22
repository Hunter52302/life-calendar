import { useContext, useState, useEffect, useRef } from 'react';
import {
  View, Text, Pressable, ScrollView, StyleSheet, Switch, Alert,
  TextInput, Modal, FlatList, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { AppContext } from '../context/AppContext.js';
import { generateId } from '../lib/utils.js';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001/api';
const ADMIN_TOKEN_KEY = 'lc-admin-token'; // sessionStorage not available on RN — use module var
let _adminToken = null;

// ── Constants ─────────────────────────────────────────────────────────────────

const PRESET_COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#EAB308',
  '#22C55E', '#10B981', '#06B6D4', '#3B82F6',
  '#6366F1', '#8B5CF6', '#A855F7', '#EC4899',
  '#6B7280', '#374151',
];

const COMMON_TIMEZONES = [
  { id: 'America/New_York',               label: 'New York (ET)' },
  { id: 'America/Chicago',                label: 'Chicago (CT)' },
  { id: 'America/Denver',                 label: 'Denver (MT)' },
  { id: 'America/Los_Angeles',            label: 'Los Angeles (PT)' },
  { id: 'America/Anchorage',              label: 'Alaska (AKT)' },
  { id: 'Pacific/Honolulu',               label: 'Hawaii (HST)' },
  { id: 'America/Toronto',                label: 'Toronto (ET)' },
  { id: 'America/Vancouver',              label: 'Vancouver (PT)' },
  { id: 'America/Phoenix',                label: 'Phoenix (MST)' },
  { id: 'America/Mexico_City',            label: 'Mexico City (CT)' },
  { id: 'America/Sao_Paulo',              label: 'São Paulo (BRT)' },
  { id: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires (ART)' },
  { id: 'America/Bogota',                 label: 'Bogotá (COT)' },
  { id: 'Europe/London',                  label: 'London (GMT/BST)' },
  { id: 'Europe/Paris',                   label: 'Paris (CET)' },
  { id: 'Europe/Berlin',                  label: 'Berlin (CET)' },
  { id: 'Europe/Rome',                    label: 'Rome (CET)' },
  { id: 'Europe/Madrid',                  label: 'Madrid (CET)' },
  { id: 'Europe/Amsterdam',               label: 'Amsterdam (CET)' },
  { id: 'Europe/Stockholm',               label: 'Stockholm (CET)' },
  { id: 'Europe/Moscow',                  label: 'Moscow (MSK)' },
  { id: 'Europe/Istanbul',                label: 'Istanbul (TRT)' },
  { id: 'Africa/Cairo',                   label: 'Cairo (EET)' },
  { id: 'Africa/Lagos',                   label: 'Lagos (WAT)' },
  { id: 'Africa/Johannesburg',            label: 'Johannesburg (SAST)' },
  { id: 'Africa/Nairobi',                 label: 'Nairobi (EAT)' },
  { id: 'Asia/Dubai',                     label: 'Dubai (GST)' },
  { id: 'Asia/Karachi',                   label: 'Karachi (PKT)' },
  { id: 'Asia/Kolkata',                   label: 'Kolkata / Mumbai (IST)' },
  { id: 'Asia/Dhaka',                     label: 'Dhaka (BST)' },
  { id: 'Asia/Bangkok',                   label: 'Bangkok (ICT)' },
  { id: 'Asia/Singapore',                 label: 'Singapore (SGT)' },
  { id: 'Asia/Shanghai',                  label: 'Shanghai / Beijing (CST)' },
  { id: 'Asia/Hong_Kong',                 label: 'Hong Kong (HKT)' },
  { id: 'Asia/Tokyo',                     label: 'Tokyo (JST)' },
  { id: 'Asia/Seoul',                     label: 'Seoul (KST)' },
  { id: 'Australia/Sydney',               label: 'Sydney (AEST)' },
  { id: 'Australia/Melbourne',            label: 'Melbourne (AEST)' },
  { id: 'Australia/Perth',                label: 'Perth (AWST)' },
  { id: 'Pacific/Auckland',               label: 'Auckland (NZST)' },
  { id: 'Pacific/Fiji',                   label: 'Fiji (FJT)' },
  { id: 'UTC',                            label: 'UTC / GMT+0' },
];

const FONT_OPTIONS = [
  { key: 'system',      label: 'System Default',       family: undefined,     group: 'Default' },
  { key: 'serif',       label: 'Serif',                family: 'serif',       group: 'Serif' },
  { key: 'monospace',   label: 'Monospace',             family: 'monospace',   group: 'Monospace' },
  { key: 'opendyslexic',label: 'OpenDyslexic',          family: undefined,     group: 'Accessibility' },
  { key: 'atkinson',    label: 'Atkinson Hyperlegible', family: undefined,     group: 'Accessibility' },
  { key: 'inter',       label: 'Inter',                 family: undefined,     group: 'Sans-serif' },
  { key: 'nunito',      label: 'Nunito',                family: undefined,     group: 'Sans-serif' },
];

const LLM_PROVIDERS = [
  { id: 'none',      label: 'None' },
  { id: 'anthropic', label: 'Anthropic' },
  { id: 'openai',    label: 'OpenAI' },
  { id: 'custom',    label: 'Custom' },
];

const TUTORIAL_STEPS = [
  {
    icon: 'calendar',
    title: 'Welcome to Life Calendar',
    body: 'Life Calendar helps you close the gap between how you plan your time and how you actually spend it. This tour covers everything you need to get started.',
  },
  {
    icon: 'layers-outline',
    title: 'Three Tabs',
    body: 'Plan — block out how you intend to use your time.\nLive — record what you actually did.\nSee Your Life — compare plan vs reality side by side.',
  },
  {
    icon: 'add-circle-outline',
    title: 'Adding Events',
    body: 'Tap any empty time slot on the calendar grid to open the event form pre-filled with that time. Events support labels, categories, all-day mode, and more.',
  },
  {
    icon: 'color-palette-outline',
    title: 'Categories',
    body: 'Every event belongs to a category with its own color. Categories help you see at a glance how your time is distributed. Create and customize them in Settings → Manage Categories.',
  },
  {
    icon: 'checkmark-circle-outline',
    title: 'Logging Actuals',
    body: 'In the Live tab, planned events appear greyed out. Tap one to log what you actually did — or tap an empty slot to add a new actual event.',
  },
  {
    icon: 'bar-chart-outline',
    title: 'See Your Life',
    body: 'The See Your Life tab shows plan vs actual bars per category so you can see exactly where your time went each week.',
  },
  {
    icon: 'timer-outline',
    title: 'Time Budgets',
    body: 'Set weekly hour targets per category in Settings → Time Budgets. They appear as progress bars in See Your Life so you know when you\'re over or under.',
  },
  {
    icon: 'person-circle-outline',
    title: 'Your Account',
    body: 'Set a password the first time you launch the app to enable cross-device sync. Without a password your data stays local. You can always continue offline.',
  },
  {
    icon: 'phone-portrait-outline',
    title: 'Install the App',
    body: 'Already installed! On other devices you can add the web version to your home screen as a PWA — open it in Safari or Chrome and tap "Add to Home Screen".',
  },
  {
    icon: 'settings-outline',
    title: 'Settings',
    body: 'Customise time format, week start day, which tabs appear, time zones, notifications, and much more. You can always return to this tutorial from Settings → Tutorial.',
  },
];

// ── Sub-components ─────────────────────────────────────────────────────────────

function SearchBar({ value, onChangeText, T }) {
  return (
    <View style={[s.searchWrap, { backgroundColor: T.searchBg, borderColor: T.border }]}>
      <Ionicons name="search-outline" size={16} color={T.textFaint} style={s.searchIcon} />
      <TextInput
        style={[s.searchInput, { color: T.text }]}
        placeholder="Search settings…"
        placeholderTextColor={T.placeholder}
        value={value}
        onChangeText={onChangeText}
        clearButtonMode="while-editing"
        autoCorrect={false}
      />
    </View>
  );
}

function Section({ title, icon, children, defaultOpen = false, forceOpen = false, collapseKey = 0, onToggle, T }) {
  const [open, setOpen] = useState(defaultOpen);
  const isOpen = forceOpen || open;

  // When collapseKey increments (collapse-all triggered), close this section
  useEffect(() => {
    if (collapseKey > 0 && !forceOpen && open) {
      setOpen(false);
      onToggle?.(false);
    }
  }, [collapseKey]); // eslint-disable-line react-hooks/exhaustive-deps

  function handlePress() {
    if (forceOpen) return;
    const next = !open;
    setOpen(next);
    onToggle?.(next);
  }

  return (
    <View style={[s.section, {
      backgroundColor: T.surface,
      shadowColor: T.sectionShadow.color,
      shadowOpacity: T.sectionShadow.opacity,
      shadowRadius: T.sectionShadow.radius,
      shadowOffset: T.sectionShadow.offset,
    }]}>
      <Pressable
        style={[s.sectionHeader, { borderBottomColor: T.borderLight }]}
        onPress={handlePress}
      >
        <View style={s.sectionHeaderLeft}>
          <Ionicons name={icon} size={18} color={T.accent} style={s.sectionIcon} />
          <Text style={[s.sectionTitle, { color: T.text }]}>{title}</Text>
        </View>
        <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color={T.textFaint} />
      </Pressable>
      {isOpen && <View style={s.sectionBody}>{children}</View>}
    </View>
  );
}

function Divider({ T }) {
  return <View style={[s.rowDivider, { backgroundColor: T.borderLight }]} />;
}

function SettingRow({ label, sub, value, onValueChange, last, T }) {
  return (
    <>
      <View style={s.row}>
        <View style={s.rowLeft}>
          <Text style={[s.rowTitle, { color: T.text }]}>{label}</Text>
          {sub ? <Text style={[s.rowSub, { color: T.textFaint }]}>{sub}</Text> : null}
        </View>
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: T.switchFalse, true: T.switchTrue }}
          thumbColor="#fff"
        />
      </View>
      {!last && <Divider T={T} />}
    </>
  );
}

function SegmentRow({ label, options, value, onChange, last, T }) {
  return (
    <>
      <View style={s.segmentWrap}>
        <Text style={[s.rowTitle, { color: T.text }]}>{label}</Text>
        <View style={[s.segmentBar, { backgroundColor: T.segmentBg }]}>
          {options.map(opt => (
            <Pressable
              key={String(opt.value)}
              onPress={() => onChange(opt.value)}
              style={[s.segmentBtn, value === opt.value && [s.segmentBtnActive, { backgroundColor: T.segmentActive }]]}
            >
              <Text style={[s.segmentTxt, { color: T.segmentTxt }, value === opt.value && { color: T.segmentTxtAct, fontWeight: '700' }]}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      {!last && <Divider T={T} />}
    </>
  );
}

function ProfileField({ label, value, onSave, placeholder, T, last, secureTextEntry = false }) {
  const [draft, setDraft] = useState(value);
  const changed = draft.trim() !== (value || '');
  return (
    <>
      <View style={s.profileField}>
        <Text style={[s.profileLabel, { color: T.textFaint }]}>{label}</Text>
        <View style={s.profileInputRow}>
          <TextInput
            style={[s.profileInput, { backgroundColor: T.inputBg, borderColor: T.inputBorder, color: T.text }]}
            value={draft}
            onChangeText={setDraft}
            placeholder={placeholder}
            placeholderTextColor={T.placeholder}
            autoCorrect={false}
            autoCapitalize="none"
            secureTextEntry={secureTextEntry}
          />
          <Pressable
            style={[s.saveBtn, { backgroundColor: changed ? '#3B82F6' : T.inputBg, opacity: changed ? 1 : 0.4 }]}
            onPress={() => { if (changed) { onSave(draft.trim()); } }}
            disabled={!changed}
          >
            <Text style={[s.saveBtnText, { color: changed ? '#fff' : T.textFaint }]}>Save</Text>
          </Pressable>
        </View>
      </View>
      {!last && <Divider T={T} />}
    </>
  );
}

const TODO_TUTORIAL_STEPS = [
  { icon: 'checkmark-circle-outline', title: 'Welcome to PLS Do It', body: 'PLS Do It is your personal task list. Add tasks, set priorities and due dates, and check them off as you go.' },
  { icon: 'add-circle-outline',       title: 'Adding Tasks',         body: 'Tap the + button or the FAB in the bottom-right to add a new task. Give it a title — due date and priority are optional.' },
  { icon: 'checkbox-outline',         title: 'Completing Tasks',     body: 'Tap the circle on the left of any task to mark it done. Completed tasks collapse into a toggle at the bottom.' },
  { icon: 'create-outline',           title: 'Editing Details',      body: 'Tap a task title to expand it. You can change the title, set a due date, pick a priority, and choose a color label.' },
  { icon: 'alert-circle-outline',     title: 'Overdue Rollover',     body: 'Tasks from past days that are still pending automatically appear in the Overdue section so nothing slips through.' },
  { icon: 'settings-outline',         title: 'Settings',             body: 'In Settings → Habit Tracker you can manage your habits. The Tutorial button always brings you back here.' },
];

// ── Tutorial Modal ─────────────────────────────────────────────────────────────

function TutorialModal({ visible, onClose, steps = TUTORIAL_STEPS, T }) {
  const [step, setStep] = useState(0);
  const total = steps.length;
  const current = steps[step];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.tutOverlay}>
        <View style={[s.tutCard, { backgroundColor: T.surface }]}>
          {/* Step indicator */}
          <View style={s.tutDots}>
            {TUTORIAL_STEPS.map((_, i) => (
              <View
                key={i}
                style={[s.tutDot, {
                  backgroundColor: i === step ? T.accent : T.border,
                  width: i === step ? 16 : 6,
                }]}
              />
            ))}
          </View>

          {/* Icon */}
          <View style={[s.tutIconWrap, { backgroundColor: T.accentLight }]}>
            <Ionicons name={current.icon} size={32} color={T.accent} />
          </View>

          {/* Content */}
          <Text style={[s.tutTitle, { color: T.text }]}>{current.title}</Text>
          <Text style={[s.tutBody, { color: T.textMuted }]}>{current.body}</Text>

          {/* Navigation */}
          <View style={s.tutNav}>
            <Pressable
              style={[s.tutNavBtn, { borderColor: T.border }]}
              onPress={() => step > 0 ? setStep(s => s - 1) : onClose()}
            >
              <Text style={[s.tutNavBtnText, { color: T.textMuted }]}>{step > 0 ? 'Back' : 'Skip'}</Text>
            </Pressable>
            <Pressable
              style={[s.tutNavBtnPrimary, { backgroundColor: T.accent }]}
              onPress={() => step < total - 1 ? setStep(s => s + 1) : onClose()}
            >
              <Text style={s.tutNavBtnPrimaryText}>{step < total - 1 ? 'Next' : 'Done'}</Text>
            </Pressable>
          </View>

          <Text style={[s.tutCount, { color: T.textFaint }]}>{step + 1} of {total}</Text>
        </View>
      </View>
    </Modal>
  );
}

// ── Timezone Picker Modal ──────────────────────────────────────────────────────

function TzPickerModal({ visible, onClose, onSelect, existing, T }) {
  const [search, setSearch] = useState('');
  const filtered = COMMON_TIMEZONES.filter(t =>
    !existing.includes(t.id) &&
    (t.label.toLowerCase().includes(search.toLowerCase()) ||
     t.id.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.tutOverlay}>
        <View style={[s.tzCard, { backgroundColor: T.surface }]}>
          <Text style={[s.tzCardTitle, { color: T.text }]}>Add Time Zone</Text>
          <TextInput
            style={[s.searchInput, s.tzSearch, { backgroundColor: T.inputBg, borderColor: T.inputBorder, color: T.text }]}
            placeholder="Search city or timezone…"
            placeholderTextColor={T.placeholder}
            value={search}
            onChangeText={setSearch}
            autoFocus
          />
          <FlatList
            data={filtered}
            keyExtractor={item => item.id}
            style={{ maxHeight: 260 }}
            renderItem={({ item }) => (
              <Pressable
                style={[s.tzItem, { borderBottomColor: T.borderLight }]}
                onPress={() => { onSelect(item.id); onClose(); setSearch(''); }}
              >
                <Text style={[s.tzItemText, { color: T.text }]}>{item.label}</Text>
              </Pressable>
            )}
            ListEmptyComponent={<Text style={[s.tzEmpty, { color: T.textFaint }]}>No matches</Text>}
          />
          <Pressable style={[s.cancelBtn, { borderColor: T.border }]} onPress={() => { onClose(); setSearch(''); }}>
            <Text style={[s.cancelBtnText, { color: T.textMuted }]}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ── Add Integration Modal ─────────────────────────────────────────────────────

function AddIntegrationModal({ visible, onClose, onAdd, T }) {
  const [type, setType]   = useState('discord_webhook');
  const [label, setLabel] = useState('');
  const [url, setUrl]     = useState('');

  function handleAdd() {
    if (!label.trim() || !url.trim()) return;
    onAdd({ type, label: label.trim(), url: url.trim() });
    setLabel(''); setUrl('');
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.tutOverlay}>
        <View style={[s.tzCard, { backgroundColor: T.surface }]}>
          <Text style={[s.tzCardTitle, { color: T.text }]}>Add Integration</Text>

          {/* Type selector */}
          <View style={[s.segmentBar, { backgroundColor: T.segmentBg, marginBottom: 12 }]}>
            {[
              { value: 'discord_webhook', label: 'Discord' },
              { value: 'slack_webhook',   label: 'Slack' },
              { value: 'generic_webhook', label: 'Webhook' },
            ].map(opt => (
              <Pressable
                key={opt.value}
                onPress={() => setType(opt.value)}
                style={[s.segmentBtn, type === opt.value && [s.segmentBtnActive, { backgroundColor: T.segmentActive }]]}
              >
                <Text style={[s.segmentTxt, { color: type === opt.value ? T.segmentTxtAct : T.segmentTxt, fontWeight: type === opt.value ? '700' : '500' }]}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <TextInput
            style={[s.integInput, { backgroundColor: T.inputBg, borderColor: T.inputBorder, color: T.text }]}
            placeholder="Nickname (e.g. My Discord)"
            placeholderTextColor={T.placeholder}
            value={label}
            onChangeText={setLabel}
          />
          <TextInput
            style={[s.integInput, { backgroundColor: T.inputBg, borderColor: T.inputBorder, color: T.text, marginTop: 8 }]}
            placeholder="Webhook URL"
            placeholderTextColor={T.placeholder}
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <View style={s.integBtns}>
            <Pressable style={[s.cancelBtn, { borderColor: T.border, flex: 1, marginRight: 6 }]} onPress={onClose}>
              <Text style={[s.cancelBtnText, { color: T.textMuted }]}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[s.integAddBtn, { backgroundColor: (!label.trim() || !url.trim()) ? T.inputBg : T.accent, flex: 1 }]}
              onPress={handleAdd}
              disabled={!label.trim() || !url.trim()}
            >
              <Text style={[s.integAddBtnText, { color: (!label.trim() || !url.trim()) ? T.textFaint : '#fff' }]}>Add</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Add Address / Phone helper ─────────────────────────────────────────────────

function AddItemModal({ visible, onClose, onAdd, titleStr, label1, label2, ph1, ph2, T }) {
  const [f1, setF1] = useState('');
  const [f2, setF2] = useState('');

  function handle() {
    if (!f1.trim() || !f2.trim()) return;
    onAdd({ [label1]: f1.trim(), [label2]: f2.trim() });
    setF1(''); setF2(''); onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.tutOverlay}>
        <View style={[s.tzCard, { backgroundColor: T.surface }]}>
          <Text style={[s.tzCardTitle, { color: T.text }]}>{titleStr}</Text>
          <TextInput
            style={[s.integInput, { backgroundColor: T.inputBg, borderColor: T.inputBorder, color: T.text }]}
            placeholder={ph1}
            placeholderTextColor={T.placeholder}
            value={f1}
            onChangeText={setF1}
            autoFocus
          />
          <TextInput
            style={[s.integInput, { backgroundColor: T.inputBg, borderColor: T.inputBorder, color: T.text, marginTop: 8 }]}
            placeholder={ph2}
            placeholderTextColor={T.placeholder}
            value={f2}
            onChangeText={setF2}
          />
          <View style={s.integBtns}>
            <Pressable style={[s.cancelBtn, { borderColor: T.border, flex: 1, marginRight: 6 }]} onPress={() => { setF1(''); setF2(''); onClose(); }}>
              <Text style={[s.cancelBtnText, { color: T.textMuted }]}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[s.integAddBtn, { backgroundColor: (!f1.trim() || !f2.trim()) ? T.inputBg : '#3B82F6', flex: 1 }]}
              onPress={handle}
              disabled={!f1.trim() || !f2.trim()}
            >
              <Text style={[s.integAddBtnText, { color: (!f1.trim() || !f2.trim()) ? T.textFaint : '#fff' }]}>Add</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Add Calendar Modal ────────────────────────────────────────────────────────

function AddCalendarModal({ visible, onClose, onAdd, T }) {
  const [name,     setName]     = useState('');
  const [url,      setUrl]      = useState('');
  const [calendar, setCalendar] = useState('plan');

  function handle() {
    if (!name.trim() || !url.trim()) return;
    onAdd(name.trim(), url.trim(), calendar);
    setName(''); setUrl('');
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.tutOverlay}>
        <View style={[s.tzCard, { backgroundColor: T.surface }]}>
          <Text style={[s.tzCardTitle, { color: T.text }]}>Add Calendar</Text>
          <TextInput
            style={[s.integInput, { backgroundColor: T.inputBg, borderColor: T.inputBorder, color: T.text }]}
            placeholder="Calendar name"
            placeholderTextColor={T.placeholder}
            value={name}
            onChangeText={setName}
            autoFocus
          />
          <TextInput
            style={[s.integInput, { backgroundColor: T.inputBg, borderColor: T.inputBorder, color: T.text, marginTop: 8 }]}
            placeholder="ICS URL (webcal:// or https://)"
            placeholderTextColor={T.placeholder}
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <View style={[s.segmentBar, { backgroundColor: T.segmentBg, marginTop: 10 }]}>
            {[{ value: 'plan', label: 'Plan' }, { value: 'actual', label: 'Live' }].map(opt => (
              <Pressable
                key={opt.value}
                onPress={() => setCalendar(opt.value)}
                style={[s.segmentBtn, calendar === opt.value && [s.segmentBtnActive, { backgroundColor: T.segmentActive }]]}
              >
                <Text style={[s.segmentTxt, { color: calendar === opt.value ? T.segmentTxtAct : T.segmentTxt, fontWeight: calendar === opt.value ? '700' : '500' }]}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={s.integBtns}>
            <Pressable style={[s.cancelBtn, { borderColor: T.border, flex: 1, marginRight: 6 }]} onPress={() => { setName(''); setUrl(''); onClose(); }}>
              <Text style={[s.cancelBtnText, { color: T.textMuted }]}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[s.integAddBtn, { flex: 1, backgroundColor: (name.trim() && url.trim()) ? T.accent : T.inputBg }]}
              onPress={handle}
              disabled={!name.trim() || !url.trim()}
            >
              <Text style={[s.integAddBtnText, { color: (name.trim() && url.trim()) ? '#fff' : T.textFaint }]}>Add</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const {
    auth, events, T,
    militaryTime,        setMilitaryTime,
    darkMode,            setDarkMode,
    weekNumbers,         setWeekNumbers,
    weekStartsMonday,    setWeekStartsMonday,
    showLiveTab,         setShowLiveTab,
    showRealityTab,      setShowRealityTab,
    defaultView,         setDefaultView,
    pushEnabled,         setPushEnabled,
    minimalistMode,      setMinimalistMode,
    showQuickAdd,        setShowQuickAdd,
    showPrecisionToggle, setShowPrecisionToggle,
    showCategoriesMenu,  setShowCategoriesMenu,
    showFab,             setShowFab,
    fabDraggable,        setFabDraggable,
    fontPreference,      setFontPreference,
    timezones,           setTimezones,
    budgets,             setBudget,    deleteBudget,
    integrations,        addIntegration, updateIntegration, deleteIntegration,
    profile,             setProfile,
    habits,
    llmSettings,         setLlmSettings,
    assumeCompleted,     setAssumeCompleted,
  } = useContext(AppContext);

  const navigation = useNavigation();
  const [query,           setQuery]           = useState('');
  const [showTutorial,    setShowTutorial]    = useState(false);
  const [showTodoTutorial, setShowTodoTutorial] = useState(false);
  const [tzPickerOpen,    setTzPickerOpen]    = useState(false);
  const [addIntOpen,      setAddIntOpen]      = useState(false);
  const [addAddrOpen,     setAddAddrOpen]     = useState(false);
  const [addPhoneOpen,    setAddPhoneOpen]    = useState(false);
  const [addCalOpen,      setAddCalOpen]      = useState(false);
  const [pendingDelCal,   setPendingDelCal]   = useState(null);

  // Habit add form state
  const HABIT_COLORS = ['#7C3AED','#3B82F6','#10B981','#F59E0B','#EF4444','#EC4899','#06B6D4','#F97316'];
  const [addingHabit,     setAddingHabit]     = useState(false);
  const [habitLabel,      setHabitLabel]      = useState('');
  const [habitColor,      setHabitColor]      = useState('#7C3AED');
  const [habitFreqKey,    setHabitFreqKey]    = useState('daily');
  const HABIT_FREQS = [
    { key: 'daily',    label: 'Daily',    days: [0,1,2,3,4,5,6] },
    { key: 'weekdays', label: 'Weekdays', days: [1,2,3,4,5] },
    { key: 'weekends', label: 'Weekends', days: [0,6] },
  ];

  function submitHabit() {
    if (!habitLabel.trim()) return;
    const freq = HABIT_FREQS.find(f => f.key === habitFreqKey);
    habits.addHabit({ label: habitLabel.trim(), color: habitColor, target_days: freq.days });
    setHabitLabel(''); setHabitColor('#7C3AED'); setHabitFreqKey('daily'); setAddingHabit(false);
  }

  // No Touchy admin state
  const [noTouchyOpen,    setNoTouchyOpen]    = useState(false);
  const [adminAuthed,     setAdminAuthed]     = useState(false);
  const [adminPwDraft,    setAdminPwDraft]    = useState('');
  const [adminAuthErr,    setAdminAuthErr]    = useState('');
  const [adminAuthing,    setAdminAuthing]    = useState(false);
  const [secrets,         setSecrets]         = useState([]);
  const [secretsLoading,  setSecretsLoading]  = useState(false);

  async function adminFetch(method, path, body) {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...((_adminToken) ? { Authorization: `Bearer ${_adminToken}` } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    if (res.status === 401 || res.status === 403) { _adminToken = null; setAdminAuthed(false); throw new Error('Session expired'); }
    if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error ?? `${method} ${path} → ${res.status}`); }
    return res.json();
  }

  async function handleAdminAuth() {
    setAdminAuthing(true); setAdminAuthErr('');
    try {
      // Use regular user token for initial auth endpoint
      const authRes = await fetch(`${BASE_URL}/admin/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(events.authToken ? { Authorization: `Bearer ${events.authToken}` } : {}) },
        body: JSON.stringify({ password: adminPwDraft }),
      });
      if (!authRes.ok) { const j = await authRes.json().catch(() => ({})); throw new Error(j.error ?? 'Wrong password'); }
      const { token } = await authRes.json();
      _adminToken = token;
      setAdminAuthed(true); setAdminPwDraft('');
      loadSecrets();
    } catch (e) { setAdminAuthErr(e.message); }
    finally { setAdminAuthing(false); }
  }

  async function loadSecrets() {
    setSecretsLoading(true);
    try { setSecrets(await adminFetch('GET', '/admin/secrets')); }
    catch { setSecrets([]); }
    finally { setSecretsLoading(false); }
  }

  async function handleDeleteSecret(key) {
    Alert.alert('Delete secret', `Remove "${key}" from the registry?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await adminFetch('DELETE', `/admin/secrets/${key}`); loadSecrets(); }
        catch (e) { Alert.alert('Error', e.message); }
      }},
    ]);
  }

  // Category management state
  const [editingCatId,     setEditingCatId]     = useState(null);
  const [catLabelDraft,    setCatLabelDraft]     = useState('');
  const [colorPickingId,   setColorPickingId]    = useState(null);
  const [pendingDelCat,    setPendingDelCat]     = useState(null);
  const [addingCat,        setAddingCat]         = useState(false);
  const [newCatLabel,      setNewCatLabel]       = useState('');
  const [newCatColor,      setNewCatColor]       = useState('#3B82F6');
  const [newCatColorPick,  setNewCatColorPick]   = useState(false);

  // ── Collapse-all state ──────────────────────────────────────────────────────
  const [collapseKey,  setCollapseKey]  = useState(0);
  const [openCount,    setOpenCount]    = useState(1); // Appearance starts open

  function handleSectionToggle(isNow) {
    setOpenCount(c => isNow ? c + 1 : Math.max(0, c - 1));
  }

  function collapseAll() {
    setCollapseKey(k => k + 1);
    setOpenCount(0);
  }

  const q = query.toLowerCase().trim();

  function matches(...terms) {
    if (!q) return true;
    return terms.some(t => typeof t === 'string' && t.toLowerCase().includes(q));
  }

  function handleLogout() {
    Alert.alert(
      'Log Out',
      'You will need your password to log back in.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log Out', style: 'destructive', onPress: () => auth.logout() },
      ]
    );
  }

  function getTzLabel(id) {
    const found = COMMON_TIMEZONES.find(t => t.id === id);
    return found ? found.label : id.replace(/_/g, ' ');
  }

  function getTzTime(id) {
    try {
      return new Intl.DateTimeFormat(undefined, {
        timeZone: id, hour: '2-digit', minute: '2-digit', hour12: !militaryTime,
      }).format(new Date());
    } catch { return '—'; }
  }

  function getHabitFreqLabel(habit) {
    const days = habit.target_days ?? [0, 1, 2, 3, 4, 5, 6];
    if (days.length === 7) return 'Daily';
    if (JSON.stringify(days) === '[1,2,3,4,5]') return 'Weekdays';
    if (JSON.stringify(days) === '[0,6]') return 'Weekends';
    return `${days.length}d/wk`;
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: T.bg }]} edges={['top']}>
      <View style={[s.header, { backgroundColor: T.headerBg, borderBottomColor: T.border }]}>
        <Text style={[s.title, { color: T.text }]}>Settings</Text>
      </View>

      <SearchBar value={query} onChangeText={setQuery} T={T} />

      {/* ── Collapse-all pill — visible when 2+ sections are open ── */}
      {openCount > 1 && (
        <Pressable
          onPress={collapseAll}
          style={[s.collapseRow, { backgroundColor: T.accentLight, borderBottomColor: T.borderLight }]}
        >
          <Ionicons name="chevron-up-circle-outline" size={14} color={T.accent} />
          <Text style={[s.collapseTxt, { color: T.accent }]}>Collapse all sections</Text>
        </Pressable>
      )}

      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── Appearance ── */}
        {matches('appearance', 'dark mode', 'military time', 'week numbers', 'theme', '24 hour',
                 'minimal', 'minimalist', 'font', 'floating', 'quick add', 'precision', 'categories menu',
                 'live tab', 'see your life', 'search bar', 'week numbers', 'draggable') && (
          <Section title="Appearance" icon="color-palette-outline" defaultOpen forceOpen={!!q} collapseKey={collapseKey} onToggle={handleSectionToggle} T={T}>
            {/* Core toggles */}
            <SettingRow label="Dark Mode"     sub="Switch the app to a dark color scheme"  value={darkMode}       onValueChange={setDarkMode}       T={T} />
            <SettingRow label="Military Time" sub="24-hour clock — shows 14:00 instead of 2 PM" value={militaryTime}   onValueChange={setMilitaryTime}   T={T} />
            <SettingRow label="Week Numbers"  sub="Show ISO week number next to each week" value={weekNumbers}    onValueChange={setWeekNumbers}    T={T} />
            <Divider T={T} />

            {/* ── Minimalist mode ── */}
            <View style={s.row}>
              <View style={s.rowLeft}>
                <Text style={[s.rowTitle, { color: T.text }]}>Most Minimal</Text>
                <Text style={[s.rowSub, { color: T.textFaint }]}>Hides everything below for a clean, distraction-free experience</Text>
              </View>
              <Switch value={minimalistMode} onValueChange={setMinimalistMode} trackColor={{ false: T.switchFalse, true: T.switchTrue }} thumbColor="#fff" />
            </View>
            <View style={[s.minimalistGroup, { borderLeftColor: T.borderLight, opacity: minimalistMode ? 0.4 : 1 }]}>
              <SettingRow label="Live Tab"            sub="Show the Live Calendar tab"            value={minimalistMode ? false : showLiveTab}    onValueChange={v => { if (!minimalistMode) setShowLiveTab(v); }}    T={T} />
              <SettingRow label="See Your Life Tab"   sub="Show the See Your Life tab"            value={minimalistMode ? false : showRealityTab} onValueChange={v => { if (!minimalistMode) setShowRealityTab(v); }} T={T} />
              <SettingRow label="Quick Add Button"    sub="Show the floating + button"            value={minimalistMode ? false : showFab}        onValueChange={v => { if (!minimalistMode) setShowFab(v); }}        T={T} />
              <SettingRow label="Precision Toggle"    sub="30m / 1h precision switch in header"  value={minimalistMode ? false : showPrecisionToggle} onValueChange={v => { if (!minimalistMode) setShowPrecisionToggle(v); }} T={T} />
              <SettingRow label="Categories Menu"     sub="Category filter chip bar"             value={minimalistMode ? false : showCategoriesMenu}  onValueChange={v => { if (!minimalistMode) setShowCategoriesMenu(v); }}  T={T} last />
            </View>
            <Divider T={T} />

            {/* ── Font ── */}
            <View style={s.fontSection}>
              <Text style={[s.subHeader, { color: T.textFaint }]}>FONT</Text>
              {FONT_OPTIONS.map((f, i) => (
                <Pressable
                  key={f.key}
                  style={s.fontRow}
                  onPress={() => setFontPreference(f.key)}
                >
                  <View style={[s.fontRadio, {
                    borderColor: fontPreference === f.key ? T.accent : T.textFaint,
                    backgroundColor: fontPreference === f.key ? T.accent : 'transparent',
                  }]} />
                  <Text style={[s.fontLabel, { color: T.text, fontFamily: f.family }]}>{f.label}</Text>
                  <Text style={[s.fontGroup, { color: T.textFaint }]}>{f.group}</Text>
                  <Text style={[s.fontPreview, { color: T.textMuted, fontFamily: f.family }]}>Abc</Text>
                </Pressable>
              ))}
            </View>
            <Divider T={T} />

            {/* ── Floating Button options ── */}
            <View style={s.floatSection}>
              <Text style={[s.subHeader, { color: T.textFaint }]}>FLOATING BUTTON</Text>
              <SettingRow label="Show floating button" sub="Quick-add button in Plan & Live" value={showFab} onValueChange={setShowFab} T={T} />
              {showFab && (
                <SettingRow label="Allow dragging" sub="Drag the button to reposition it" value={fabDraggable} onValueChange={setFabDraggable} T={T} last />
              )}
            </View>
          </Section>
        )}

        {/* ── Calendar ── */}
        {matches('calendar', 'week starts', 'sunday', 'monday', 'default tab', 'plan', 'live', 'assume', 'auto-log', 'auto log') && (
          <Section title="Calendar" icon="calendar-outline" forceOpen={!!q} collapseKey={collapseKey} onToggle={handleSectionToggle} T={T}>
            <SegmentRow
              label="Week Starts On"
              options={[{ label: 'Sunday', value: false }, { label: 'Monday', value: true }]}
              value={weekStartsMonday}
              onChange={setWeekStartsMonday}
              T={T}
            />
            <SegmentRow
              label="Default Tab"
              options={[
                { label: 'Plan',     value: 'Plan' },
                { label: 'Live',     value: 'Live' },
                { label: 'See Life', value: 'See Your Life' },
              ]}
              value={defaultView}
              onChange={setDefaultView}
              T={T}
            />
            <SettingRow
              label="Assume Planned Events Happened"
              sub={assumeCompleted
                ? "Unedited planned events auto-log as done once their time passes"
                : "Off — every planned event needs manual confirmation in Live"}
              value={assumeCompleted}
              onValueChange={setAssumeCompleted}
              last
              T={T}
            />
          </Section>
        )}

        {/* ── Visible Tabs (now nested under Appearance minimalist group, but keep standalone for search) ── */}
        {q && matches('tabs', 'visible') && (
          <Section title="Visible Tabs" icon="apps-outline" forceOpen collapseKey={collapseKey} onToggle={handleSectionToggle} T={T}>
            <SettingRow label="Live Tab"          sub="Log what you actually did each day"  value={showLiveTab}    onValueChange={setShowLiveTab}    T={T} />
            <SettingRow label="See Your Life Tab" sub="Weekly plan-vs-actual breakdown"     value={showRealityTab} onValueChange={setShowRealityTab} T={T} last />
          </Section>
        )}

        {/* ── Time Zones ── */}
        {matches('timezone', 'time zone', 'clock', 'utc', 'gmt', 'primary') && (
          <Section title="Time Zones" icon="globe-outline" forceOpen={!!q} collapseKey={collapseKey} onToggle={handleSectionToggle} T={T}>
            <View style={s.tzSection}>
              <Text style={[s.rowSub, { color: T.textFaint, marginBottom: 8 }]}>
                Set your primary time zone and add up to 4 more for quick reference.
              </Text>
              {timezones.map((tz, idx) => (
                <View key={tz} style={[s.tzRow, { borderBottomColor: T.borderLight }]}>
                  <View style={s.tzRowLeft}>
                    {idx === 0 && (
                      <View style={[s.primaryBadge, { borderColor: '#3B82F6' }]}>
                        <Text style={s.primaryBadgeText}>Primary</Text>
                      </View>
                    )}
                    <Text style={[s.tzLabel, { color: T.text }]}>{getTzLabel(tz)}</Text>
                    <Text style={[s.tzTime, { color: T.textFaint }]}>{getTzTime(tz)}</Text>
                  </View>
                  <View style={s.tzRowRight}>
                    {idx > 0 && (
                      <Pressable
                        hitSlop={8}
                        style={[s.tzActionBtn, { backgroundColor: T.inputBg }]}
                        onPress={() => setTimezones(prev => {
                          const next = [...prev];
                          next.splice(idx, 1);
                          next.unshift(tz);
                          return next;
                        })}
                      >
                        <Ionicons name="arrow-up" size={14} color={T.textMuted} />
                      </Pressable>
                    )}
                    <Pressable
                      hitSlop={8}
                      style={[s.tzActionBtn, { backgroundColor: T.inputBg }]}
                      disabled={timezones.length === 1}
                      onPress={() => setTimezones(prev => prev.filter((_, i) => i !== idx))}
                    >
                      <Ionicons name="close" size={14} color={timezones.length === 1 ? T.textFaint : T.danger} />
                    </Pressable>
                  </View>
                </View>
              ))}
              {timezones.length < 5 ? (
                <Pressable style={s.addTzBtn} onPress={() => setTzPickerOpen(true)}>
                  <Ionicons name="add" size={16} color={T.accent} />
                  <Text style={[s.addTzText, { color: T.accent }]}>Add time zone</Text>
                </Pressable>
              ) : (
                <Text style={[s.rowSub, { color: T.textFaint, marginTop: 8 }]}>Maximum of 5 time zones reached.</Text>
              )}
            </View>
          </Section>
        )}

        {/* ── Search Options ── */}
        {matches('search', 'find', 'shortcut', 'options') && (
          <Section title="Search Options" icon="search-outline" forceOpen={!!q} collapseKey={collapseKey} onToggle={handleSectionToggle} T={T}>
            <View style={s.tzSection}>
              <Text style={[s.rowSub, { color: T.textFaint, marginBottom: 10 }]}>
                Tap the search icon at the top of any screen to search events, categories, and more. Results are filtered in real time as you type.
              </Text>
              <View style={[s.searchTipCard, { backgroundColor: T.accentLight, borderColor: T.border }]}>
                <Ionicons name="bulb-outline" size={16} color={T.accent} />
                <Text style={[s.searchTipText, { color: T.text }]}>
                  <Text style={{ fontWeight: '700' }}>Tip: </Text>
                  Search works in Settings too — try typing a setting name in the bar above.
                </Text>
              </View>
            </View>
          </Section>
        )}

        {/* ── Manage Categories ── */}
        {matches('categories', 'category', 'color', 'label', ...events.allCategories.map(c => c.label.toLowerCase())) && (
          <Section title="Manage Categories" icon="pricetag-outline" forceOpen={!!q} collapseKey={collapseKey} onToggle={handleSectionToggle} T={T}>
            <View style={s.catSection}>
              {events.allCategories.map((cat, i) => {
                const isEditing    = editingCatId    === cat.id;
                const isPicking    = colorPickingId  === cat.id;
                const isConfirming = pendingDelCat   === cat.id;
                return (
                  <View key={cat.id}>
                    <View style={s.catRow}>
                      {/* Color swatch / picker trigger */}
                      <Pressable
                        hitSlop={6}
                        onPress={() => {
                          setColorPickingId(isPicking ? null : cat.id);
                          setEditingCatId(null);
                        }}
                        style={[s.catSwatch, {
                          backgroundColor: cat.color,
                          borderWidth: isPicking ? 2 : 0,
                          borderColor: '#9CA3AF',
                        }]}
                      />

                      {/* Label */}
                      {isEditing ? (
                        <TextInput
                          style={[s.catLabelInput, { backgroundColor: T.inputBg, borderColor: T.accent, color: T.text }]}
                          value={catLabelDraft}
                          onChangeText={setCatLabelDraft}
                          autoFocus
                          returnKeyType="done"
                          onSubmitEditing={() => {
                            const t = catLabelDraft.trim();
                            if (t && t !== cat.label) events.updateCategory(cat.id, { label: t });
                            setEditingCatId(null);
                          }}
                          onBlur={() => {
                            const t = catLabelDraft.trim();
                            if (t && t !== cat.label) events.updateCategory(cat.id, { label: t });
                            setEditingCatId(null);
                          }}
                        />
                      ) : (
                        <Text style={[s.catName, { color: T.text }]} numberOfLines={1}>{cat.label}</Text>
                      )}

                      {/* Buttons */}
                      {!isConfirming && !isEditing && (
                        <>
                          <Pressable
                            hitSlop={8}
                            style={[s.catBtn, { backgroundColor: T.inputBg }]}
                            onPress={() => { setEditingCatId(cat.id); setCatLabelDraft(cat.label); setColorPickingId(null); }}
                          >
                            <Ionicons name="pencil-outline" size={14} color={T.textMuted} />
                          </Pressable>
                          <Pressable
                            hitSlop={8}
                            style={[s.catBtn, { backgroundColor: T.inputBg }]}
                            onPress={() => { setPendingDelCat(cat.id); setColorPickingId(null); setEditingCatId(null); }}
                          >
                            <Ionicons name="close" size={14} color={T.danger} />
                          </Pressable>
                        </>
                      )}
                    </View>

                    {/* Color picker */}
                    {isPicking && (
                      <View style={s.swatchGrid}>
                        {PRESET_COLORS.map(c => (
                          <Pressable
                            key={c}
                            style={[s.swatchBtn, {
                              backgroundColor: c,
                              borderWidth: c === cat.color ? 2 : 0,
                              borderColor: '#9CA3AF',
                              transform: [{ scale: c === cat.color ? 1.15 : 1 }],
                            }]}
                            onPress={() => { events.updateCategory(cat.id, { color: c }); setColorPickingId(null); }}
                          />
                        ))}
                      </View>
                    )}

                    {/* Delete confirm */}
                    {isConfirming && (
                      <View style={s.confirmRow}>
                        <Text style={[s.confirmText, { color: T.danger }]}>Delete "{cat.label}"?</Text>
                        <Pressable style={[s.confirmCancelBtn, { borderColor: T.border }]} onPress={() => setPendingDelCat(null)}>
                          <Text style={[s.confirmCancelText, { color: T.textMuted }]}>Cancel</Text>
                        </Pressable>
                        <Pressable style={s.confirmDeleteBtn} onPress={() => { events.deleteCategory(cat.id); setPendingDelCat(null); }}>
                          <Text style={s.confirmDeleteText}>Delete</Text>
                        </Pressable>
                      </View>
                    )}

                    {i < events.allCategories.length - 1 && <Divider T={T} />}
                  </View>
                );
              })}

              {/* Add new category */}
              {addingCat ? (
                <View style={s.addCatForm}>
                  <View style={s.addCatRow}>
                    <Pressable
                      style={[s.catSwatch, { backgroundColor: newCatColor, borderWidth: newCatColorPick ? 2 : 0, borderColor: '#9CA3AF' }]}
                      onPress={() => setNewCatColorPick(v => !v)}
                    />
                    <TextInput
                      style={[s.catLabelInput, { flex: 1, backgroundColor: T.inputBg, borderColor: T.accent, color: T.text }]}
                      placeholder="Category name"
                      placeholderTextColor={T.placeholder}
                      value={newCatLabel}
                      onChangeText={setNewCatLabel}
                      autoFocus
                    />
                  </View>
                  {newCatColorPick && (
                    <View style={s.swatchGrid}>
                      {PRESET_COLORS.map(c => (
                        <Pressable
                          key={c}
                          style={[s.swatchBtn, {
                            backgroundColor: c,
                            borderWidth: c === newCatColor ? 2 : 0,
                            borderColor: '#9CA3AF',
                            transform: [{ scale: c === newCatColor ? 1.15 : 1 }],
                          }]}
                          onPress={() => { setNewCatColor(c); setNewCatColorPick(false); }}
                        />
                      ))}
                    </View>
                  )}
                  <View style={s.addCatBtns}>
                    <Pressable style={[s.cancelBtn, { borderColor: T.border, flex: 1, marginRight: 6 }]}
                      onPress={() => { setAddingCat(false); setNewCatLabel(''); setNewCatColorPick(false); }}>
                      <Text style={[s.cancelBtnText, { color: T.textMuted }]}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      style={[s.integAddBtn, { flex: 1, backgroundColor: newCatLabel.trim() ? '#3B82F6' : T.inputBg }]}
                      onPress={() => {
                        if (!newCatLabel.trim()) return;
                        events.addCategory({ label: newCatLabel.trim(), color: newCatColor });
                        setNewCatLabel(''); setAddingCat(false); setNewCatColorPick(false);
                      }}
                    >
                      <Text style={[s.integAddBtnText, { color: newCatLabel.trim() ? '#fff' : T.textFaint }]}>Add</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable style={s.addTzBtn} onPress={() => { setAddingCat(true); setNewCatLabel(''); setNewCatColor('#3B82F6'); }}>
                  <Ionicons name="add" size={16} color={T.accent} />
                  <Text style={[s.addTzText, { color: T.accent }]}>Add category</Text>
                </Pressable>
              )}
            </View>
          </Section>
        )}

        {/* ── Time Budgets ── */}
        {matches('budget', 'time budget', 'hours', 'weekly', ...events.allCategories.map(c => c.label.toLowerCase())) && (
          <Section title="Time Budgets" icon="timer-outline" forceOpen={!!q} collapseKey={collapseKey} onToggle={handleSectionToggle} T={T}>
            <View style={s.budgetSection}>
              <Text style={[s.rowSub, { color: T.textFaint, marginBottom: 10 }]}>
                Set weekly hour targets per category. They appear as progress bars in See Your Life.
              </Text>
              {events.allCategories.map((cat, i) => (
                <View key={cat.id}>
                  <View style={s.budgetRow}>
                    <View style={[s.catSwatch, { backgroundColor: cat.color, marginRight: 10 }]} />
                    <Text style={[s.catName, { flex: 1, color: T.text }]} numberOfLines={1}>{cat.label}</Text>
                    <TextInput
                      style={[s.budgetInput, { backgroundColor: T.inputBg, borderColor: T.inputBorder, color: T.text }]}
                      keyboardType="decimal-pad"
                      value={budgets[cat.id] != null ? String(budgets[cat.id]) : ''}
                      placeholder="—"
                      placeholderTextColor={T.placeholder}
                      onChangeText={val => {
                        if (val === '') { deleteBudget(cat.id); return; }
                        const n = parseFloat(val);
                        if (!isNaN(n)) setBudget(cat.id, n);
                      }}
                    />
                    <Text style={[s.budgetUnit, { color: T.textFaint }]}>h/wk</Text>
                  </View>
                  {i < events.allCategories.length - 1 && <Divider T={T} />}
                </View>
              ))}
            </View>
          </Section>
        )}

        {/* ── Habit Tracker ── */}
        {matches('habit', 'habits', 'daily', 'tracker', 'routine') && (
          <Section title="Habit Tracker" icon="checkmark-circle-outline" forceOpen={!!q} collapseKey={collapseKey} onToggle={handleSectionToggle} T={T}>
            <View style={s.habitSection}>
              {/* Link to See Your Life tab */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 }}>
                <Text style={[s.rowSub, { color: T.textFaint }]}>Check off habits in the </Text>
                <Pressable onPress={() => navigation.dispatch(CommonActions.navigate({ name: 'See Your Life' }))}>
                  <Text style={[s.rowSub, { color: T.accent, fontWeight: '600' }]}>See Your Life</Text>
                </Pressable>
                <Text style={[s.rowSub, { color: T.textFaint }]}> tab.</Text>
              </View>

              {/* Habit list */}
              {habits.habits.length === 0 ? (
                <Text style={[s.emptyText, { color: T.textFaint }]}>No habits yet.</Text>
              ) : (
                habits.habits.map((habit, i) => (
                  <View key={habit.id}>
                    <View style={s.habitRow}>
                      <View style={[s.catSwatch, { backgroundColor: habit.color || '#8B5CF6', marginRight: 10 }]} />
                      <Text style={[s.catName, { flex: 1, color: T.text }]} numberOfLines={1}>{habit.label}</Text>
                      <Text style={[s.habitFreq, { color: T.textFaint }]}>{getHabitFreqLabel(habit)}</Text>
                      <Pressable hitSlop={8} onPress={() => habits.deleteHabit(habit.id)}>
                        <Ionicons name="trash-outline" size={16} color={T.danger} />
                      </Pressable>
                    </View>
                    {i < habits.habits.length - 1 && <Divider T={T} />}
                  </View>
                ))
              )}

              {/* Add habit form */}
              {addingHabit ? (
                <View style={[s.addHabitForm, { borderColor: T.accent, backgroundColor: T.surface }]}>
                  <TextInput
                    autoFocus
                    value={habitLabel}
                    onChangeText={setHabitLabel}
                    onSubmitEditing={submitHabit}
                    placeholder="Habit name…"
                    placeholderTextColor={T.placeholder}
                    style={[s.addHabitInput, { color: T.text, borderBottomColor: T.border }]}
                    returnKeyType="done"
                  />
                  {/* Color picker */}
                  <View style={s.habitColorRow}>
                    {HABIT_COLORS.map(c => (
                      <Pressable key={c} onPress={() => setHabitColor(c)}
                        style={[s.habitColorDot, { backgroundColor: c,
                          borderWidth: habitColor === c ? 2.5 : 0,
                          borderColor: c, opacity: habitColor === c ? 1 : 0.7,
                          transform: [{ scale: habitColor === c ? 1.2 : 1 }] }]}
                      />
                    ))}
                  </View>
                  {/* Frequency */}
                  <View style={s.habitFreqRow}>
                    {HABIT_FREQS.map(opt => (
                      <Pressable key={opt.key} onPress={() => setHabitFreqKey(opt.key)}
                        style={[s.habitFreqBtn, { backgroundColor: habitFreqKey === opt.key ? T.accent : T.inputBg, borderColor: T.border }]}>
                        <Text style={{ fontSize: 11, fontWeight: '600', color: habitFreqKey === opt.key ? '#fff' : T.textMuted }}>{opt.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                    <Pressable style={[s.addTzBtn, { flex: 1, justifyContent: 'center', opacity: habitLabel.trim() ? 1 : 0.4 }]} onPress={submitHabit} disabled={!habitLabel.trim()}>
                      <Text style={{ color: T.accent, fontSize: 13, fontWeight: '600' }}>Add Habit</Text>
                    </Pressable>
                    <Pressable onPress={() => { setAddingHabit(false); setHabitLabel(''); }} style={[s.addTzBtn, { borderColor: T.border }]}>
                      <Text style={{ color: T.textMuted, fontSize: 13 }}>Cancel</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable style={[s.addTzBtn, { marginTop: 8 }]} onPress={() => setAddingHabit(true)}>
                  <Ionicons name="add" size={16} color={T.accent} />
                  <Text style={{ color: T.accent, fontSize: 13, fontWeight: '600', marginLeft: 4 }}>Add habit</Text>
                </Pressable>
              )}
            </View>
          </Section>
        )}

        {/* ── Notifications & Integrations ── */}
        {matches('notifications', 'push', 'discord', 'slack', 'webhook', 'alert', 'reminder', 'integration') && (
          <Section title="Notifications & Integrations" icon="notifications-outline" forceOpen={!!q} collapseKey={collapseKey} onToggle={handleSectionToggle} T={T}>
            <View style={s.integSection}>
              <Text style={[s.rowSub, { color: T.textFaint, marginBottom: 10 }]}>
                Connect Discord or Slack webhooks for event reminders. Event labels stay private unless the server supports it.
              </Text>

              {/* Push toggle */}
              <View style={s.row}>
                <View style={s.rowLeft}>
                  <Text style={[s.rowTitle, { color: T.text }]}>Push Notifications</Text>
                  <Text style={[s.rowSub, { color: T.textFaint }]}>Event reminders sent to this device</Text>
                </View>
                <Switch
                  value={pushEnabled}
                  onValueChange={setPushEnabled}
                  trackColor={{ false: T.switchFalse, true: T.switchTrue }}
                  thumbColor="#fff"
                />
              </View>

              {integrations.length > 0 && (
                <>
                  <Divider T={T} />
                  {integrations.map((intg, i) => (
                    <View key={intg.id}>
                      <View style={s.integRow}>
                        <Text style={s.integIcon}>
                          {intg.type === 'discord_webhook' ? '🎮' : intg.type === 'slack_webhook' ? '💬' : '🔗'}
                        </Text>
                        <View style={s.integInfo}>
                          <Text style={[s.catName, { color: T.text }]} numberOfLines={1}>{intg.label || intg.type}</Text>
                          <Text style={[s.rowSub, { color: T.textFaint }]}>{intg.enabled ? 'Active' : 'Disabled'}</Text>
                        </View>
                        <Switch
                          value={intg.enabled}
                          onValueChange={v => updateIntegration(intg.id, { enabled: v })}
                          trackColor={{ false: T.switchFalse, true: T.switchTrue }}
                          thumbColor="#fff"
                          style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                        />
                        <Pressable hitSlop={8} onPress={() => deleteIntegration(intg.id)} style={{ marginLeft: 4 }}>
                          <Ionicons name="trash-outline" size={16} color={T.danger} />
                        </Pressable>
                      </View>
                      {i < integrations.length - 1 && <Divider T={T} />}
                    </View>
                  ))}
                </>
              )}

              <Pressable style={[s.addTzBtn, { marginTop: 8 }]} onPress={() => setAddIntOpen(true)}>
                <Ionicons name="add" size={16} color={T.accent} />
                <Text style={[s.addTzText, { color: T.accent }]}>Add Discord / Slack / Webhook</Text>
              </Pressable>
            </View>
          </Section>
        )}

        {/* ── Zero-Knowledge Encryption ── */}
        {/* ── Connected Calendars ── */}
        {matches('connected', 'calendar', 'ics', 'import', 'export', 'linked', 'subscribe', 'url') && (
          <Section title="Connected Calendars" icon="link-outline" forceOpen={!!q} collapseKey={collapseKey} onToggle={handleSectionToggle} T={T}>
            <View style={s.connectedSection}>
              <Text style={[s.rowSub, { color: T.textFaint, marginBottom: 10 }]}>
                Subscribe to ICS calendars via URL. Changes sync automatically next time you open the app.
              </Text>

              {/* Linked calendar list */}
              {events.linkedCalendars.length === 0 ? (
                <Text style={[s.emptyText, { color: T.textFaint }]}>No linked calendars yet.</Text>
              ) : (
                events.linkedCalendars.map((cal, i) => {
                  const isConfirming = pendingDelCal === cal.id;
                  const count = events.events.filter(e => e.source_calendar_id === cal.id).length;
                  return (
                    <View key={cal.id}>
                      <View style={s.calRow}>
                        <View style={[s.calSwatch, { backgroundColor: cal.color || '#6B7280' }]} />
                        <View style={{ flex: 1 }}>
                          <Text style={[s.catName, { color: T.text }]} numberOfLines={1}>{cal.name}</Text>
                          <Text style={[s.rowSub, { color: T.textFaint }]}>
                            {count} event{count !== 1 ? 's' : ''} · Imported {cal.importedAt}
                          </Text>
                        </View>
                        {!isConfirming && (
                          <Pressable hitSlop={8} onPress={() => setPendingDelCal(cal.id)}>
                            <Ionicons name="close-circle-outline" size={18} color={T.danger} />
                          </Pressable>
                        )}
                      </View>
                      {isConfirming && (
                        <View style={s.confirmRow}>
                          <Text style={[s.confirmText, { color: T.danger }]}>Remove {count} event{count !== 1 ? 's' : ''}?</Text>
                          <Pressable style={[s.confirmCancelBtn, { borderColor: T.border }]} onPress={() => setPendingDelCal(null)}>
                            <Text style={[s.confirmCancelText, { color: T.textMuted }]}>Cancel</Text>
                          </Pressable>
                          <Pressable style={s.confirmDeleteBtn} onPress={() => { events.deleteLinkedCalendar(cal.id); setPendingDelCal(null); }}>
                            <Text style={s.confirmDeleteText}>Remove</Text>
                          </Pressable>
                        </View>
                      )}
                      {i < events.linkedCalendars.length - 1 && <Divider T={T} />}
                    </View>
                  );
                })
              )}

              <Pressable style={[s.addTzBtn, { marginTop: 8 }]} onPress={() => setAddCalOpen(true)}>
                <Ionicons name="add" size={16} color={T.accent} />
                <Text style={[s.addTzText, { color: T.accent }]}>Add calendar URL</Text>
              </Pressable>
            </View>
          </Section>
        )}

        {/* ── AI-Assisted Parsing ── */}
        {matches('ai', 'llm', 'voice', 'parsing', 'anthropic', 'openai', 'api key', 'mic', 'speech', 'paste') && (
          <Section title="AI-Assisted Parsing" icon="sparkles-outline" forceOpen={!!q} collapseKey={collapseKey} onToggle={handleSectionToggle} T={T}>
            <View style={s.integSection}>
              <Text style={[s.rowSub, { color: T.textFaint, marginBottom: 10 }]}>
                By default, "Add Events from Text" uses a free, local, offline parser. Optionally connect your own LLM for smarter multi-event extraction and category guessing. Your text and API key are sent directly from this app to the provider you choose below — never through any third-party server.
              </Text>
              <View style={[s.segmentBar, { backgroundColor: T.segmentBg }]}>
                {LLM_PROVIDERS.map(p => (
                  <Pressable
                    key={p.id}
                    onPress={() => setLlmSettings(prev => ({ ...prev, provider: p.id }))}
                    style={[s.segmentBtn, llmSettings.provider === p.id && [s.segmentBtnActive, { backgroundColor: T.segmentActive }]]}
                  >
                    <Text style={[s.segmentTxt, { color: llmSettings.provider === p.id ? T.segmentTxtAct : T.segmentTxt, fontWeight: llmSettings.provider === p.id ? '700' : '500' }]}>
                      {p.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {llmSettings.provider !== 'none' && (
                <>
                  <Divider T={T} />
                  <ProfileField
                    label="API KEY"
                    value={llmSettings.apiKey}
                    onSave={v => setLlmSettings(prev => ({ ...prev, apiKey: v }))}
                    placeholder="sk-..."
                    secureTextEntry
                    T={T}
                  />
                  {llmSettings.provider === 'custom' && (
                    <ProfileField
                      label="ENDPOINT URL"
                      value={llmSettings.endpoint}
                      onSave={v => setLlmSettings(prev => ({ ...prev, endpoint: v }))}
                      placeholder="http://localhost:11434/api/chat"
                      T={T}
                    />
                  )}
                  <ProfileField
                    label="MODEL"
                    value={llmSettings.model}
                    onSave={v => setLlmSettings(prev => ({ ...prev, model: v }))}
                    placeholder={llmSettings.provider === 'anthropic' ? 'claude-3-5-haiku-latest' : llmSettings.provider === 'openai' ? 'gpt-4o-mini' : 'llama3.1'}
                    last
                    T={T}
                  />
                  <Text style={[s.rowSub, { color: T.textFaint, marginTop: 4 }]}>
                    If the request ever fails (bad key, offline, etc.) parsing silently falls back to the local parser — it never blocks adding events.
                  </Text>
                </>
              )}
            </View>
          </Section>
        )}

        {matches('security', 'encryption', 'zero-knowledge', 'password', 'private', 'zk', 'aes') && (
          <Section title="Security & Encryption" icon="shield-checkmark-outline" forceOpen={!!q} collapseKey={collapseKey} onToggle={handleSectionToggle} T={T}>
            <View style={s.zkSection}>
              <View style={[s.zkBadge, { backgroundColor: T.successLight }]}>
                <Ionicons name="lock-closed" size={13} color={T.success} />
                <Text style={[s.zkBadgeText, { color: T.success }]}>Zero-Knowledge Encryption Active</Text>
              </View>
              <Text style={[s.rowSub, { color: T.textFaint }]}>
                Your calendar data is encrypted on-device using AES-256-GCM before syncing. Your password never leaves your device.
              </Text>
            </View>
          </Section>
        )}

        {/* ── Account Settings ── */}
        {matches('account', 'username', 'email', 'name', 'birthday', 'address', 'phone', 'profile') && (
          <Section title="Account Settings" icon="person-outline" forceOpen={!!q} collapseKey={collapseKey} onToggle={handleSectionToggle} T={T}>
            <View style={s.accountSection}>
              <Text style={[s.sectionSubTitle, { color: T.textMuted }]}>User Profile</Text>

              <ProfileField
                label="USERNAME"
                value={profile.username}
                onSave={v => setProfile(p => ({ ...p, username: v }))}
                placeholder="@handle"
                T={T}
              />
              <ProfileField
                label="DISPLAY NAME"
                value={profile.displayName}
                onSave={v => setProfile(p => ({ ...p, displayName: v }))}
                placeholder="Your preferred name"
                T={T}
              />
              <ProfileField
                label="EMAIL"
                value={profile.email}
                onSave={v => setProfile(p => ({ ...p, email: v }))}
                placeholder="you@example.com"
                T={T}
              />
              <ProfileField
                label="BIRTHDAY"
                value={profile.birthday}
                onSave={v => setProfile(p => ({ ...p, birthday: v }))}
                placeholder="YYYY-MM-DD"
                T={T}
              />
              <ProfileField
                label="HOME ADDRESS"
                value={profile.homeAddress}
                onSave={v => setProfile(p => ({ ...p, homeAddress: v }))}
                placeholder="123 Main St, City, State"
                T={T}
              />

              {/* Other addresses */}
              <View style={s.profileField}>
                <Text style={[s.profileLabel, { color: T.textFaint }]}>OTHER ADDRESSES</Text>
                {profile.otherAddresses.length === 0 ? (
                  <Text style={[s.emptyText, { color: T.textFaint }]}>No saved addresses.</Text>
                ) : (
                  profile.otherAddresses.map(addr => (
                    <View key={addr.id} style={s.addrRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.addrLabel, { color: T.textSub }]}>{addr.label}</Text>
                        <Text style={[s.addrValue, { color: T.textFaint }]}>{addr.address}</Text>
                      </View>
                      <Pressable hitSlop={8} onPress={() => setProfile(p => ({ ...p, otherAddresses: p.otherAddresses.filter(a => a.id !== addr.id) }))}>
                        <Ionicons name="close-circle-outline" size={18} color={T.danger} />
                      </Pressable>
                    </View>
                  ))
                )}
                <Pressable style={[s.addTzBtn, { marginTop: 6 }]} onPress={() => setAddAddrOpen(true)}>
                  <Ionicons name="add" size={16} color={T.accent} />
                  <Text style={[s.addTzText, { color: T.accent }]}>Add address</Text>
                </Pressable>
              </View>

              <Divider T={T} />

              {/* Phone numbers */}
              <View style={s.profileField}>
                <Text style={[s.profileLabel, { color: T.textFaint }]}>PHONE NUMBERS</Text>
                {profile.phones.length === 0 ? (
                  <Text style={[s.emptyText, { color: T.textFaint }]}>No saved numbers.</Text>
                ) : (
                  profile.phones.map(phone => (
                    <View key={phone.id} style={s.addrRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.addrLabel, { color: T.textSub }]}>{phone.label}</Text>
                        <Text style={[s.addrValue, { color: T.textFaint }]}>{phone.number}</Text>
                      </View>
                      <Pressable hitSlop={8} onPress={() => setProfile(p => ({ ...p, phones: p.phones.filter(ph => ph.id !== phone.id) }))}>
                        <Ionicons name="close-circle-outline" size={18} color={T.danger} />
                      </Pressable>
                    </View>
                  ))
                )}
                <Pressable style={[s.addTzBtn, { marginTop: 6 }]} onPress={() => setAddPhoneOpen(true)}>
                  <Ionicons name="add" size={16} color={T.accent} />
                  <Text style={[s.addTzText, { color: T.accent }]}>Add phone number</Text>
                </Pressable>
              </View>

              <Divider T={T} />

              {/* Logout */}
              <Pressable style={s.logoutRow} onPress={handleLogout}>
                <Ionicons name="log-out-outline" size={18} color={T.danger} />
                <Text style={[s.logoutText, { color: T.danger }]}>Log Out</Text>
              </Pressable>
            </View>
          </Section>
        )}

        {/* ── No Touchy (Admin Secrets) ── */}
        {matches('no touchy', 'admin', 'secrets', 'api key', 'infisical', 'vault', 'credentials', 'token') && (
          <Section title="🔑 No Touchy" icon="key-outline" forceOpen={!!q} collapseKey={collapseKey} onToggle={handleSectionToggle} T={T}>
            <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
              {!adminAuthed ? (
                // ── Password gate ──
                <View style={{ gap: 8 }}>
                  <Text style={[s.rowSub, { color: T.textFaint }]}>Enter your admin password to manage API keys and secrets.</Text>
                  <TextInput
                    value={adminPwDraft}
                    onChangeText={setAdminPwDraft}
                    onSubmitEditing={handleAdminAuth}
                    placeholder="Admin password…"
                    placeholderTextColor={T.placeholder}
                    secureTextEntry
                    returnKeyType="go"
                    style={[s.profileInput, { color: T.text, borderColor: T.inputBorder, backgroundColor: T.inputBg }]}
                  />
                  {adminAuthErr ? <Text style={{ color: T.danger, fontSize: 12 }}>{adminAuthErr}</Text> : null}
                  <Pressable
                    style={[s.addTzBtn, { opacity: adminPwDraft && !adminAuthing ? 1 : 0.4 }]}
                    onPress={handleAdminAuth}
                    disabled={!adminPwDraft || adminAuthing}
                  >
                    {adminAuthing
                      ? <ActivityIndicator size="small" color={T.accent} />
                      : <Text style={{ color: T.accent, fontWeight: '600', fontSize: 13 }}>Unlock</Text>
                    }
                  </Pressable>
                </View>
              ) : (
                // ── Secret list ──
                <View style={{ gap: 8 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={[s.rowSub, { color: T.textFaint }]}>{secrets.length} secret{secrets.length !== 1 ? 's' : ''} registered</Text>
                    <Pressable onPress={() => { _adminToken = null; setAdminAuthed(false); setSecrets([]); }}>
                      <Text style={{ color: T.danger, fontSize: 12, fontWeight: '600' }}>Lock</Text>
                    </Pressable>
                  </View>
                  {secretsLoading ? (
                    <ActivityIndicator color={T.accent} style={{ marginVertical: 8 }} />
                  ) : secrets.length === 0 ? (
                    <Text style={[s.emptyText, { color: T.textFaint }]}>No secrets registered yet.</Text>
                  ) : (
                    secrets.map((sec, i) => (
                      <View key={sec.key_name}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 }}>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 13, fontWeight: '600', color: T.text }}>{sec.key_name}</Text>
                            <Text style={{ fontSize: 11, color: T.textFaint }}>{sec.service_name}{sec.description ? ` · ${sec.description}` : ''}</Text>
                            {sec.expires_at && (
                              <Text style={{ fontSize: 10, color: T.danger }}>Expires {new Date(sec.expires_at * 1000).toLocaleDateString()}</Text>
                            )}
                          </View>
                          {sec.infisical_managed ? (
                            <View style={{ backgroundColor: T.accentLight, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                              <Text style={{ fontSize: 10, color: T.accent, fontWeight: '600' }}>Infisical</Text>
                            </View>
                          ) : null}
                          <Pressable hitSlop={8} onPress={() => handleDeleteSecret(sec.key_name)}>
                            <Ionicons name="trash-outline" size={16} color={T.danger} />
                          </Pressable>
                        </View>
                        {i < secrets.length - 1 && <Divider T={T} />}
                      </View>
                    ))
                  )}
                  <Pressable style={[s.addTzBtn, { marginTop: 4 }]} onPress={loadSecrets}>
                    <Ionicons name="refresh-outline" size={14} color={T.accent} />
                    <Text style={{ color: T.accent, fontSize: 13, fontWeight: '600', marginLeft: 4 }}>Refresh</Text>
                  </Pressable>
                </View>
              )}
            </View>
          </Section>
        )}

        {/* ── Tutorial ── */}
        {matches('tutorial', 'help', 'guide', 'walkthrough', 'get started', 'how') && (
          <Section title="Tutorial" icon="book-outline" forceOpen={!!q} collapseKey={collapseKey} onToggle={handleSectionToggle} T={T}>
            <Pressable style={s.tutRow} onPress={() => setShowTutorial(true)}>
              <View style={[s.tutIconSmall, { backgroundColor: T.accentLight }]}>
                <Ionicons name="play" size={14} color={T.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.rowTitle, { color: T.text }]}>PLS Calendar Tutorial</Text>
                <Text style={[s.rowSub, { color: T.textFaint }]}>10-step walkthrough of the app</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={T.textFaint} />
            </Pressable>
            <Pressable style={s.tutRow} onPress={() => setShowTodoTutorial(true)}>
              <View style={[s.tutIconSmall, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="play" size={14} color="#3B82F6" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.rowTitle, { color: T.text }]}>PLS Do It Tutorial</Text>
                <Text style={[s.rowSub, { color: T.textFaint }]}>6-step tour of the task list</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={T.textFaint} />
            </Pressable>
          </Section>
        )}

        {/* Footer */}
        <View style={s.footer}>
          <Text style={[s.footerText, { color: T.textFaint }]}>PLS Calendar</Text>
        </View>

      </ScrollView>

      {/* ── Modals ── */}
      <TutorialModal visible={showTutorial} onClose={() => setShowTutorial(false)} T={T} />
      <TutorialModal visible={showTodoTutorial} steps={TODO_TUTORIAL_STEPS} onClose={() => setShowTodoTutorial(false)} T={T} />

      <TzPickerModal
        visible={tzPickerOpen}
        onClose={() => setTzPickerOpen(false)}
        onSelect={id => setTimezones(prev => [...prev, id])}
        existing={timezones}
        T={T}
      />

      <AddIntegrationModal
        visible={addIntOpen}
        onClose={() => setAddIntOpen(false)}
        onAdd={addIntegration}
        T={T}
      />

      <AddItemModal
        visible={addAddrOpen}
        onClose={() => setAddAddrOpen(false)}
        onAdd={data => setProfile(p => ({
          ...p,
          otherAddresses: [...p.otherAddresses, { id: generateId(), label: data.label, address: data.address }],
        }))}
        titleStr="Add Address"
        label1="label" label2="address"
        ph1="Label (e.g. Work, Gym)" ph2="Full address"
        T={T}
      />

      <AddItemModal
        visible={addPhoneOpen}
        onClose={() => setAddPhoneOpen(false)}
        onAdd={data => setProfile(p => ({
          ...p,
          phones: [...p.phones, { id: generateId(), label: data.label, number: data.number }],
        }))}
        titleStr="Add Phone Number"
        label1="label" label2="number"
        ph1="Label (e.g. Mobile, Work)" ph2="Phone number"
        T={T}
      />

      {/* Add Calendar modal */}
      <AddCalendarModal
        visible={addCalOpen}
        onClose={() => setAddCalOpen(false)}
        onAdd={(name, url, calendar) => events.addLinkedCalendar({ name, url, calendar, color: '#6B7280' })}
        T={T}
      />
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:             { flex: 1 },
  header:           { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  title:            { fontSize: 22, fontWeight: '700' },

  // Search
  searchWrap:       { flexDirection: 'row', alignItems: 'center', margin: 12, marginBottom: 4, borderRadius: 12, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 9 },
  searchIcon:       { marginRight: 6 },
  searchInput:      { flex: 1, fontSize: 15 },

  content:          { paddingHorizontal: 12, paddingBottom: 40 },

  // Section accordion
  section:          { borderRadius: 14, marginTop: 10, overflow: 'hidden', elevation: 1 },
  sectionHeader:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  sectionHeaderLeft:{ flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionIcon:      {},
  sectionTitle:     { fontSize: 15, fontWeight: '700' },
  sectionBody:      {},

  // Rows
  rowDivider:       { height: StyleSheet.hairlineWidth, marginLeft: 16 },
  row:              { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 13 },
  rowLeft:          { flex: 1, marginRight: 12 },
  rowTitle:         { fontSize: 15, fontWeight: '500' },
  rowSub:           { fontSize: 12, marginTop: 2 },

  // Segment control
  segmentWrap:      { paddingHorizontal: 16, paddingVertical: 13 },
  segmentBar:       { flexDirection: 'row', borderRadius: 10, padding: 3, marginTop: 8 },
  segmentBtn:       { flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: 'center' },
  segmentBtnActive: { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  segmentTxt:       { fontSize: 13, fontWeight: '500' },

  // Time zones
  tzSection:        { paddingHorizontal: 16, paddingVertical: 12 },
  tzRow:            { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth },
  tzRowLeft:        { flex: 1 },
  tzRowRight:       { flexDirection: 'row', gap: 6 },
  primaryBadge:     { borderWidth: 1, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1, marginBottom: 2, alignSelf: 'flex-start' },
  primaryBadgeText: { fontSize: 9, fontWeight: '700', color: '#3B82F6', textTransform: 'uppercase', letterSpacing: 0.5 },
  tzLabel:          { fontSize: 14, fontWeight: '500' },
  tzTime:           { fontSize: 11, fontFamily: 'monospace', marginTop: 1 },
  tzActionBtn:      { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  addTzBtn:         { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 },
  addTzText:        { fontSize: 14, fontWeight: '600' },

  // Categories
  catSection:       { paddingHorizontal: 16, paddingVertical: 8 },
  catRow:           { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
  catSwatch:        { width: 14, height: 14, borderRadius: 7, flexShrink: 0 },
  catName:          { fontSize: 15, fontWeight: '500' },
  catLabelInput:    { flex: 1, fontSize: 15, borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 5 },
  catBtn:           { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  swatchGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 8, paddingHorizontal: 4 },
  swatchBtn:        { width: 26, height: 26, borderRadius: 13 },
  confirmRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  confirmText:      { flex: 1, fontSize: 13, fontWeight: '600' },
  confirmCancelBtn: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 },
  confirmCancelText:{ fontSize: 12 },
  confirmDeleteBtn: { borderRadius: 8, backgroundColor: '#EF4444', paddingHorizontal: 10, paddingVertical: 6 },
  confirmDeleteText:{ fontSize: 12, color: '#fff', fontWeight: '600' },
  addCatForm:       { paddingTop: 8, gap: 8 },
  addCatRow:        { flexDirection: 'row', alignItems: 'center', gap: 10 },
  addCatBtns:       { flexDirection: 'row' },

  // Budgets
  budgetSection:    { paddingHorizontal: 16, paddingVertical: 12 },
  budgetRow:        { flexDirection: 'row', alignItems: 'center', paddingVertical: 9 },
  budgetInput:      { width: 60, borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 6, textAlign: 'right', fontSize: 14 },
  budgetUnit:       { fontSize: 12, marginLeft: 4 },

  // Habits
  habitSection:     { paddingHorizontal: 16, paddingVertical: 12 },
  habitRow:         { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, gap: 10 },
  habitFreq:        { fontSize: 12, marginRight: 4 },
  emptyText:        { fontSize: 13, fontStyle: 'italic', paddingVertical: 8 },
  addHabitForm:     { marginTop: 10, borderRadius: 12, borderWidth: 1, padding: 12, gap: 10 },
  addHabitInput:    { fontSize: 14, fontWeight: '500', borderBottomWidth: 1, paddingBottom: 6, marginBottom: 2 },
  habitColorRow:    { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  habitColorDot:    { width: 24, height: 24, borderRadius: 12 },
  habitFreqRow:     { flexDirection: 'row', gap: 6 },
  habitFreqBtn:     { flex: 1, paddingVertical: 6, borderRadius: 8, borderWidth: 1, alignItems: 'center' },

  // Integrations
  integSection:     { paddingHorizontal: 16, paddingVertical: 12 },
  integRow:         { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, gap: 8 },
  integIcon:        { fontSize: 20, lineHeight: 24 },
  integInfo:        { flex: 1 },

  // Minimalist group indent
  minimalistGroup:  { marginLeft: 16, marginRight: 16, borderLeftWidth: 2, paddingLeft: 4, marginTop: 4 },

  // Font picker
  fontSection:      { paddingHorizontal: 16, paddingVertical: 10 },
  fontRow:          { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, gap: 10 },
  fontRadio:        { width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
  fontLabel:        { flex: 1, fontSize: 14, fontWeight: '500' },
  fontGroup:        { fontSize: 11 },
  fontPreview:      { fontSize: 16, fontWeight: '600', minWidth: 28, textAlign: 'right' },
  subHeader:        { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  floatSection:     { paddingHorizontal: 16, paddingVertical: 10 },

  // Search tip card
  searchTipCard:    { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 10, borderWidth: 1, padding: 10 },
  searchTipText:    { flex: 1, fontSize: 13, lineHeight: 19 },

  // Connected calendars
  connectedSection: { paddingHorizontal: 16, paddingVertical: 12 },
  calRow:           { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
  calSwatch:        { width: 12, height: 12, borderRadius: 6, flexShrink: 0 },

  // Security
  zkSection:        { paddingHorizontal: 16, paddingVertical: 14, gap: 8 },
  zkBadge:          { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, alignSelf: 'flex-start' },
  zkBadgeText:      { fontSize: 13, fontWeight: '600' },

  // Account
  accountSection:   { paddingHorizontal: 16, paddingVertical: 12 },
  sectionSubTitle:  { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  profileField:     { paddingVertical: 10 },
  profileLabel:     { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  profileInputRow:  { flexDirection: 'row', gap: 8, alignItems: 'center' },
  profileInput:     { flex: 1, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14 },
  saveBtn:          { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 },
  saveBtnText:      { fontSize: 13, fontWeight: '600' },
  addrRow:          { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 8 },
  addrLabel:        { fontSize: 13, fontWeight: '600' },
  addrValue:        { fontSize: 12, marginTop: 1 },
  logoutRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 15 },
  logoutText:       { fontSize: 15, fontWeight: '600' },

  // Tutorial section row
  tutRow:           { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, gap: 12 },
  tutIconSmall:     { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },

  footer:           { alignItems: 'center', paddingVertical: 28 },
  footerText:       { fontSize: 12 },

  // Tutorial Modal
  tutOverlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  tutCard:          { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 28, paddingBottom: 40 },
  tutDots:          { flexDirection: 'row', justifyContent: 'center', gap: 4, marginBottom: 24 },
  tutDot:           { height: 6, borderRadius: 3 },
  tutIconWrap:      { width: 72, height: 72, borderRadius: 20, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 20 },
  tutTitle:         { fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 12 },
  tutBody:          { fontSize: 14, lineHeight: 22, textAlign: 'center', marginBottom: 28 },
  tutNav:           { flexDirection: 'row', gap: 12 },
  tutNavBtn:        { flex: 1, paddingVertical: 13, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  tutNavBtnText:    { fontSize: 15, fontWeight: '600' },
  tutNavBtnPrimary: { flex: 2, paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
  tutNavBtnPrimaryText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  tutCount:         { fontSize: 12, textAlign: 'center', marginTop: 14 },

  // TZ Picker Modal
  tzCard:           { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36, maxHeight: '80%' },
  tzCardTitle:      { fontSize: 17, fontWeight: '700', marginBottom: 14 },
  tzSearch:         { borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10, fontSize: 14 },
  tzItem:           { paddingVertical: 13, paddingHorizontal: 4, borderBottomWidth: StyleSheet.hairlineWidth },
  tzItemText:       { fontSize: 15 },
  tzEmpty:          { textAlign: 'center', paddingVertical: 24, fontSize: 14 },
  cancelBtn:        { borderRadius: 12, borderWidth: 1, paddingVertical: 13, alignItems: 'center', marginTop: 10 },
  cancelBtnText:    { fontSize: 15, fontWeight: '600' },

  // Integration / Add modals
  integInput:       { borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  integBtns:        { flexDirection: 'row', marginTop: 14 },
  integAddBtn:      { borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  integAddBtnText:  { fontSize: 15, fontWeight: '700' },

  // Collapse-all pill
  collapseRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  collapseTxt:      { fontSize: 13, fontWeight: '600' },
});
