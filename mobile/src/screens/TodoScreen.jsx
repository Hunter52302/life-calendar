import { useContext, useState, useRef } from 'react';
import {
  View, Text, Pressable, ScrollView, TextInput, StyleSheet,
  FlatList, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppContext } from '../context/AppContext.js';

const PRIORITY_COLORS = { low: '#9CA3AF', medium: '#F59E0B', high: '#EF4444' };
const TASK_COLORS = ['#EF4444','#F97316','#F59E0B','#22C55E','#3B82F6','#8B5CF6','#EC4899','#6B7280'];

function TaskRow({ task, onComplete, onUncomplete, onUpdate, onDelete, T }) {
  const [expanded, setExpanded] = useState(false);
  const [titleDraft, setTitleDraft] = useState(task.title);
  const done = task.status === 'completed';

  function saveTitle() {
    const t = titleDraft.trim();
    if (t && t !== task.title) onUpdate({ title: t });
  }

  return (
    <View style={[styles.taskCard, { backgroundColor: T.surface, borderColor: T.border },
      task.color ? { borderLeftColor: task.color, borderLeftWidth: 3 } : null]}>
      <View style={styles.taskRow}>
        {/* Checkbox */}
        <Pressable
          onPress={() => done ? onUncomplete() : onComplete()}
          style={[styles.checkbox, done && { backgroundColor: '#22C55E', borderColor: '#22C55E' }, { borderColor: T.border }]}
          hitSlop={8}
        >
          {done && <Ionicons name="checkmark" size={12} color="#fff" />}
        </Pressable>

        {/* Title */}
        <Pressable style={{ flex: 1 }} onPress={() => setExpanded(v => !v)}>
          <Text style={[styles.taskTitle, { color: done ? T.textFaint : T.text },
            done && { textDecorationLine: 'line-through' }]} numberOfLines={expanded ? 0 : 1}>
            {task.title || <Text style={{ fontStyle: 'italic' }}>Untitled</Text>}
          </Text>
          {task.due_date && (
            <Text style={[styles.taskDue, { color: T.textFaint }]}>{task.due_date}</Text>
          )}
        </Pressable>

        {/* Priority dot */}
        <View style={[styles.priorityDot, { backgroundColor: PRIORITY_COLORS[task.priority] ?? '#9CA3AF' }]} />

        {/* Delete */}
        <Pressable onPress={onDelete} hitSlop={8} style={styles.deleteBtn}>
          <Ionicons name="close" size={16} color={T.textFaint} />
        </Pressable>
      </View>

      {/* Expanded detail panel */}
      {expanded && (
        <View style={[styles.expandPanel, { borderTopColor: T.border }]}>
          <TextInput
            value={titleDraft}
            onChangeText={setTitleDraft}
            onBlur={saveTitle}
            style={[styles.expandInput, { color: T.text, borderColor: T.border, backgroundColor: T.inputBg }]}
            placeholder="Task title…"
            placeholderTextColor={T.placeholder}
          />

          {/* Priority */}
          <View style={styles.expandRow}>
            <Text style={[styles.expandLabel, { color: T.textFaint }]}>Priority</Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {['low', 'medium', 'high'].map(p => (
                <Pressable key={p} onPress={() => onUpdate({ priority: p })}
                  style={[styles.priorityBtn, { borderColor: PRIORITY_COLORS[p] },
                    task.priority === p && { backgroundColor: PRIORITY_COLORS[p] }]}>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: task.priority === p ? '#fff' : PRIORITY_COLORS[p], textTransform: 'capitalize' }}>{p}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Due date */}
          <View style={styles.expandRow}>
            <Text style={[styles.expandLabel, { color: T.textFaint }]}>Due</Text>
            <TextInput
              value={task.due_date ?? ''}
              onChangeText={v => onUpdate({ due_date: v || null })}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={T.placeholder}
              style={[styles.dueDateInput, { color: T.text, borderColor: T.border, backgroundColor: T.inputBg }]}
            />
          </View>

          {/* Color */}
          <View style={styles.expandRow}>
            <Text style={[styles.expandLabel, { color: T.textFaint }]}>Color</Text>
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              {TASK_COLORS.map(c => (
                <Pressable key={c} onPress={() => onUpdate({ color: task.color === c ? null : c })}
                  style={[styles.colorDot, { backgroundColor: c },
                    task.color === c && { borderWidth: 2, borderColor: c, transform: [{ scale: 1.2 }] }]} />
              ))}
            </View>
          </View>

          {/* Save / collapse */}
          <Pressable onPress={() => { saveTitle(); setExpanded(false); }}
            style={[styles.saveBtn, { backgroundColor: T.accent }]}>
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>Save &amp; Close</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function AddTaskForm({ onAdd, onCancel, T }) {
  const [title, setTitle] = useState('');
  const today = new Date().toISOString().slice(0, 10);

  function submit() {
    if (!title.trim()) return;
    onAdd({ title: title.trim(), due_date: today });
  }

  return (
    <View style={[styles.addForm, { backgroundColor: T.surface, borderColor: '#7C3AED' }]}>
      <TextInput
        autoFocus
        value={title}
        onChangeText={setTitle}
        onSubmitEditing={submit}
        placeholder="Task title…"
        placeholderTextColor={T.placeholder}
        returnKeyType="done"
        style={[styles.addInput, { color: T.text, borderBottomColor: T.border }]}
      />
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
        <Pressable style={[styles.addSubmitBtn, { backgroundColor: '#7C3AED', opacity: title.trim() ? 1 : 0.4 }]}
          onPress={submit} disabled={!title.trim()}>
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>Add</Text>
        </Pressable>
        <Pressable style={[styles.addCancelBtn, { borderColor: T.border }]} onPress={onCancel}>
          <Text style={{ color: T.textMuted, fontSize: 13 }}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function TodoScreen() {
  const { events, T } = useContext(AppContext);
  const { tasks, addTask, updateTask, deleteTask, completeTask, uncompleteTask } = events;
  const [showAdd, setShowAdd] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const pending   = (tasks ?? []).filter(t => t.status !== 'completed');
  const completed = (tasks ?? []).filter(t => t.status === 'completed');

  // Rollover: tasks from previous days still pending
  const overdue  = pending.filter(t => t.due_date && t.due_date < today);
  const todayTasks = pending.filter(t => !t.due_date || t.due_date === today);
  const future   = pending.filter(t => t.due_date && t.due_date > today);

  function renderSection(title, items, accent) {
    if (items.length === 0) return null;
    return (
      <View style={{ marginBottom: 8 }}>
        <Text style={[styles.sectionHeader, { color: accent ?? T.textFaint }]}>{title}</Text>
        {items.map(task => (
          <TaskRow
            key={task.id}
            task={task}
            onComplete={() => completeTask(task.id)}
            onUncomplete={() => uncompleteTask(task.id)}
            onUpdate={u => updateTask(task.id, u)}
            onDelete={() => Alert.alert('Delete task', `Delete "${task.title}"?`, [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => deleteTask(task.id) },
            ])}
            T={T}
          />
        ))}
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: T.bg }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: T.border }]}>
        <View>
          <Text style={[styles.headerTitle, { color: T.text }]}>PLS Do It</Text>
          <Text style={[styles.headerSub, { color: T.textFaint }]}>
            {pending.length === 0 ? 'All done ✓' : `${pending.length} task${pending.length !== 1 ? 's' : ''} pending`}
          </Text>
        </View>
        <Pressable onPress={() => setShowAdd(true)}
          style={[styles.headerAddBtn, { backgroundColor: '#7C3AED' }]}>
          <Ionicons name="add" size={20} color="#fff" />
        </Pressable>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>

          {/* Add form */}
          {showAdd && (
            <AddTaskForm
              T={T}
              onAdd={data => { addTask(data); setShowAdd(false); }}
              onCancel={() => setShowAdd(false)}
            />
          )}

          {/* Empty state */}
          {!showAdd && pending.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={{ fontSize: 40 }}>✓</Text>
              <Text style={[styles.emptyTitle, { color: T.text }]}>All done!</Text>
              <Text style={[styles.emptyBody, { color: T.textFaint }]}>Tap + to add a task.</Text>
            </View>
          )}

          {renderSection('⚠ Overdue', overdue, '#EF4444')}
          {renderSection('Today', todayTasks, T.accent)}
          {renderSection('Upcoming', future, T.textMuted)}

          {/* Completed */}
          {completed.length > 0 && (
            <View>
              <Pressable onPress={() => setShowCompleted(v => !v)} style={styles.completedToggle}>
                <Text style={[styles.sectionHeader, { color: T.textFaint }]}>
                  {showCompleted ? '▼' : '▶'} Completed ({completed.length})
                </Text>
              </Pressable>
              {showCompleted && renderSection('', completed, T.textFaint)}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* FAB */}
      {!showAdd && (
        <Pressable style={[styles.fab, { backgroundColor: '#7C3AED' }]} onPress={() => setShowAdd(true)}>
          <Ionicons name="add" size={28} color="#fff" />
        </Pressable>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1 },
  header:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle:     { fontSize: 22, fontWeight: '700' },
  headerSub:       { fontSize: 12, marginTop: 2 },
  headerAddBtn:    { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },

  sectionHeader:   { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6, marginTop: 4 },

  taskCard:        { borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, marginBottom: 8, overflow: 'hidden' },
  taskRow:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 10 },
  checkbox:        { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  taskTitle:       { fontSize: 14, fontWeight: '500' },
  taskDue:         { fontSize: 11, marginTop: 2 },
  priorityDot:     { width: 7, height: 7, borderRadius: 4, flexShrink: 0 },
  deleteBtn:       { padding: 2 },

  expandPanel:     { borderTopWidth: StyleSheet.hairlineWidth, padding: 12, gap: 10 },
  expandInput:     { fontSize: 14, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  expandRow:       { flexDirection: 'row', alignItems: 'center', gap: 10 },
  expandLabel:     { fontSize: 12, width: 52 },
  priorityBtn:     { borderWidth: 1.5, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  dueDateInput:    { flex: 1, fontSize: 13, borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  colorDot:        { width: 20, height: 20, borderRadius: 10 },
  saveBtn:         { borderRadius: 8, paddingVertical: 8, alignItems: 'center', marginTop: 4 },

  addForm:         { borderRadius: 12, borderWidth: 1.5, padding: 14, marginBottom: 16 },
  addInput:        { fontSize: 15, fontWeight: '500', borderBottomWidth: 1, paddingBottom: 8 },
  addSubmitBtn:    { flex: 1, borderRadius: 8, paddingVertical: 9, alignItems: 'center' },
  addCancelBtn:    { borderWidth: 1, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 9, alignItems: 'center' },

  emptyState:      { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyTitle:      { fontSize: 20, fontWeight: '700' },
  emptyBody:       { fontSize: 14 },

  completedToggle: { paddingVertical: 4 },

  fab:             { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowOffset: { width: 0, height: 3 }, shadowRadius: 6, elevation: 6 },
});
