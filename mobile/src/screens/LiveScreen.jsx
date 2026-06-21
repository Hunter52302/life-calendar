import { useState, useMemo, useContext } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppContext } from '../context/AppContext.js';
import WeekGrid from '../components/WeekGrid.jsx';
import AddEventModal from '../components/AddEventModal.jsx';
import { formatWeekRange } from '../lib/utils.js';

export default function LiveScreen() {
  const { events, weekStart, prevWeek, nextWeek } = useContext(AppContext);
  const [formState, setFormState] = useState(null);

  // Build display events: ghost plan events + actual overrides (mirrors web ActualView logic)
  const { planEvents, actualEvents } = useMemo(() => ({
    planEvents:   events.events.filter(e => e.calendar === 'plan'   && e.week_start === weekStart),
    actualEvents: events.events.filter(e => e.calendar === 'actual' && e.week_start === weekStart),
  }), [events.events, weekStart]);

  const actualByPlanId = useMemo(() => {
    const map = {};
    actualEvents.forEach(ae => { if (ae.plan_event_id) map[ae.plan_event_id] = ae; });
    return map;
  }, [actualEvents]);

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

  // Combine with all-week actual events for other weeks shown in the grid
  const allActual = events.events.filter(e => e.calendar === 'actual');

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
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Live</Text>
        <View style={styles.weekNav}>
          <Pressable onPress={prevWeek} hitSlop={8} style={styles.navBtn}>
            <Text style={styles.navArrow}>‹</Text>
          </Pressable>
          <Text style={styles.weekLabel}>{formatWeekRange(weekStart)}</Text>
          <Pressable onPress={nextWeek} hitSlop={8} style={styles.navBtn}>
            <Text style={styles.navArrow}>›</Text>
          </Pressable>
        </View>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#D1D5DB' }]} />
          <Text style={styles.legendText}>Planned (not logged)</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#7C3AED' }]} />
          <Text style={styles.legendText}>Logged</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.legendDotAuto]} />
          <Text style={styles.legendText}>Auto-logged</Text>
        </View>
      </View>

      <WeekGrid
        events={displayEvents}
        weekStart={weekStart}
        onSlotPress={(day, slot) => setFormState({ day, slot })}
        onEventPress={(event) => setFormState({ event })}
      />

      <AddEventModal
        visible={formState !== null}
        event={formState?.event?._isGhost ? null : formState?.event}
        defaultDay={formState?.event?.day_of_week ?? formState?.day}
        defaultSlot={formState?.event?.slot_start ?? formState?.slot}
        allCategories={events.allCategories}
        weekStart={weekStart}
        calendar="actual"
        onSave={handleSave}
        onDelete={(id) => { events.deleteEvent(id); setFormState(null); }}
        onClose={() => setFormState(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: '#fff' },
  header:      { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E7EB', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title:       { fontSize: 20, fontWeight: '700', color: '#111827' },
  weekNav:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  navBtn:      { padding: 4 },
  navArrow:    { fontSize: 22, color: '#7C3AED', fontWeight: '300' },
  weekLabel:   { fontSize: 13, fontWeight: '600', color: '#374151', minWidth: 120, textAlign: 'center' },
  legend:      { flexDirection: 'row', gap: 16, paddingHorizontal: 16, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F3F4F6' },
  legendItem:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:   { width: 10, height: 10, borderRadius: 5 },
  legendDotAuto: { backgroundColor: '#7C3AED', borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#fff' },
  legendText:  { fontSize: 11, color: '#6B7280' },
});
