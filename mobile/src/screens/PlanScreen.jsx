import { useState, useMemo, useContext } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppContext } from '../context/AppContext.js';
import WeekGrid   from '../components/WeekGrid.jsx';
import DayView    from '../components/DayView.jsx';
import MonthView  from '../components/MonthView.jsx';
import YearView   from '../components/YearView.jsx';
import AddEventModal from '../components/AddEventModal.jsx';
import { getWeekStart, addDays, todayStr, formatWeekRange } from '../lib/utils.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function addMonths(dateStr, n) {
  const dt = new Date(dateStr + 'T00:00:00');
  dt.setMonth(dt.getMonth() + n);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addYears(dateStr, n) {
  const dt = new Date(dateStr + 'T00:00:00');
  dt.setFullYear(dt.getFullYear() + n);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getNavTitle(focusDate, viewMode) {
  const dt = new Date(focusDate + 'T00:00:00');
  switch (viewMode) {
    case 'day':
      return dt.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    case 'week':
      return formatWeekRange(getWeekStart(dt));
    case 'month':
      return dt.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    case 'year':
      return String(dt.getFullYear());
    default:
      return '';
  }
}

const VIEW_MODES = [
  { key: 'day',   label: 'Day'   },
  { key: 'week',  label: 'Week'  },
  { key: 'month', label: 'Month' },
  { key: 'year',  label: 'Year'  },
];

// ── Screen ───────────────────────────────────────────────────────────────────

export default function PlanScreen() {
  const {
    events,
    militaryTime,
    weekNumbers,
    T,
    effShowFab,
    effShowPrecisionToggle,
    effShowCategoriesMenu,
    openParseModal,
  } = useContext(AppContext);

  const [viewMode,        setViewMode]        = useState('week');
  const [focusDate,       setFocusDate]       = useState(() => todayStr());
  const [precision,       setPrecision]       = useState(0.5);   // 0.5 = 30 min, 1.0 = 1 hr
  const [activeCatFilter, setActiveCatFilter] = useState(null);
  const [formState,       setFormState]       = useState(null);

  // Derive focus components
  const focusDt        = new Date(focusDate + 'T00:00:00');
  const focusDayOfWeek = focusDt.getDay();
  const focusWeekStart = getWeekStart(focusDt);
  const focusYear      = focusDt.getFullYear();
  const focusMonth     = focusDt.getMonth();

  const allPlanEvents = useMemo(() =>
    events.events.filter(e => e.calendar === 'plan'),
    [events.events]
  );

  const planEvents = useMemo(() =>
    activeCatFilter
      ? allPlanEvents.filter(e => e.category === activeCatFilter)
      : allPlanEvents,
    [allPlanEvents, activeCatFilter]
  );

  // ── Navigation ─────────────────────────────────────────────────────────────
  function navigate(dir) {
    setFocusDate(d => {
      switch (viewMode) {
        case 'day':   return addDays(d, dir);
        case 'week':  return addDays(d, dir * 7);
        case 'month': return addMonths(d, dir);
        case 'year':  return addYears(d, dir);
        default:      return d;
      }
    });
  }

  function handleSave(data) {
    if (data.id) events.updateEvent(data.id, data);
    else events.addEvent({ ...data, calendar: 'plan' });
    setFormState(null);
  }

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: T.surface }]} edges={['top']}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={[s.header, { borderBottomColor: T.border }]}>

        {/* Row 1: title + precision toggle + paste-to-parse */}
        <View style={s.titleRow}>
          <Text style={[s.title, { color: T.text }]}>Plan</Text>
          <View style={s.titleRowActions}>
            <Pressable onPress={() => openParseModal()} hitSlop={8} style={s.pasteBtn}>
              <Text style={s.pasteIcon}>📋</Text>
            </Pressable>
            {effShowPrecisionToggle && (
              <Pressable
                onPress={() => setPrecision(p => p === 0.5 ? 1.0 : 0.5)}
                style={[s.precBtn, { backgroundColor: T.segmentBg, borderColor: T.border }]}
              >
                <Text style={[s.precTxt, { color: T.textSub }]}>
                  {precision === 0.5 ? '30m' : '1h'}
                </Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Row 2: D / W / M / Y segmented control */}
        <View style={[s.segRow, { backgroundColor: T.segmentBg }]}>
          {VIEW_MODES.map(vm => {
            const active = viewMode === vm.key;
            return (
              <Pressable
                key={vm.key}
                onPress={() => setViewMode(vm.key)}
                style={[s.segBtn, active && { backgroundColor: T.accent, borderRadius: 8 }]}
              >
                <Text style={[s.segTxt, { color: active ? '#fff' : T.textMuted }, active && { fontWeight: '700' }]}>
                  {vm.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Row 3: prev / title / next */}
        <View style={s.navRow}>
          <Pressable onPress={() => navigate(-1)} hitSlop={12} style={s.navBtn}>
            <Text style={[s.navArrow, { color: T.accent }]}>‹</Text>
          </Pressable>
          <Pressable onPress={() => setFocusDate(todayStr())} style={s.navLabel}>
            <Text style={[s.navTitle, { color: T.textSub }]} numberOfLines={1}>
              {getNavTitle(focusDate, viewMode)}
            </Text>
          </Pressable>
          <Pressable onPress={() => navigate(1)} hitSlop={12} style={s.navBtn}>
            <Text style={[s.navArrow, { color: T.accent }]}>›</Text>
          </Pressable>
          <Pressable onPress={() => openParseModal()} hitSlop={8} style={styles.navBtn}>
            <Text style={styles.clipboardIcon}>📋</Text>
          </Pressable>
        </View>
      </View>

      {/* ── Category filter bar ─────────────────────────────────────────────── */}
      {effShowCategoriesMenu && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[s.catBar, { borderBottomColor: T.borderLight }]}
          contentContainerStyle={s.catBarInner}
        >
          <Pressable
            onPress={() => setActiveCatFilter(null)}
            style={[s.catChip, { backgroundColor: activeCatFilter === null ? T.accent : T.segmentBg }]}
          >
            <Text style={[s.catChipTxt, { color: activeCatFilter === null ? '#fff' : T.textMuted }]}>
              All
            </Text>
          </Pressable>
          {events.allCategories.map(cat => (
            <Pressable
              key={cat.id}
              onPress={() => setActiveCatFilter(activeCatFilter === cat.id ? null : cat.id)}
              style={[
                s.catChip,
                { backgroundColor: activeCatFilter === cat.id ? cat.color : T.segmentBg },
              ]}
            >
              <View style={[s.catDot, { backgroundColor: cat.color }]} />
              <Text style={[s.catChipTxt, { color: activeCatFilter === cat.id ? '#fff' : T.textSub }]}>
                {cat.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* ── Main content ────────────────────────────────────────────────────── */}
      {viewMode === 'day' && (
        <DayView
          events={planEvents}
          weekStart={focusWeekStart}
          dayOfWeek={focusDayOfWeek}
          dateStr={focusDate}
          militaryTime={militaryTime}
          precision={precision}
          weekNumbers={weekNumbers}
          T={T}
          onSlotPress={(day, slot) => setFormState({ day, slot })}
          onEventPress={(event) => setFormState({ event })}
        />
      )}
      {viewMode === 'week' && (
        <WeekGrid
          events={planEvents}
          weekStart={focusWeekStart}
          militaryTime={militaryTime}
          precision={precision}
          weekNumbers={weekNumbers}
          T={T}
          onSlotPress={(day, slot) => setFormState({ day, slot })}
          onEventPress={(event) => setFormState({ event })}
        />
      )}
      {viewMode === 'month' && (
        <MonthView
          events={allPlanEvents}
          year={focusYear}
          month={focusMonth}
          weekNumbers={weekNumbers}
          T={T}
          onDayPress={dateStr => { setFocusDate(dateStr); setViewMode('day'); }}
        />
      )}
      {viewMode === 'year' && (
        <YearView
          events={allPlanEvents}
          year={focusYear}
          T={T}
          onDayPress={dateStr => { setFocusDate(dateStr); setViewMode('day'); }}
        />
      )}

      {/* ── FAB ─────────────────────────────────────────────────────────────── */}
      {effShowFab && (
        <Pressable
          onPress={() => setFormState({})}
          style={[s.fab, { backgroundColor: T.accent }]}
          android_ripple={{ color: 'rgba(255,255,255,0.3)', borderless: true }}
        >
          <Text style={s.fabIcon}>＋</Text>
        </Pressable>
      )}

      <AddEventModal
        visible={formState !== null}
        event={formState?.event}
        defaultDay={formState?.event?.day_of_week ?? formState?.day ?? focusDayOfWeek}
        defaultSlot={formState?.event?.slot_start ?? formState?.slot ?? 14}
        allCategories={events.allCategories}
        weekStart={focusWeekStart}
        calendar="plan"
        precision={precision}
        onSave={handleSave}
        onDelete={(id) => { events.deleteEvent(id); setFormState(null); }}
        onClose={() => setFormState(null)}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1 },
  header:      { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  // Row 1
  titleRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  title:           { fontSize: 22, fontWeight: '700' },
  titleRowActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pasteBtn:        { padding: 4 },
  pasteIcon:       { fontSize: 18 },
  precBtn:     { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  precTxt:     { fontSize: 13, fontWeight: '600' },
  // Row 2 — view mode segment
  segRow:      { flexDirection: 'row', borderRadius: 10, padding: 3, marginBottom: 10 },
  segBtn:      { flex: 1, alignItems: 'center', paddingVertical: 6 },
  segTxt:      { fontSize: 13, fontWeight: '600' },
  // Row 3 — navigation
  navRow:      { flexDirection: 'row', alignItems: 'center' },
  navBtn:      { padding: 8 },
  navArrow:    { fontSize: 26, fontWeight: '300', lineHeight: 30 },
  navLabel:    { flex: 1, alignItems: 'center' },
  navTitle:    { fontSize: 15, fontWeight: '600', textAlign: 'center' },
  // Category bar
  catBar:      { borderBottomWidth: StyleSheet.hairlineWidth, maxHeight: 46 },
  catBarInner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, gap: 8 },
  catChip:     { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  catDot:      { width: 8, height: 8, borderRadius: 4 },
  catChipTxt:  { fontSize: 12, fontWeight: '600' },
  // FAB
  fab:         { position: 'absolute', bottom: 24, right: 20, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6 },
  fabIcon:     { color: '#fff', fontSize: 28, lineHeight: 32, fontWeight: '300' },
});
