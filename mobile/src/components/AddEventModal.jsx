import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, Pressable, Modal, ScrollView,
  StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { DAYS_SHORT, slotToTime } from '../lib/utils.js';

const DURATION_OPTIONS = [
  { label: '30m', slots: 1 },
  { label: '1h',  slots: 2 },
  { label: '2h',  slots: 4 },
  { label: '3h',  slots: 6 },
  { label: '4h',  slots: 8 },
  { label: '8h',  slots: 16 },
];

export default function AddEventModal({
  visible, event, defaultDay, defaultSlot, allCategories,
  weekStart, calendar, onSave, onDelete, onClose,
}) {
  const [label,    setLabel]    = useState('');
  const [catId,    setCatId]    = useState('');
  const [day,      setDay]      = useState(0);
  const [slot,     setSlot]     = useState(14);
  const [duration, setDuration] = useState(2);
  const [allDay,   setAllDay]   = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (event) {
      setLabel(event.label || '');
      setCatId(event.category || allCategories[0]?.id || 'personal');
      setDay(event.day_of_week ?? 0);
      setSlot(event.slot_start ?? 14);
      setDuration(event.slot_duration ?? 2);
      setAllDay(event.is_all_day ?? false);
    } else {
      setLabel('');
      setCatId(allCategories[0]?.id || 'personal');
      setDay(defaultDay ?? 0);
      setSlot(defaultSlot ?? 14);
      setDuration(2);
      setAllDay(false);
    }
  }, [visible, event]); // eslint-disable-line react-hooks/exhaustive-deps

  const cat = allCategories.find(c => c.id === catId) || allCategories[0];

  function handleSave() {
    if (!label.trim()) return;
    const data = {
      ...(event ? { id: event.id } : {}),
      label:         label.trim(),
      category:      cat?.id,
      color:         cat?.color,
      day_of_week:   day,
      slot_start:    slot,
      slot_duration: duration,
      precision:     0.5,
      is_all_day:    allDay,
      week_start:    weekStart,
      calendar:      calendar || event?.calendar || 'plan',
    };
    onSave(data);
  }

  function adjustSlot(delta) {
    setSlot(s => Math.max(0, Math.min(47, s + delta)));
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.kvWrap}
      >
        <View style={styles.sheet}>
          {/* Handle bar */}
          <View style={styles.handle} />

          {/* Title row */}
          <View style={styles.titleRow}>
            <Text style={styles.sheetTitle}>{event ? 'Edit Event' : 'Add Event'}</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeTxt}>✕</Text>
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Label */}
            <TextInput
              style={styles.input}
              placeholder="Event title"
              placeholderTextColor="#9CA3AF"
              value={label}
              onChangeText={setLabel}
              autoFocus={!event}
              returnKeyType="done"
            />

            {/* Category chips */}
            <Text style={styles.sectionLabel}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
              {allCategories.map(c => (
                <Pressable
                  key={c.id}
                  onPress={() => setCatId(c.id)}
                  style={[
                    styles.catChip,
                    { backgroundColor: c.color },
                    c.id !== catId && styles.catChipInactive,
                  ]}
                >
                  <Text style={styles.catChipText}>{c.label}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* Day selector */}
            <Text style={styles.sectionLabel}>Day</Text>
            <View style={styles.dayRow}>
              {DAYS_SHORT.map((d, i) => (
                <Pressable
                  key={i}
                  onPress={() => setDay(i)}
                  style={[styles.dayBtn, day === i && styles.dayBtnActive]}
                >
                  <Text style={[styles.dayBtnText, day === i && styles.dayBtnTextActive]}>
                    {d.slice(0, 2)}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* All-day toggle */}
            <View style={styles.row}>
              <Text style={styles.sectionLabel}>All day</Text>
              <Pressable
                onPress={() => setAllDay(v => !v)}
                style={[styles.toggle, allDay && styles.toggleOn]}
              >
                <View style={[styles.toggleThumb, allDay && styles.toggleThumbOn]} />
              </Pressable>
            </View>

            {!allDay && (
              <>
                {/* Start time */}
                <Text style={styles.sectionLabel}>Start time</Text>
                <View style={styles.stepper}>
                  <Pressable onPress={() => adjustSlot(-1)} style={styles.stepBtn}>
                    <Text style={styles.stepTxt}>−</Text>
                  </Pressable>
                  <Text style={styles.stepValue}>{slotToTime(slot, 0.5)}</Text>
                  <Pressable onPress={() => adjustSlot(1)} style={styles.stepBtn}>
                    <Text style={styles.stepTxt}>+</Text>
                  </Pressable>
                </View>

                {/* Duration */}
                <Text style={styles.sectionLabel}>Duration</Text>
                <View style={styles.durationRow}>
                  {DURATION_OPTIONS.map(opt => (
                    <Pressable
                      key={opt.slots}
                      onPress={() => setDuration(opt.slots)}
                      style={[styles.durationChip, duration === opt.slots && styles.durationChipActive]}
                    >
                      <Text style={[styles.durationChipText, duration === opt.slots && styles.durationChipTextActive]}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}

            {/* Action buttons */}
            <View style={styles.actions}>
              {event && onDelete && (
                <Pressable onPress={() => onDelete(event.id)} style={styles.btnDelete}>
                  <Text style={styles.btnDeleteText}>Delete</Text>
                </Pressable>
              )}
              <Pressable onPress={onClose} style={styles.btnCancel}>
                <Text style={styles.btnCancelText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleSave} style={[styles.btnSave, { backgroundColor: cat?.color || '#7C3AED' }]}>
                <Text style={styles.btnSaveText}>Save</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay:          { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  kvWrap:           { flex: 1, justifyContent: 'flex-end' },
  sheet:            { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingBottom: 40, maxHeight: '90%' },
  handle:           { width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  titleRow:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  sheetTitle:       { fontSize: 18, fontWeight: '700', color: '#111827' },
  closeBtn:         { padding: 4 },
  closeTxt:         { fontSize: 16, color: '#6B7280' },
  input:            { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, padding: 12, fontSize: 16, color: '#111827', backgroundColor: '#F9FAFB', marginBottom: 16 },
  sectionLabel:     { fontSize: 13, fontWeight: '600', color: '#6B7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  catScroll:        { marginBottom: 16 },
  catChip:          { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, marginRight: 8 },
  catChipInactive:  { opacity: 0.35 },
  catChipText:      { color: '#fff', fontSize: 13, fontWeight: '600' },
  dayRow:           { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  dayBtn:           { flex: 1, marginHorizontal: 2, paddingVertical: 8, borderRadius: 8, backgroundColor: '#F3F4F6', alignItems: 'center' },
  dayBtnActive:     { backgroundColor: '#7C3AED' },
  dayBtnText:       { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  dayBtnTextActive: { color: '#fff' },
  row:              { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  toggle:           { width: 44, height: 26, borderRadius: 13, backgroundColor: '#D1D5DB', padding: 2, justifyContent: 'center' },
  toggleOn:         { backgroundColor: '#7C3AED' },
  toggleThumb:      { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff' },
  toggleThumbOn:    { alignSelf: 'flex-end' },
  stepper:          { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  stepBtn:          { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  stepTxt:          { fontSize: 20, color: '#374151', fontWeight: '300', lineHeight: 24 },
  stepValue:        { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '600', color: '#111827' },
  durationRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  durationChip:     { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, backgroundColor: '#F3F4F6' },
  durationChipActive:     { backgroundColor: '#7C3AED' },
  durationChipText:       { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  durationChipTextActive: { color: '#fff' },
  actions:          { flexDirection: 'row', gap: 10, marginTop: 4 },
  btnDelete:        { flex: 1, paddingVertical: 13, borderRadius: 12, backgroundColor: '#FEE2E2', alignItems: 'center' },
  btnDeleteText:    { color: '#DC2626', fontWeight: '700', fontSize: 15 },
  btnCancel:        { flex: 1, paddingVertical: 13, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center' },
  btnCancelText:    { color: '#374151', fontWeight: '600', fontSize: 15 },
  btnSave:          { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
  btnSaveText:      { color: '#fff', fontWeight: '700', fontSize: 15 },
});
