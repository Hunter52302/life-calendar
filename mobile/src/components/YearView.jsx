import { useMemo } from 'react';
import {
  View, Text, Pressable, ScrollView, StyleSheet, useWindowDimensions,
} from 'react-native';
import { addDays, todayStr } from '../lib/utils.js';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getMonthDays(year, month) {
  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells       = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ dateStr: toDateStr(new Date(year, month, d)), day: d });
  }
  return cells;
}

function MiniMonth({ year, month, eventMap, today, accent, T, cellSize, onDayPress }) {
  const cells  = useMemo(() => getMonthDays(year, month), [year, month]);
  const txtSub = T?.textMuted  ?? '#6B7280';
  const txtMain= T?.textSub    ?? '#374151';
  const border = T?.borderLight ?? '#F3F4F6';
  const surface= T?.surface    ?? '#fff';

  return (
    <View style={[s.miniMonth, { backgroundColor: surface, borderColor: border }]}>
      <Text style={[s.monthName, { color: txtSub }]}>{MONTH_NAMES[month]}</Text>

      {/* Day-letter header */}
      <View style={s.letterRow}>
        {['S','M','T','W','T','F','S'].map((d, i) => (
          <View key={i} style={[s.miniCell, { width: cellSize, height: cellSize }]}>
            <Text style={[s.letterTxt, { color: txtSub }]}>{d}</Text>
          </View>
        ))}
      </View>

      {/* Day cells */}
      <View style={s.daysGrid}>
        {cells.map((cell, idx) => {
          if (!cell) {
            return <View key={`p${idx}`} style={[s.miniCell, { width: cellSize, height: cellSize }]} />;
          }
          const evts    = eventMap[cell.dateStr] || [];
          const isToday = cell.dateStr === today;
          const dotColor = evts[0]?.color || accent;

          return (
            <Pressable
              key={cell.dateStr}
              onPress={() => onDayPress?.(cell.dateStr)}
              style={[
                s.miniCell,
                { width: cellSize, height: cellSize },
                isToday && { backgroundColor: accent, borderRadius: cellSize / 2 },
                !isToday && evts.length > 0 && {
                  backgroundColor: dotColor + '33',
                  borderRadius: 3,
                },
              ]}
            >
              <Text style={[
                s.miniNum,
                { color: isToday ? '#fff' : (evts.length > 0 ? dotColor : txtMain) },
                (isToday || evts.length > 0) && { fontWeight: '700' },
              ]}>
                {cell.day}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function YearView({ events, year, T, onDayPress }) {
  const { width }  = useWindowDimensions();
  const today      = todayStr();
  const accent     = T?.accent ?? '#7C3AED';
  // Each mini-month spans ~half screen; 7 cells fit in that half
  const monthW     = (width - 24) / 2;
  const cellSize   = Math.floor((monthW - 20) / 7);

  const eventMap = useMemo(() => {
    const map = {};
    events.forEach(e => {
      if (e.is_all_day || e.week_start == null || e.day_of_week == null) return;
      const dateStr = addDays(e.week_start, e.day_of_week);
      if (!map[dateStr]) map[dateStr] = [];
      map[dateStr].push(e);
    });
    return map;
  }, [events]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: T?.bg ?? '#F9FAFB' }}
      contentContainerStyle={[s.container, { gap: 8 }]}
    >
      {Array.from({ length: 12 }, (_, month) => (
        <MiniMonth
          key={month}
          year={year}
          month={month}
          eventMap={eventMap}
          today={today}
          accent={accent}
          T={T}
          cellSize={cellSize}
          onDayPress={onDayPress}
        />
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container:  { flexDirection: 'row', flexWrap: 'wrap', padding: 8, justifyContent: 'space-between' },
  miniMonth:  { width: '48%', borderRadius: 10, padding: 8, borderWidth: StyleSheet.hairlineWidth, marginBottom: 4 },
  monthName:  { fontSize: 11, fontWeight: '700', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 },
  letterRow:  { flexDirection: 'row', marginBottom: 2 },
  daysGrid:   { flexDirection: 'row', flexWrap: 'wrap' },
  miniCell:   { alignItems: 'center', justifyContent: 'center' },
  letterTxt:  { fontSize: 7, fontWeight: '600' },
  miniNum:    { fontSize: 9 },
});
