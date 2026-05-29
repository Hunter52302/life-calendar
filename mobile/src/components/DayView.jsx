import { useState, useRef, useMemo } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
} from 'react-native';
import { slotToTime, eventToPixels } from '../lib/utils.js';

const SLOT_H      = 64;   // px per 30-min slot
const TIME_W      = 52;   // px for the time-label column
const TOTAL_SLOTS = 48;   // 24 h × 2
const START_SLOT  = 14;   // scroll to 7 AM on mount

// ── ISO week number ───────────────────────────────────────────────────────────
function weekOfYear(dateStr) {
  const d    = new Date(dateStr + 'T00:00:00');
  const jan1 = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((Math.floor((d - jan1) / 86400000) + 1) / 7);
}

export default function DayView({
  events, weekStart, dayOfWeek, dateStr,
  militaryTime, precision = 0.5, weekNumbers = false, T,
  onSlotPress, onEventPress,
}) {
  const scrollRef = useRef(null);

  // Measure the container so the day column fills the exact available width
  const [containerW, setContainerW] = useState(320);
  const DAY_W = Math.max(40, containerW - TIME_W);

  const gridLine  = T?.border      ?? '#E5E7EB';
  const halfLine  = T?.borderLight ?? '#F3F4F6';
  const timeTxt   = T?.textFaint   ?? '#9CA3AF';
  const altBg     = T?.surfaceAlt  ?? '#F9FAFB';
  const wkColor   = T?.accent      ?? '#7C3AED';

  const dayEvents = useMemo(() =>
    events.filter(e =>
      e.week_start === weekStart &&
      e.day_of_week === dayOfWeek &&
      !e.is_all_day
    ),
    [events, weekStart, dayOfWeek]
  );

  const allDayEvents = useMemo(() =>
    events.filter(e =>
      e.week_start === weekStart &&
      e.day_of_week === dayOfWeek &&
      e.is_all_day
    ),
    [events, weekStart, dayOfWeek]
  );

  // Which slot indices get a visible grid line
  // precision 0.5 → show every 30-min line; 1.0 → show only hour lines (every 2nd slot)
  const showSlotLine = (slot) => precision <= 0.5 ? true : slot % 2 === 0;

  return (
    <View
      style={{ flex: 1 }}
      onLayout={e => setContainerW(e.nativeEvent.layout.width)}
    >
      {/* Week number badge */}
      {weekNumbers && dateStr ? (
        <View style={[s.wkBadgeRow, { borderBottomColor: gridLine }]}>
          <View style={[s.wkBadge, { backgroundColor: wkColor + '22' }]}>
            <Text style={[s.wkTxt, { color: wkColor }]}>Wk {weekOfYear(dateStr)}</Text>
          </View>
        </View>
      ) : null}

      {/* All-day strip */}
      {allDayEvents.length > 0 && (
        <View style={[s.allDayRow, { backgroundColor: altBg, borderBottomColor: gridLine }]}>
          <View style={[s.allDayCell, { width: TIME_W }]}>
            <Text style={[s.allDayLabel, { color: timeTxt }]}>all{'\n'}day</Text>
          </View>
          <View style={{ flex: 1, padding: 4 }}>
            {allDayEvents.map(e => (
              <Pressable key={e.id} onPress={() => onEventPress?.(e)}
                style={[s.allDayChip, { backgroundColor: e.color || '#6B7280' }]}>
                <Text style={s.allDayChipTxt}>{e.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* Scrollable time grid */}
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentOffset={{ x: 0, y: START_SLOT * SLOT_H }}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.gridRow}>
          {/* Time labels */}
          <View style={{ width: TIME_W }}>
            {Array.from({ length: TOTAL_SLOTS }, (_, slot) => (
              <View key={slot} style={{ height: SLOT_H, justifyContent: 'flex-start', paddingTop: 3 }}>
                {slot % 2 === 0 && (
                  <Text style={[s.timeLabel, { color: timeTxt }]}>
                    {slotToTime(slot, 0.5, militaryTime)}
                  </Text>
                )}
              </View>
            ))}
          </View>

          {/* Day column — width pinned to measured containerW minus time column */}
          <View style={{ width: DAY_W, height: SLOT_H * TOTAL_SLOTS, position: 'relative' }}>
            {/* Grid lines */}
            {Array.from({ length: TOTAL_SLOTS }, (_, slot) => {
              const isHour = slot % 2 === 0;
              const show   = showSlotLine(slot);
              if (!show) return null;
              return (
                <View
                  key={slot}
                  style={{
                    position: 'absolute',
                    top: slot * SLOT_H,
                    left: 0, right: 0, height: SLOT_H,
                    borderTopWidth:  isHour ? StyleSheet.hairlineWidth * 2 : StyleSheet.hairlineWidth,
                    borderTopColor:  isHour ? gridLine : halfLine,
                    borderLeftWidth: StyleSheet.hairlineWidth,
                    borderLeftColor: gridLine,
                  }}
                />
              );
            })}

            {/* Tap-to-add overlay */}
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={ev => {
                const rawSlot = Math.floor(ev.nativeEvent.locationY / SLOT_H);
                // snap to hour boundary when precision = 1.0
                const slot = precision <= 0.5
                  ? Math.min(rawSlot, TOTAL_SLOTS - 1)
                  : Math.min(rawSlot - (rawSlot % 2), TOTAL_SLOTS - 2);
                onSlotPress?.(dayOfWeek, slot);
              }}
            />

            {/* Events */}
            {dayEvents.map(event => {
              const { top, height } = eventToPixels(event, SLOT_H);
              const clampedH = Math.max(height, 30);
              return (
                <Pressable
                  key={event.id}
                  style={[
                    s.eventPill,
                    { top, height: clampedH, backgroundColor: event.color || '#6B7280' },
                  ]}
                  onPress={() => onEventPress?.(event)}
                >
                  <Text style={s.eventLabel} numberOfLines={Math.max(1, Math.floor(clampedH / 20))}>
                    {event.label}
                  </Text>
                  {clampedH >= 46 && (
                    <Text style={s.eventTime}>
                      {slotToTime(event.slot_start, event.precision || 0.5, militaryTime)}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  wkBadgeRow:    { paddingHorizontal: 12, paddingVertical: 4, borderBottomWidth: StyleSheet.hairlineWidth },
  wkBadge:       { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  wkTxt:         { fontSize: 11, fontWeight: '700' },
  allDayRow:     { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  allDayCell:    { justifyContent: 'center', alignItems: 'center' },
  allDayLabel:   { fontSize: 10, textAlign: 'center' },
  allDayChip:    { borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 2 },
  allDayChipTxt: { color: '#fff', fontSize: 13, fontWeight: '600' },
  gridRow:       { flexDirection: 'row' },
  timeLabel:     { fontSize: 11, textAlign: 'center', paddingHorizontal: 3 },
  eventPill:     { position: 'absolute', left: 8, right: 8, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, zIndex: 1, overflow: 'hidden' },
  eventLabel:    { color: '#fff', fontSize: 15, fontWeight: '700', lineHeight: 20 },
  eventTime:     { color: 'rgba(255,255,255,0.8)', fontSize: 12, lineHeight: 16, marginTop: 2 },
});
