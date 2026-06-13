import { useMemo, useContext } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppContext } from '../context/AppContext.js';
import { formatWeekRange, slotsToHours } from '../lib/utils.js';

function BudgetBadge({ actual, budget }) {
  if (budget == null) return null;
  const pct = Math.round((actual / budget) * 100);
  const color = pct >= 100 ? '#EF4444' : pct >= 80 ? '#F59E0B' : '#22C55E';
  return (
    <View style={[badgeStyles.wrap, { backgroundColor: color + '22', borderColor: color }]}>
      <Text style={[badgeStyles.txt, { color }]}>{pct}%</Text>
    </View>
  );
}
const badgeStyles = StyleSheet.create({
  wrap: { borderRadius: 6, borderWidth: 1, paddingHorizontal: 5, paddingVertical: 2, marginLeft: 6 },
  txt:  { fontSize: 10, fontWeight: '700' },
});

function hoursLabel(h) {
  if (h === 0) return '0h';
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  if (mm === 0) return `${hh}h`;
  if (hh === 0) return `${mm}m`;
  return `${hh}h ${mm}m`;
}

export default function RealityScreen() {
  const { events, weekStart, prevWeek, nextWeek, budgets: budgetsData } = useContext(AppContext);
  const budgets = budgetsData?.budgets ?? {};

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
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>See Your Life</Text>
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

      <ScrollView contentContainerStyle={styles.content}>
        {/* Overview card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Week Overview</Text>
          <View style={styles.overviewRow}>
            <View style={styles.overviewStat}>
              <Text style={styles.overviewNum}>{hoursLabel(totalPlanned)}</Text>
              <Text style={styles.overviewLabel}>Planned</Text>
            </View>
            <View style={[styles.overviewDivider, { backgroundColor: accuracy >= 80 ? '#22C55E' : accuracy >= 50 ? '#F59E0B' : '#EF4444' }]}>
              <Text style={styles.overviewAccuracy}>{accuracy}%</Text>
            </View>
            <View style={styles.overviewStat}>
              <Text style={styles.overviewNum}>{hoursLabel(totalActual)}</Text>
              <Text style={styles.overviewLabel}>Logged</Text>
            </View>
          </View>
        </View>

        {/* Per-category breakdown */}
        {summary.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No events this week.</Text>
            <Text style={styles.emptySubText}>Add events in Plan or Live tabs.</Text>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>By Category</Text>
            {summary.map(({ cat, planned, actual }) => {
              const planPct   = (planned / maxHours) * 100;
              const actualPct = (actual  / maxHours) * 100;
              const diff      = actual - planned;
              return (
                <View key={cat.id} style={styles.catRow}>
                  <View style={styles.catLabel}>
                    <View style={[styles.catDot, { backgroundColor: cat.color }]} />
                    <Text style={styles.catName}>{cat.label}</Text>
                    <BudgetBadge actual={actual} budget={budgets[cat.id] ?? null} />
                  </View>
                  <View style={styles.bars}>
                    {/* Planned bar */}
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { width: `${planPct}%`, backgroundColor: cat.color, opacity: 0.3 }]} />
                      <Text style={styles.barLabel}>{hoursLabel(planned)}</Text>
                    </View>
                    {/* Actual bar */}
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { width: `${actualPct}%`, backgroundColor: cat.color }]} />
                      <Text style={styles.barLabel}>{hoursLabel(actual)}</Text>
                    </View>
                  </View>
                  <Text style={[
                    styles.diffLabel,
                    diff > 0 ? styles.diffOver : diff < 0 ? styles.diffUnder : styles.diffEven
                  ]}>
                    {diff > 0 ? `+${hoursLabel(diff)}` : diff < 0 ? `-${hoursLabel(-diff)}` : '±0'}
                  </Text>
                </View>
              );
            })}
            {/* Legend */}
            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendSwatch, { backgroundColor: '#D1D5DB' }]} />
                <Text style={styles.legendTxt}>Planned</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendSwatch, { backgroundColor: '#7C3AED' }]} />
                <Text style={styles.legendTxt}>Logged</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: '#F9FAFB' },
  header:          { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E7EB', backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title:           { fontSize: 20, fontWeight: '700', color: '#111827' },
  weekNav:         { flexDirection: 'row', alignItems: 'center', gap: 8 },
  navBtn:          { padding: 4 },
  navArrow:        { fontSize: 22, color: '#7C3AED', fontWeight: '300' },
  weekLabel:       { fontSize: 13, fontWeight: '600', color: '#374151', minWidth: 120, textAlign: 'center' },
  content:         { padding: 16, gap: 16 },
  card:            { backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  cardTitle:       { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 14 },
  overviewRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  overviewStat:    { flex: 1, alignItems: 'center' },
  overviewNum:     { fontSize: 28, fontWeight: '700', color: '#111827' },
  overviewLabel:   { fontSize: 12, color: '#6B7280', marginTop: 2 },
  overviewDivider: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  overviewAccuracy:{ color: '#fff', fontSize: 16, fontWeight: '800' },
  empty:           { alignItems: 'center', paddingVertical: 40 },
  emptyText:       { fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 6 },
  emptySubText:    { fontSize: 13, color: '#9CA3AF' },
  catRow:          { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 8 },
  catLabel:        { width: 80, flexDirection: 'row', alignItems: 'center', gap: 6 },
  catDot:          { width: 8, height: 8, borderRadius: 4 },
  catName:         { fontSize: 11, fontWeight: '600', color: '#374151', flex: 1 },
  bars:            { flex: 1, gap: 3 },
  barTrack:        { height: 14, backgroundColor: '#F3F4F6', borderRadius: 7, overflow: 'hidden', flexDirection: 'row', alignItems: 'center' },
  barFill:         { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 7 },
  barLabel:        { fontSize: 9, color: '#374151', fontWeight: '600', paddingLeft: 6, zIndex: 1 },
  diffLabel:       { width: 36, fontSize: 10, fontWeight: '700', textAlign: 'right' },
  diffOver:        { color: '#22C55E' },
  diffUnder:       { color: '#EF4444' },
  diffEven:        { color: '#9CA3AF' },
  legend:          { flexDirection: 'row', gap: 16, marginTop: 8, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#F3F4F6' },
  legendItem:      { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendSwatch:    { width: 12, height: 12, borderRadius: 3 },
  legendTxt:       { fontSize: 11, color: '#6B7280' },
});
