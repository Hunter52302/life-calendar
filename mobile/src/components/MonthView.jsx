import { useMemo } from 'react';
import {
  View, Text, Pressable, ScrollView, StyleSheet, useWindowDimensions,
} from 'react-native';
import { addDays, todayStr } from '../lib/utils.js';

const DAY_HEADERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function weekOfYear(dateStr) {
  const d    = new Date(dateStr + 'T00:00:00');
  const jan1 = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((Math.floor((d - jan1) / 86400000) + 1) / 7);
}

function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getMonthGrid(year, month) {
  const firstDay    = new Date(year, month, 1).getDay();     // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells       = [];

  // Leading padding from previous month
  for (let i = 0; i < firstDay; i++) {
    const d = new Date(year, month, 1 - (firstDay - i));
    cells.push({ dateStr: toDateStr(d), isCurrentMonth: false });
  }
  // Days of the month
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ dateStr: toDateStr(new Date(year, month, d)), isCurrentMonth: true });
  }
  // Trailing padding to complete last row
  const rem = cells.length % 7;
  if (rem > 0) {
    for (let i = 1; i <= 7 - rem; i++) {
      cells.push({ dateStr: toDateStr(new Date(year, month + 1, i)), isCurrentMonth: false });
    }
  }
  return cells;
}

export default function MonthView({ events, year, month, weekNumbers = false, T, onDayPress }) {
  const { width } = useWindowDimensions();
  const WK_W       = weekNumbers ? 28 : 0;         // width of the week-number column
  const cellW      = Math.floor((width - WK_W) / 7);
  const today      = todayStr();
  const wkColor    = T?.accent ?? '#7C3AED';

  const cells = useMemo(() => getMonthGrid(year, month), [year, month]);

  // Build absolute-date → events[] map
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

  const bg      = T?.surface     ?? '#fff';
  const border  = T?.border      ?? '#E5E7EB';
  const borderL = T?.borderLight ?? '#F3F4F6';
  const txtMain = T?.text        ?? '#111827';
  const txtMuted= T?.textMuted   ?? '#6B7280';
  const txtFaint= T?.textFaint   ?? '#9CA3AF';
  const accent  = T?.accent      ?? '#7C3AED';

  return (
    <ScrollView style={{ flex: 1, backgroundColor: bg }}>
      {/* Day name header row */}
      <View style={[s.headerRow, { borderBottomColor: border }]}>
        {weekNumbers && <View style={{ width: WK_W }} />}
        {DAY_HEADERS.map((d, i) => (
          <View key={i} style={[s.headerCell, { width: cellW }]}>
            <Text style={[s.headerTxt, { color: txtMuted }]}>{d}</Text>
          </View>
        ))}
      </View>

      {/* Week rows */}
      {Array.from({ length: Math.ceil(cells.length / 7) }, (_, row) => {
        const rowCells    = cells.slice(row * 7, row * 7 + 7);
        const firstActive = rowCells.find(c => c.isCurrentMonth) ?? rowCells[0];
        const wkNum       = weekNumbers ? weekOfYear(firstActive.dateStr) : null;

        return (
        <View key={row} style={[s.weekRow, { borderBottomColor: borderL }]}>
          {/* Week number column */}
          {weekNumbers && (
            <View style={[s.wkCell, { width: WK_W, borderRightColor: borderL }]}>
              <Text style={[s.wkNum, { color: wkColor }]}>{wkNum}</Text>
            </View>
          )}
          {rowCells.map((cell, col) => {
            const evts    = eventMap[cell.dateStr] || [];
            const isToday = cell.dateStr === today;
            const dayNum  = new Date(cell.dateStr + 'T00:00:00').getDate();

            return (
              <Pressable
                key={col}
                onPress={() => onDayPress?.(cell.dateStr)}
                style={[s.cell, { width: cellW, borderRightColor: borderL }]}
              >
                {/* Date number */}
                <View style={[
                  s.numWrap,
                  isToday && { backgroundColor: accent },
                ]}>
                  <Text style={[
                    s.numTxt,
                    { color: cell.isCurrentMonth ? txtMain : txtFaint },
                    isToday && { color: '#fff', fontWeight: '700' },
                  ]}>
                    {dayNum}
                  </Text>
                </View>

                {/* First two events */}
                {evts.slice(0, 2).map((e, ei) => (
                  <View
                    key={ei}
                    style={[s.evtChip, { backgroundColor: e.color || accent }]}
                  >
                    <Text style={s.evtTxt} numberOfLines={1}>{e.label}</Text>
                  </View>
                ))}
                {evts.length > 2 && (
                  <Text style={[s.moreTxt, { color: txtMuted }]}>
                    +{evts.length - 2}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  headerRow:  { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 8 },
  headerCell: { alignItems: 'center' },
  headerTxt:  { fontSize: 12, fontWeight: '700' },
  weekRow:    { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  wkCell:     { justifyContent: 'center', alignItems: 'center', borderRightWidth: StyleSheet.hairlineWidth },
  wkNum:      { fontSize: 9, fontWeight: '700' },
  cell:       { minHeight: 72, paddingTop: 4, paddingBottom: 4, paddingHorizontal: 1, borderRightWidth: StyleSheet.hairlineWidth },
  numWrap:    { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 3 },
  numTxt:     { fontSize: 13, fontWeight: '500' },
  evtChip:    { borderRadius: 3, paddingHorizontal: 3, paddingVertical: 1, marginHorizontal: 1, marginBottom: 1 },
  evtTxt:     { color: '#fff', fontSize: 9, fontWeight: '600' },
  moreTxt:    { fontSize: 9, fontWeight: '500', textAlign: 'center', paddingHorizontal: 2 },
});
