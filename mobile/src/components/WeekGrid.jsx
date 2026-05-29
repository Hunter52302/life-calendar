import { useState, useMemo, useRef } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
} from 'react-native';
import { DAYS_SHORT, addDays, todayStr, slotToTime, eventToPixels } from '../lib/utils.js';

const SLOT_H      = 54;   // px per 30-min slot
const TIME_W      = 52;   // px for the time-label column
const TOTAL_SLOTS = 48;   // 24 hours × 2 (30-min grid)
const START_SLOT  = 14;   // scroll to 7 AM on mount

// ── ISO-ish week number (week 1 = contains Jan 1) ─────────────────────────────
function weekOfYear(dateStr) {
  const d    = new Date(dateStr + 'T00:00:00');
  const jan1 = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((Math.floor((d - jan1) / 86400000) + 1) / 7);
}

export default function WeekGrid({
  events, weekStart, militaryTime = false,
  precision = 0.5, weekNumbers = false,
  T, onSlotPress, onEventPress,
}) {
  const scrollRef = useRef(null);
  const today     = todayStr();

  // Measure the container so columns fill the exact available width
  const [containerW, setContainerW] = useState(320);
  const DAY_W = Math.max(38, (containerW - TIME_W) / 7);

  // Fallback colours
  const gridLine     = T?.border      ?? '#D1D5DB';
  const gridLineAlt  = T?.borderLight ?? '#E5E7EB';
  const timeTxt      = T?.textFaint   ?? '#9CA3AF';
  const headerBg     = T?.surface     ?? '#ffffff';
  const headerBorder = T?.border      ?? '#E5E7EB';
  const allDayBg     = T?.surfaceAlt  ?? '#F9FAFB';
  const todayBg      = T?.accent      ?? '#7C3AED';
  const dayNumColor  = T?.textSub     ?? '#374151';
  const dayNameColor = T?.textMuted   ?? '#6B7280';
  const wkColor      = T?.accent      ?? '#7C3AED';

  const weekNum = weekNumbers ? weekOfYear(weekStart) : null;

  // Which slots get a grid line: 0.5 = every slot; 1.0 = hour lines only
  const showSlotLine = (slot) => precision <= 0.5 ? true : slot % 2 === 0;

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
    <View
      style={[s.container, { flex: 1 }]}
      onLayout={e => setContainerW(e.nativeEvent.layout.width)}
    >
      {/* ── Fixed header: day names + date numbers ── */}
      <View style={[s.headerRow, { backgroundColor: headerBg, borderBottomColor: headerBorder }]}>
        {/* Time-column placeholder — shows week number if enabled */}
        <View style={[s.timeHeaderCell, { width: TIME_W }]}>
          {weekNum != null && (
            <Text style={[s.wkLabel, { color: wkColor }]}>W{weekNum}</Text>
          )}
        </View>

        {DAYS_SHORT.map((label, i) => {
          const dateStr = addDays(weekStart, i);
          const dayNum  = new Date(dateStr + 'T00:00:00').getDate();
          const isToday = dateStr === today;
          return (
            <View key={i} style={[s.dayHeader, { width: DAY_W }]}>
              <Text style={[s.dayName, { color: dayNameColor }]}>{label.slice(0, 2)}</Text>
              <View style={[s.dayNumWrap, isToday && { backgroundColor: todayBg }]}>
                <Text style={[
                  s.dayNum,
                  { color: isToday ? '#fff' : dayNumColor },
                  isToday && { fontWeight: '700' },
                ]}>
                  {dayNum}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* ── All-day events strip ── */}
      {allDayEvents.length > 0 && (
        <View style={[s.allDayRow, { backgroundColor: allDayBg, borderBottomColor: headerBorder }]}>
          <View style={[s.allDayTimeCell, { width: TIME_W }]}>
            <Text style={[s.allDayLabel, { color: timeTxt }]}>all{'\n'}day</Text>
          </View>
          {Array.from({ length: 7 }, (_, i) => {
            const dayEvts = allDayEvents.filter(e => e.day_of_week === i);
            return (
              <View key={i} style={{ width: DAY_W, padding: 2 }}>
                {dayEvts.map(e => (
                  <Pressable key={e.id} onPress={() => onEventPress?.(e)}
                    style={[s.allDayChip, { backgroundColor: e.color || '#6B7280' }]}>
                    <Text style={s.allDayChipText} numberOfLines={1}>{e.label}</Text>
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
        showsVerticalScrollIndicator={false}
      >
        <View style={{ flexDirection: 'row' }}>
          {/* Time label column */}
          <View style={{ width: TIME_W }}>
            {Array.from({ length: TOTAL_SLOTS }, (_, slot) => (
              <View key={slot} style={{ height: SLOT_H, justifyContent: 'flex-start', paddingTop: 2 }}>
                {slot % 2 === 0 && (
                  <Text style={[s.timeLabel, { color: timeTxt }]}>
                    {slotToTime(slot, 0.5, militaryTime)}
                  </Text>
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
              {/* Grid lines — respects precision */}
              {Array.from({ length: TOTAL_SLOTS }, (_, slot) => {
                if (!showSlotLine(slot)) return null;
                const isHour = slot % 2 === 0;
                return (
                  <View
                    key={slot}
                    style={{
                      position: 'absolute',
                      top: slot * SLOT_H,
                      left: 0, right: 0, height: SLOT_H,
                      borderTopWidth:  isHour ? StyleSheet.hairlineWidth : 0,
                      borderTopColor:  gridLine,
                      borderLeftWidth: StyleSheet.hairlineWidth,
                      borderLeftColor: gridLineAlt,
                    }}
                  />
                );
              })}

              {/* Tap-to-add overlay */}
              <Pressable
                style={StyleSheet.absoluteFill}
                onPress={ev => {
                  const rawSlot = Math.floor(ev.nativeEvent.locationY / SLOT_H);
                  const slot = precision <= 0.5
                    ? Math.min(rawSlot, TOTAL_SLOTS - 1)
                    : Math.min(rawSlot - (rawSlot % 2), TOTAL_SLOTS - 2);
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
                      s.eventPill,
                      { top, height: clampedH, backgroundColor: event.color || '#6B7280' },
                    ]}
                    onPress={() => onEventPress?.(event)}
                  >
                    <Text style={s.eventLabel} numberOfLines={Math.max(1, Math.floor(clampedH / 15))}>
                      {event.label}
                    </Text>
                    {clampedH >= 36 && (
                      <Text style={s.eventTime}>
                        {slotToTime(event.slot_start, event.precision || 0.5, militaryTime)}
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

const s = StyleSheet.create({
  container:       { flex: 1 },
  headerRow:       { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 10 },
  timeHeaderCell:  { justifyContent: 'center', alignItems: 'center' },
  wkLabel:         { fontSize: 11, fontWeight: '700' },
  dayHeader:       { alignItems: 'center' },
  dayName:         { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  dayNumWrap:      { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 3 },
  dayNum:          { fontSize: 16, fontWeight: '500' },
  allDayRow:       { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, minHeight: 32 },
  allDayTimeCell:  { justifyContent: 'center', alignItems: 'center' },
  allDayLabel:     { fontSize: 10, textAlign: 'center' },
  allDayChip:      { borderRadius: 3, paddingHorizontal: 4, paddingVertical: 2, marginBottom: 1 },
  allDayChipText:  { color: '#fff', fontSize: 11, fontWeight: '600' },
  timeLabel:       { fontSize: 11, textAlign: 'center', paddingHorizontal: 3 },
  eventPill:       { position: 'absolute', left: 2, right: 2, borderRadius: 5, paddingHorizontal: 4, paddingVertical: 3, zIndex: 1, overflow: 'hidden' },
  eventLabel:      { color: '#fff', fontSize: 12, fontWeight: '700', lineHeight: 16 },
  eventTime:       { color: 'rgba(255,255,255,0.8)', fontSize: 11, lineHeight: 14 },
});
