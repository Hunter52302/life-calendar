import { useState, useContext } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, FlatList, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppContext } from '../context/AppContext.js';

const HABIT_COLORS = ['#7C3AED', '#3B82F6', '#22C55E', '#F59E0B', '#EF4444', '#14B8A6', '#EC4899'];

export default function HabitsScreen() {
  const { habits: habitsData } = useContext(AppContext);
  const { habitsWithStreaks, addHabit, deleteHabit, toggleCompletion } = habitsData;

  const [adding, setAdding]     = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newColor, setNewColor] = useState(HABIT_COLORS[0]);

  function handleAdd() {
    if (!newLabel.trim()) return;
    addHabit({ label: newLabel.trim(), color: newColor });
    setNewLabel('');
    setAdding(false);
  }

  function confirmDelete(habit) {
    Alert.alert(
      'Delete habit?',
      `"${habit.label}" and its history will be removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteHabit(habit.id) },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Habits</Text>
        <Pressable onPress={() => setAdding(v => !v)} style={styles.addBtn}>
          <Text style={styles.addBtnText}>{adding ? '✕' : '+ Add'}</Text>
        </Pressable>
      </View>

      {adding && (
        <View style={styles.addForm}>
          <TextInput
            style={styles.input}
            placeholder="Habit name (e.g. Exercise)"
            placeholderTextColor="#9CA3AF"
            value={newLabel}
            onChangeText={setNewLabel}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleAdd}
          />
          <View style={styles.colorRow}>
            {HABIT_COLORS.map(c => (
              <Pressable
                key={c}
                onPress={() => setNewColor(c)}
                style={[styles.colorDot, { backgroundColor: c }, newColor === c && styles.colorDotActive]}
              />
            ))}
          </View>
          <Pressable onPress={handleAdd} style={[styles.saveBtn, !newLabel.trim() && styles.saveBtnDisabled]} disabled={!newLabel.trim()}>
            <Text style={styles.saveBtnText}>Save habit</Text>
          </Pressable>
        </View>
      )}

      {habitsWithStreaks.length === 0 && !adding ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🌱</Text>
          <Text style={styles.emptyText}>No habits yet.</Text>
          <Text style={styles.emptySub}>Add one and check it off each day to build a streak.</Text>
        </View>
      ) : (
        <FlatList
          data={habitsWithStreaks}
          keyExtractor={h => h.id}
          contentContainerStyle={styles.list}
          renderItem={({ item: h }) => (
            <View style={styles.habitRow}>
              <Pressable
                onPress={() => toggleCompletion(h.id)}
                style={[
                  styles.checkCircle,
                  { borderColor: h.color },
                  h.completedToday && { backgroundColor: h.color },
                ]}
              >
                {h.completedToday && <Text style={styles.checkMark}>✓</Text>}
              </Pressable>
              <View style={styles.habitInfo}>
                <Text style={styles.habitLabel}>{h.label}</Text>
                <Text style={styles.habitStreak}>
                  {h.currentStreak > 0
                    ? `${h.currentStreak}-day streak${h.milestone ? ` ${h.milestone}` : ''}`
                    : 'Tap the circle to check in'}
                </Text>
              </View>
              <Pressable onPress={() => confirmDelete(h)} style={styles.deleteBtn}>
                <Text style={styles.deleteBtnText}>✕</Text>
              </Pressable>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: '#F9FAFB' },
  header:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  title:           { fontSize: 24, fontWeight: '700', color: '#111827' },
  addBtn:          { backgroundColor: '#7C3AED', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnText:      { color: '#fff', fontSize: 14, fontWeight: '700' },
  addForm:         { marginHorizontal: 20, marginBottom: 12, padding: 14, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#E5E7EB' },
  input:           { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, padding: 12, fontSize: 15, color: '#111827', marginBottom: 12 },
  colorRow:        { flexDirection: 'row', gap: 10, marginBottom: 12 },
  colorDot:        { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: 'transparent' },
  colorDotActive:  { borderColor: '#111827' },
  saveBtn:         { backgroundColor: '#7C3AED', borderRadius: 10, padding: 12, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText:     { color: '#fff', fontSize: 15, fontWeight: '700' },
  empty:           { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyEmoji:      { fontSize: 40, marginBottom: 12 },
  emptyText:       { fontSize: 17, fontWeight: '600', color: '#374151', marginBottom: 4 },
  emptySub:        { fontSize: 13, color: '#9CA3AF', textAlign: 'center', lineHeight: 19 },
  list:            { paddingHorizontal: 20, paddingBottom: 20 },
  habitRow:        { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#E5E7EB', padding: 14, marginBottom: 10 },
  checkCircle:     { width: 32, height: 32, borderRadius: 16, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  checkMark:       { color: '#fff', fontSize: 16, fontWeight: '800' },
  habitInfo:       { flex: 1, minWidth: 0 },
  habitLabel:      { fontSize: 16, fontWeight: '600', color: '#111827' },
  habitStreak:     { fontSize: 12, color: '#6B7280', marginTop: 2 },
  deleteBtn:       { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  deleteBtnText:   { color: '#D1D5DB', fontSize: 16 },
});
