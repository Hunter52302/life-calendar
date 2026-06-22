import { useState, useMemo, useContext } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppContext } from '../context/AppContext.js';
import WeekGrid  from '../components/WeekGrid.jsx';
import DayView   from '../components/DayView.jsx';
import MonthView from '../components/MonthView.jsx';
import YearView  from '../components/YearView.jsx';
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
    case 'day':   return dt.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    case 'week':  return formatWeekRange(getWeekStart(dt));
    case 'month': return dt.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    case 'year':  return String(dt.getFullYear());
    default:      return '';
  }
}

const VIEW_MODES = [
  { key: 'day',   label: 'Day'   },
  { key: 'week',  label: 'Week'  },
  { key: 'month', label: 'Month' },
  { key: 'year',  label: 'Year'  },
];

// ── Screen ───────────────────────────────────────────────────────────────────

export default function LiveScreen() {
  const { events, militaryTime, weekNumbers, T, effShowFab } = useContext(AppContext);

  const [viewMode,   setViewMode]   = useState('week');
  const [focusDate,  setFocusDate]  = useState(() => todayStr());
  const [formState,  setFormState]  = useState(null);

  const focusDt        = new Date(focusDate + 'T00:00:00');
  const focusDayOfWeek = focusDt.getDay();
  const focusWeekStart = getWeekStart(focusDt);
  const focusYear      = focusDt.getFullYear();
  const focusMonth     = focusDt.getMonth();

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

  // Build ghost + actual composite for the focused week
  const { planEvents, actualEvents } = useMemo(() => ({
    planEvents:   events.events.filter(e => e.calendar === 'plan'   && e.week_start === focusWeekStart),
    actualEvents: events.events.filter(e => e.calendar === 'actual' && e.week_start === focusWeekStart),
  }), [events.events, focusWeekStart]);

  const actualByPlanId = useMemo(() => {
    const map = {};
    actualEvents.forEach(ae => { if (ae.plan_event_id) map[ae.plan_event_id] = ae; });
    return map;
  }, [actualEvents]);

  // For week/day views: ghost plan events + logged actuals
  const displayEvents = useMemo(() => {
    const planDisplays = planEvents.map(pe =>
      actualByPlanId[pe.id] || { ...pe, _isGhost: true }
    );
    const orphans = actualEvents.filter(ae =>
      !ae.plan_event_id || !planEvents.find(pe => pe.id === ae.plan_event_id)
    );
    return [...planDisplays, ...orphans].map(e => {
      if (e._isGhost) return { ...e, color: '#D1D5DB', _ghostColor: e.color };
      if (e.source === 'auto-completed') return { ...e, _isAutoCompleted: true };
      return e;
    });
  }, [planEvents, actualEvents, actualByPlanId]);

  // For month/year views: all actual events
  const allActualEvents = useMemo(() =>
    events.events.filter(e => e.calendar === 'actual'),
    [events.events]
  );

  function handleSave(data) {
    if (data.id) events.updateEvent(data.id, data);
    else events.addEvent({
      ...data,
      calendar: 'actual',
      plan_event_id: formState?.event?._isGhost ? formState.event.id : undefined,
    });
    setFormState(null);
  }

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: T.surface }]} edges={['top']}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={[s.header, { borderBottomColor: T.border }]}>
        {/* Title */}
        <Text style={[s.title, { color: T.text }]}>Live</Text>

        {/* View mode segment */}
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

        {/* Navigation */}
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
        </View>
      </View>

      {/* ── Legend (day / week views only) ──────────────────────────────────── */}
      {(viewMode === 'day' || viewMode === 'week') && (
        <View style={[s.legend, { borderBottomColor: T.borderLight }]}>
          <View style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: '#D1D5DB' }]} />
            <Text style={[s.legendTxt, { color: T.textMuted }]}>Planned (not logged)</Text>
          </View>
          <View style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: T.accent }]} />
            <Text style={[s.legendTxt, { color: T.textMuted }]}>Logged</Text>
          </View>
          <View style={s.legendItem}>
            <View style={[s.legendDot, s.legendDotAuto, { backgroundColor: T.accent }]} />
            <Text style={[s.legendTxt, { color: T.textMuted }]}>Auto-logged</Text>
          </View>
        </View>
      )}

      {/* ── Main content ────────────────────────────────────────────────────── */}
      {viewMode === 'day' && (
        <DayView
          events={displayEvents}
          weekStart={focusWeekStart}
          dayOfWeek={focusDayOfWeek}
          dateStr={focusDate}
          militaryTime={militaryTime}
          weekNumbers={weekNumbers}
          T={T}
          onSlotPress={(day, slot) => setFormState({ day, slot })}
          onEventPress={(event) => setFormState({ event })}
        />
      )}
      {viewMode === 'week' && (
        <WeekGrid
          events={displayEvents}
          weekStart={focusWeekStart}
          militaryTime={militaryTime}
          weekNumbers={weekNumbers}
          T={T}
          onSlotPress={(day, slot) => setFormState({ day, slot })}
          onEventPress={(event) => setFormState({ event })}
        />
      )}
      {viewMode === 'month' && (
        <MonthView
          events={allActualEvents}
          year={focusYear}
          month={focusMonth}
          weekNumbers={weekNumbers}
          T={T}
          onDayPress={dateStr => { setFocusDate(dateStr); setViewMode('day'); }}
        />
      )}
      {viewMode === 'year' && (
        <YearView
          events={allActualEvents}
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
        event={formState?.event?._isGhost ? null : formState?.event}
        defaultDay={formState?.event?.day_of_week ?? formState?.day ?? focusDayOfWeek}
        defaultSlot={formState?.event?.slot_start ?? formState?.slot ?? 14}
        allCategories={events.allCategories}
        weekStart={focusWeekStart}
        calendar="actual"
        onSave={handleSave}
        onDelete={(id) => { events.deleteEvent(id); setFormState(null); }}
        onClose={() => setFormState(null)}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:       { flex: 1 },
  header:     { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  title:      { fontSize: 22, fontWeight: '700', marginBottom: 10 },
  // Segment
  segRow:     { flexDirection: 'row', borderRadius: 10, padding: 3, marginBottom: 10 },
  segBtn:     { flex: 1, alignItems: 'center', paddingVertical: 6 },
  segTxt:     { fontSize: 13, fontWeight: '600' },
  // Nav
  navRow:     { flexDirection: 'row', alignItems: 'center' },
  navBtn:     { padding: 8 },
  navArrow:   { fontSize: 26, fontWeight: '300', lineHeight: 30 },
  navLabel:   { flex: 1, alignItems: 'center' },
  navTitle:   { fontSize: 15, fontWeight: '600', textAlign: 'center' },
  // Legend
  legend:     { flexDirection: 'row', gap: 16, paddingHorizontal: 16, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:  { width: 10, height: 10, borderRadius: 5 },
  legendDotAuto: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#fff' },
  legendTxt:  { fontSize: 13 },
  // FAB
  fab:        { position: 'absolute', bottom: 24, right: 20, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6 },
  fabIcon:    { color: '#fff', fontSize: 28, lineHeight: 32, fontWeight: '300' },
});
