import { useMemo, useRef } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, useWindowDimensions,
} from 'react-native';
import { DAYS_SHORT, addDays, todayStr, slotToTime, eventToPixels } from '../lib/utils.js';

const SLOT_H      = 44;   // px per 30-min slot
const TIME_W      = 44;   // px for the time-label column
const TOTAL_SLOTS = 48;   // 24 hours × 2 per hour (30-min grid)
const START_SLOT  = 14;   // default scroll offset = 7 AM

export default function WeekGrid({ events, weekStart, onSlotPress, onEventPress }) {
  const { width } = useWindowDimensions();
  const scrollRef  = useRef(null);
  const today      = todayStr();
  const DAY_W      = Math.max(52, (width - TIME_W) / 7);

  const eventsByDay = useMemo(() => {
    const map = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    events.forEach(e => {
      if (e.week_start === weekStart && !e.is_all_day && map[e.day_of_week] !== undefined) {
        map[e.day_of_week].push(e);
      }
    });
    return map;
  }, [events, weekStart]);

  const allDayEvents = useMemo(() =>
    events.filter(e => e.week_start === weekStart && e.is_all_day),
    [events, weekStart]
  );

  return (
    <View style={styles.container}>
      {/* ── Fixed header: day names + date numbers ── */}
      <View style={styles.headerRow}>
        <View style={{ width: TIME_W }} />
        {DAYS_SHORT.map((label, i) => {
          const dateStr = addDays(weekStart, i);
          const dayNum  = new Date(dateStr + 'T00:00:00').getDate();
          const isToday = dateStr === today;
          return (
            <View key={i} style={[styles.dayHeader, { width: DAY_W }]}>
              <Text style={styles.dayName}>{label}</Text>
              <View style={[styles.dayNumWrap, isToday && styles.todayCircle]}>
                <Text style={[styles.dayNum, isToday && styles.todayNum]}>{dayNum}</Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* ── All-day events strip ── */}
      {allDayEvents.length > 0 && (
        <View style={styles.allDayRow}>
          <View style={[styles.allDayTimeCell, { width: TIME_W }]}>
            <Text style={styles.allDayLabel}>all{'\n'}day</Text>
          </View>
          {Array.from({ length: 7 }, (_, i) => {
            const dayEvts = allDayEvents.filter(e => e.day_of_week === i);
            return (
              <View key={i} style={{ width: DAY_W, padding: 2 }}>
                {dayEvts.map(e => (
                  <Pressable key={e.id} onPress={() => onEventPress?.(e)}
                    style={[styles.allDayChip, { backgroundColor: e.color || '#6B7280' }]}>
                    <Text style={styles.allDayChipText} numberOfLines={1}>{e.label}</Text>
                  </Pressable>
                ))}
              </View>
            );
          })}
        </View>
      )}

      {/* ── Scrollable time grid ── */}
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentOffset={{ x: 0, y: START_SLOT * SLOT_H }}
        showsVerticalScrollIndicator
      >
        <View style={{ flexDirection: 'row' }}>
          {/* Time label column */}
          <View style={{ width: TIME_W }}>
            {Array.from({ length: TOTAL_SLOTS }, (_, slot) => (
              <View key={slot} style={{ height: SLOT_H, justifyContent: 'flex-start', paddingTop: 2 }}>
                {slot % 2 === 0 && (
                  <Text style={styles.timeLabel}>{slotToTime(slot, 0.5)}</Text>
                )}
              </View>
            ))}
          </View>

          {/* Day columns */}
          {Array.from({ length: 7 }, (_, dayIdx) => (
            <View
              key={dayIdx}
              style={{ width: DAY_W, height: SLOT_H * TOTAL_SLOTS, position: 'relative' }}
            >
              {/* Grid lines */}
              {Array.from({ length: TOTAL_SLOTS }, (_, slot) => (
                <View
                  key={slot}
                  style={{
                    position: 'absolute',
                    top: slot * SLOT_H,
                    left: 0, right: 0,
                    height: SLOT_H,
                    borderTopWidth: slot % 2 === 0 ? StyleSheet.hairlineWidth : 0,
                    borderTopColor: '#D1D5DB',
                    borderLeftWidth: StyleSheet.hairlineWidth,
                    borderLeftColor: '#E5E7EB',
                  }}
                />
              ))}

              {/* Tap-to-add overlay */}
              <Pressable
                style={StyleSheet.absoluteFill}
                onPress={ev => {
                  const slot = Math.min(
                    Math.floor(ev.nativeEvent.locationY / SLOT_H),
                    TOTAL_SLOTS - 1
                  );
                  onSlotPress?.(dayIdx, slot);
                }}
              />

              {/* Events */}
              {eventsByDay[dayIdx].map(event => {
                const { top, height } = eventToPixels(event, SLOT_H);
                const clampedH = Math.max(height, 22);
                return (
                  <Pressable
                    key={event.id}
                    style={[
                      styles.eventPill,
                      { top, height: clampedH, backgroundColor: event.color || '#6B7280' },
                    ]}
                    onPress={() => onEventPress?.(event)}
                  >
                    <Text style={styles.eventLabel} numberOfLines={Math.max(1, Math.floor(clampedH / 15))}>
                      {event.label}
                    </Text>
                    {clampedH >= 36 && (
                      <Text style={styles.eventTime}>
                        {slotToTime(event.slot_start, event.precision || 0.5)}
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1 },
  headerRow:       { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E7EB', backgroundColor: '#fff', paddingVertical: 6 },
  dayHeader:       { alignItems: 'center' },
  dayName:         { fontSize: 11, color: '#6B7280', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  dayNumWrap:      { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  dayNum:          { fontSize: 14, color: '#374151', fontWeight: '500' },
  todayCircle:     { backgroundColor: '#7C3AED' },
  todayNum:        { color: '#fff', fontWeight: '700' },
  allDayRow:       { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E7EB', backgroundColor: '#F9FAFB', minHeight: 28 },
  allDayTimeCell:  { justifyContent: 'center', alignItems: 'center' },
  allDayLabel:     { fontSize: 8, color: '#9CA3AF', textAlign: 'center' },
  allDayChip:      { borderRadius: 3, paddingHorizontal: 4, paddingVertical: 2, marginBottom: 1 },
  allDayChipText:  { color: '#fff', fontSize: 10, fontWeight: '600' },
  timeLabel:       { fontSize: 9, color: '#9CA3AF', textAlign: 'center', paddingHorizontal: 2 },
  eventPill:       { position: 'absolute', left: 2, right: 2, borderRadius: 5, paddingHorizontal: 4, paddingVertical: 2, zIndex: 1, overflow: 'hidden' },
  eventLabel:      { color: '#fff', fontSize: 10, fontWeight: '700', lineHeight: 14 },
  eventTime:       { color: 'rgba(255,255,255,0.8)', fontSize: 9, lineHeight: 12 },
});
