import { useMemo, useContext } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppContext } from '../context/AppContext.js';
import { formatWeekRange, slotsToHours } from '../lib/utils.js';

function hoursLabel(h) {
  if (h === 0) return '0h';
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  if (mm === 0) return `${hh}h`;
  if (hh === 0) return `${mm}m`;
  return `${hh}h ${mm}m`;
}

export default function RealityScreen() {
  const { events, weekStart, prevWeek, nextWeek, T } = useContext(AppContext);

  const weekPlan   = useMemo(() => events.events.filter(e => e.calendar === 'plan'   && e.week_start === weekStart), [events.events, weekStart]);
  const weekActual = useMemo(() => events.events.filter(e => e.calendar === 'actual' && e.week_start === weekStart), [events.events, weekStart]);

  const summary = useMemo(() => {
    const byCat = {};
    for (const cat of events.allCategories) {
      byCat[cat.id] = { cat, planned: 0, actual: 0 };
    }

    weekPlan.forEach(e => {
      if (!e.is_all_day) {
        if (!byCat[e.category]) byCat[e.category] = { cat: { id: e.category, label: e.category, color: e.color || '#6B7280' }, planned: 0, actual: 0 };
        byCat[e.category].planned += slotsToHours(e.slot_duration, e.precision || 0.5);
      }
    });
    weekActual.forEach(e => {
      if (!e.is_all_day) {
        if (!byCat[e.category]) byCat[e.category] = { cat: { id: e.category, label: e.category, color: e.color || '#6B7280' }, planned: 0, actual: 0 };
        byCat[e.category].actual += slotsToHours(e.slot_duration, e.precision || 0.5);
      }
    });

    return Object.values(byCat).filter(r => r.planned > 0 || r.actual > 0);
  }, [weekPlan, weekActual, events.allCategories]);

  const totalPlanned = summary.reduce((s, r) => s + r.planned, 0);
  const totalActual  = summary.reduce((s, r) => s + r.actual,  0);
  const maxHours     = Math.max(totalPlanned, totalActual, 1);

  const accuracy = totalPlanned > 0 ? Math.min(100, Math.round((totalActual / totalPlanned) * 100)) : 0;

  return (
    <SafeAreaView style={[st.safe, { backgroundColor: T.bg }]} edges={['top']}>
      <View style={[st.header, { backgroundColor: T.surface, borderBottomColor: T.border }]}>
        <Text style={[st.title, { color: T.text }]}>See Your Life</Text>
        <View style={st.weekNav}>
          <Pressable onPress={prevWeek} hitSlop={12} style={st.navBtn}>
            <Text style={[st.navArrow, { color: T.accent }]}>‹</Text>
          </Pressable>
          <Text style={[st.weekLabel, { color: T.textSub }]}>{formatWeekRange(weekStart)}</Text>
          <Pressable onPress={nextWeek} hitSlop={12} style={st.navBtn}>
            <Text style={[st.navArrow, { color: T.accent }]}>›</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={st.content}>
        {/* Overview card */}
        <View style={[st.card, { backgroundColor: T.surface }]}>
          <Text style={[st.cardTitle, { color: T.text }]}>Week Overview</Text>
          <View style={st.overviewRow}>
            <View style={st.overviewStat}>
              <Text style={[st.overviewNum, { color: T.text }]}>{hoursLabel(totalPlanned)}</Text>
              <Text style={[st.overviewLabel, { color: T.textMuted }]}>Planned</Text>
            </View>
            <View style={[st.overviewDivider, { backgroundColor: accuracy >= 80 ? '#22C55E' : accuracy >= 50 ? '#F59E0B' : '#EF4444' }]}>
              <Text style={st.overviewAccuracy}>{accuracy}%</Text>
            </View>
            <View style={st.overviewStat}>
              <Text style={[st.overviewNum, { color: T.text }]}>{hoursLabel(totalActual)}</Text>
              <Text style={[st.overviewLabel, { color: T.textMuted }]}>Logged</Text>
            </View>
          </View>
        </View>

        {/* Per-category breakdown */}
        {summary.length === 0 ? (
          <View style={st.empty}>
            <Text style={[st.emptyText, { color: T.textSub }]}>No events this week.</Text>
            <Text style={[st.emptySubText, { color: T.textFaint }]}>Add events in Plan or Live tabs.</Text>
          </View>
        ) : (
          <View style={[st.card, { backgroundColor: T.surface }]}>
            <Text style={[st.cardTitle, { color: T.text }]}>By Category</Text>
            {summary.map(({ cat, planned, actual }) => {
              const planPct   = (planned / maxHours) * 100;
              const actualPct = (actual  / maxHours) * 100;
              const diff      = actual - planned;
              return (
                <View key={cat.id} style={st.catRow}>
                  <View style={st.catLabel}>
                    <View style={[st.catDot, { backgroundColor: cat.color }]} />
                    <Text style={[st.catName, { color: T.textSub }]}>{cat.label}</Text>
                  </View>
                  <View style={st.bars}>
                    {/* Planned bar */}
                    <View style={[st.barTrack, { backgroundColor: T.borderLight }]}>
                      <View style={[st.barFill, { width: `${planPct}%`, backgroundColor: cat.color, opacity: 0.35 }]} />
                      <Text style={[st.barLabel, { color: T.textSub }]}>{hoursLabel(planned)}</Text>
                    </View>
                    {/* Actual bar */}
                    <View style={[st.barTrack, { backgroundColor: T.borderLight }]}>
                      <View style={[st.barFill, { width: `${actualPct}%`, backgroundColor: cat.color }]} />
                      <Text style={[st.barLabel, { color: T.textSub }]}>{hoursLabel(actual)}</Text>
                    </View>
                  </View>
                  <Text style={[st.diffLabel, diff > 0 ? st.diffOver : diff < 0 ? st.diffUnder : { color: T.textFaint }]}>
                    {diff > 0 ? `+${hoursLabel(diff)}` : diff < 0 ? `-${hoursLabel(-diff)}` : '±0'}
                  </Text>
                </View>
              );
            })}
            {/* Legend */}
            <View style={[st.legend, { borderTopColor: T.borderLight }]}>
              <View style={st.legendItem}>
                <View style={[st.legendSwatch, { backgroundColor: T.border }]} />
                <Text style={[st.legendTxt, { color: T.textMuted }]}>Planned</Text>
              </View>
              <View style={st.legendItem}>
                <View style={[st.legendSwatch, { backgroundColor: T.accent }]} />
                <Text style={[st.legendTxt, { color: T.textMuted }]}>Logged</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe:            { flex: 1 },
  header:          { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  title:           { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  weekNav:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
  navBtn:          { padding: 8 },
  navArrow:        { fontSize: 26, fontWeight: '300', lineHeight: 30 },
  weekLabel:       { fontSize: 15, fontWeight: '600', minWidth: 130, textAlign: 'center' },
  content:         { padding: 16, gap: 16 },
  card:            { borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  cardTitle:       { fontSize: 15, fontWeight: '700', marginBottom: 14 },
  overviewRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  overviewStat:    { flex: 1, alignItems: 'center' },
  overviewNum:     { fontSize: 28, fontWeight: '700' },
  overviewLabel:   { fontSize: 12, marginTop: 2 },
  overviewDivider: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  overviewAccuracy:{ color: '#fff', fontSize: 16, fontWeight: '800' },
  empty:           { alignItems: 'center', paddingVertical: 40 },
  emptyText:       { fontSize: 16, fontWeight: '600', marginBottom: 6 },
  emptySubText:    { fontSize: 13 },
  catRow:          { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 8 },
  catLabel:        { width: 80, flexDirection: 'row', alignItems: 'center', gap: 6 },
  catDot:          { width: 8, height: 8, borderRadius: 4 },
  catName:         { fontSize: 13, fontWeight: '600', flex: 1 },
  bars:            { flex: 1, gap: 4 },
  barTrack:        { height: 18, borderRadius: 9, overflow: 'hidden', flexDirection: 'row', alignItems: 'center' },
  barFill:         { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 9 },
  barLabel:        { fontSize: 11, fontWeight: '600', paddingLeft: 6, zIndex: 1 },
  diffLabel:       { width: 40, fontSize: 12, fontWeight: '700', textAlign: 'right' },
  diffOver:        { color: '#22C55E' },
  diffUnder:       { color: '#EF4444' },
  legend:          { flexDirection: 'row', gap: 16, marginTop: 8, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  legendItem:      { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendSwatch:    { width: 12, height: 12, borderRadius: 3 },
  legendTxt:       { fontSize: 13 },
});
