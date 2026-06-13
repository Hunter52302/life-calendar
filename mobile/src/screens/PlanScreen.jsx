import { useState, useContext } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppContext } from '../context/AppContext.js';
import WeekGrid from '../components/WeekGrid.jsx';
import AddEventModal from '../components/AddEventModal.jsx';
import ParseModal from '../components/ParseModal.jsx';
import { formatWeekRange } from '../lib/utils.js';

export default function PlanScreen() {
  const { events, weekStart, prevWeek, nextWeek } = useContext(AppContext);
  const [formState, setFormState] = useState(null);
  const [showParse, setShowParse] = useState(false);

  const planEvents = events.events.filter(e => e.calendar === 'plan');

  function handleSave(data) {
    if (data.id) events.updateEvent(data.id, data);
    else events.addEvent({ ...data, calendar: 'plan' });
    setFormState(null);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Plan</Text>
        <View style={styles.weekNav}>
          <Pressable onPress={prevWeek} hitSlop={8} style={styles.navBtn}>
            <Text style={styles.navArrow}>‹</Text>
          </Pressable>
          <Text style={styles.weekLabel}>{formatWeekRange(weekStart)}</Text>
          <Pressable onPress={nextWeek} hitSlop={8} style={styles.navBtn}>
            <Text style={styles.navArrow}>›</Text>
          </Pressable>
          <Pressable onPress={() => setShowParse(true)} hitSlop={8} style={styles.navBtn}>
            <Text style={styles.clipboardIcon}>📋</Text>
          </Pressable>
        </View>
      </View>

      <WeekGrid
        events={planEvents}
        weekStart={weekStart}
        onSlotPress={(day, slot) => setFormState({ day, slot })}
        onEventPress={(event) => setFormState({ event })}
      />

      <AddEventModal
        visible={formState !== null}
        event={formState?.event}
        defaultDay={formState?.event?.day_of_week ?? formState?.day}
        defaultSlot={formState?.event?.slot_start ?? formState?.slot}
        allCategories={events.allCategories}
        weekStart={weekStart}
        calendar="plan"
        onSave={handleSave}
        onDelete={(id) => { events.deleteEvent(id); setFormState(null); }}
        onClose={() => setFormState(null)}
      />

      <ParseModal
        visible={showParse}
        onClose={() => setShowParse(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: '#fff' },
  header:    { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E7EB', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title:     { fontSize: 20, fontWeight: '700', color: '#111827' },
  weekNav:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  navBtn:    { padding: 4 },
  navArrow:      { fontSize: 22, color: '#7C3AED', fontWeight: '300' },
  weekLabel:     { fontSize: 13, fontWeight: '600', color: '#374151', minWidth: 120, textAlign: 'center' },
  clipboardIcon: { fontSize: 18 },
});
