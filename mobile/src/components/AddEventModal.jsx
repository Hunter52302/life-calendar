import { useState, useEffect, useContext } from 'react';
import {
  View, Text, TextInput, Pressable, Modal, ScrollView,
  StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { DAYS_SHORT, slotToTime } from '../lib/utils.js';
import { AppContext } from '../context/AppContext.js';
import { isLikelyUrl, openExternalUrl, openMapProviderPicker } from '../lib/handoffActions.js';

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
  weekStart, calendar, precision: precisionProp, onSave, onDelete, onClose,
}) {
  const { T } = useContext(AppContext);
  const [label,    setLabel]    = useState('');
  const [catId,    setCatId]    = useState('');
  const [day,      setDay]      = useState(0);
  const [slot,     setSlot]     = useState(14);
  const [duration, setDuration] = useState(2);
  const [allDay,   setAllDay]   = useState(false);
  const [location, setLocation] = useState('');
  const [meetingUrl, setMeetingUrl] = useState('');
  const [travelBufferMinutes, setTravelBufferMinutes] = useState(0);

  useEffect(() => {
    if (!visible) return;
    if (event) {
      setLabel(event.label || '');
      setCatId(event.category || allCategories[0]?.id || 'personal');
      setDay(event.day_of_week ?? 0);
      setSlot(event.slot_start ?? 14);
      setDuration(event.slot_duration ?? 2);
      setAllDay(event.is_all_day ?? false);
      setLocation(event.location || '');
      setMeetingUrl(event.meeting_url || '');
      setTravelBufferMinutes(event.travel_buffer_minutes || 0);
    } else {
      setLabel('');
      setCatId(allCategories[0]?.id || 'personal');
      setDay(defaultDay ?? 0);
      setSlot(defaultSlot ?? 14);
      setDuration(2);
      setAllDay(false);
      setLocation('');
      setMeetingUrl('');
      setTravelBufferMinutes(0);
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
      precision:     precisionProp ?? 0.5,
      is_all_day:    allDay,
      week_start:    weekStart,
      calendar:      calendar || event?.calendar || 'plan',
      source:        'manual',
      ...(location.trim() ? { location: location.trim() } : {}),
      ...(meetingUrl.trim() ? { meeting_url: meetingUrl.trim() } : {}),
      ...(Number(travelBufferMinutes) > 0 ? { travel_buffer_minutes: Number(travelBufferMinutes) } : {}),
    };
    onSave(data);
  }

  function adjustSlot(delta) {
    setSlot(s => Math.max(0, Math.min(47, s + delta)));
  }

  // Themed colours
  const sheetBg      = T?.surface    ?? '#ffffff';
  const handleColor  = T?.border     ?? '#E5E7EB';
  const titleColor   = T?.text       ?? '#111827';
  const closeTxtColor= T?.textMuted  ?? '#6B7280';
  const inputBg      = T?.inputBg    ?? '#F9FAFB';
  const inputBorder  = T?.inputBorder?? '#E5E7EB';
  const labelColor   = T?.textMuted  ?? '#6B7280';
  const dayInactiveBg= T?.segmentBg  ?? '#F3F4F6';
  const dayActiveColor= T?.accent    ?? '#7C3AED';
  const dayInactiveText= T?.textMuted?? '#6B7280';
  const stepBg       = T?.inputBg    ?? '#F3F4F6';
  const stepColor    = T?.textSub    ?? '#374151';
  const cancelBg     = T?.inputBg    ?? '#F3F4F6';
  const cancelTxt    = T?.textSub    ?? '#374151';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.kvWrap}
      >
        <View style={[styles.sheet, { backgroundColor: sheetBg }]}>
          {/* Handle bar */}
          <View style={[styles.handle, { backgroundColor: handleColor }]} />

          {/* Title row */}
          <View style={styles.titleRow}>
            <Text style={[styles.sheetTitle, { color: titleColor }]}>{event ? 'Edit Event' : 'Add Event'}</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={[styles.closeTxt, { color: closeTxtColor }]}>✕</Text>
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Label */}
            <TextInput
              style={[styles.input, { borderColor: inputBorder, backgroundColor: inputBg, color: titleColor }]}
              placeholder="Event title"
              placeholderTextColor={T?.placeholder ?? '#9CA3AF'}
              value={label}
              onChangeText={setLabel}
              autoFocus={!event}
              returnKeyType="done"
            />

            {/* Category chips */}
            <Text style={[styles.sectionLabel, { color: labelColor }]}>Category</Text>
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
            <Text style={[styles.sectionLabel, { color: labelColor }]}>Day</Text>
            <View style={styles.dayRow}>
              {DAYS_SHORT.map((d, i) => (
                <Pressable
                  key={i}
                  onPress={() => setDay(i)}
                  style={[styles.dayBtn, { backgroundColor: dayInactiveBg }, day === i && { backgroundColor: dayActiveColor }]}
                >
                  <Text style={[styles.dayBtnText, { color: dayInactiveText }, day === i && { color: '#fff' }]}>
                    {d.slice(0, 2)}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* All-day toggle */}
            <View style={styles.row}>
              <Text style={[styles.sectionLabel, { color: labelColor }]}>All day</Text>
              <Pressable
                onPress={() => setAllDay(v => !v)}
                style={[styles.toggle, { backgroundColor: allDay ? dayActiveColor : (T?.switchFalse ?? '#D1D5DB') }]}
              >
                <View style={[styles.toggleThumb, allDay && styles.toggleThumbOn]} />
              </Pressable>
            </View>

            {!allDay && (
              <>
                {/* Start time */}
                <Text style={[styles.sectionLabel, { color: labelColor }]}>Start time</Text>
                <View style={styles.stepper}>
                  <Pressable onPress={() => adjustSlot(-1)} style={[styles.stepBtn, { backgroundColor: stepBg }]}>
                    <Text style={[styles.stepTxt, { color: stepColor }]}>−</Text>
                  </Pressable>
                  <Text style={[styles.stepValue, { color: titleColor }]}>{slotToTime(slot, 0.5)}</Text>
                  <Pressable onPress={() => adjustSlot(1)} style={[styles.stepBtn, { backgroundColor: stepBg }]}>
                    <Text style={[styles.stepTxt, { color: stepColor }]}>+</Text>
                  </Pressable>
                </View>

                {/* Duration */}
                <Text style={[styles.sectionLabel, { color: labelColor }]}>Duration</Text>
                <View style={styles.durationRow}>
                  {DURATION_OPTIONS.map(opt => (
                    <Pressable
                      key={opt.slots}
                      onPress={() => setDuration(opt.slots)}
                      style={[styles.durationChip, { backgroundColor: duration === opt.slots ? dayActiveColor : dayInactiveBg }]}
                    >
                      <Text style={[styles.durationChipText, { color: duration === opt.slots ? '#fff' : dayInactiveText }]}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}

            <Text style={[styles.sectionLabel, { color: labelColor }]}>Location</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, styles.inputFlex, { borderColor: inputBorder, backgroundColor: inputBg, color: titleColor }]}
                placeholder="Address or place name"
                placeholderTextColor={T?.placeholder ?? '#9CA3AF'}
                value={location}
                onChangeText={setLocation}
              />
              {!!location.trim() && (
                <Pressable onPress={() => openMapProviderPicker(location)} style={[styles.smallBtn, { backgroundColor: stepBg }]}>
                  <Text style={[styles.smallBtnText, { color: stepColor }]}>Open in Maps</Text>
                </Pressable>
              )}
            </View>
            <Text style={[styles.helperText, { color: labelColor }]}>Maps opens only after you choose a provider.</Text>

            <Text style={[styles.sectionLabel, { color: labelColor }]}>Meeting link</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, styles.inputFlex, { borderColor: inputBorder, backgroundColor: inputBg, color: titleColor }]}
                placeholder="https://zoom.us/j/..."
                placeholderTextColor={T?.placeholder ?? '#9CA3AF'}
                value={meetingUrl}
                onChangeText={setMeetingUrl}
                autoCapitalize="none"
                keyboardType="url"
              />
              {isLikelyUrl(meetingUrl) && (
                <Pressable onPress={() => openExternalUrl(meetingUrl.trim())} style={[styles.smallBtn, { backgroundColor: stepBg }]}>
                  <Text style={[styles.smallBtnText, { color: stepColor }]}>Open</Text>
                </Pressable>
              )}
            </View>
            <Text style={[styles.helperText, { color: labelColor }]}>Links open only after you tap.</Text>

            <Text style={[styles.sectionLabel, { color: labelColor }]}>Travel buffer</Text>
            <View style={styles.durationRow}>
              {[0, 15, 30, 45, 60].map(minutes => (
                <Pressable
                  key={minutes}
                  onPress={() => setTravelBufferMinutes(minutes)}
                  style={[styles.durationChip, { backgroundColor: Number(travelBufferMinutes) === minutes ? dayActiveColor : dayInactiveBg }]}
                >
                  <Text style={[styles.durationChipText, { color: Number(travelBufferMinutes) === minutes ? '#fff' : dayInactiveText }]}>
                    {minutes === 0 ? 'None' : `${minutes} min`}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={[styles.helperText, { color: labelColor }]}>Manual time blocked before event. No route lookup.</Text>

            {/* Action buttons */}
            <View style={styles.actions}>
              {event && onDelete && (
                <Pressable onPress={() => onDelete(event.id)} style={[styles.btnDelete, { backgroundColor: T?.dangerLight ?? '#FEE2E2' }]}>
                  <Text style={[styles.btnDeleteText, { color: T?.danger ?? '#DC2626' }]}>Delete</Text>
                </Pressable>
              )}
              <Pressable onPress={onClose} style={[styles.btnCancel, { backgroundColor: cancelBg }]}>
                <Text style={[styles.btnCancelText, { color: cancelTxt }]}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleSave} style={[styles.btnSave, { backgroundColor: cat?.color || dayActiveColor }]}>
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
  sheet:            { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingBottom: 40, maxHeight: '90%' },
  handle:           { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  titleRow:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  sheetTitle:       { fontSize: 18, fontWeight: '700' },
  closeBtn:         { padding: 4 },
  closeTxt:         { fontSize: 16 },
  input:            { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 16, marginBottom: 16 },
  inputRow:         { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginBottom: 4 },
  inputFlex:        { flex: 1, marginBottom: 0 },
  smallBtn:         { paddingHorizontal: 12, paddingVertical: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  smallBtnText:     { fontSize: 12, fontWeight: '700' },
  helperText:       { fontSize: 11, marginBottom: 16 },
  sectionLabel:     { fontSize: 13, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  catScroll:        { marginBottom: 16 },
  catChip:          { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, marginRight: 8 },
  catChipInactive:  { opacity: 0.35 },
  catChipText:      { color: '#fff', fontSize: 13, fontWeight: '600' },
  dayRow:           { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  dayBtn:           { flex: 1, marginHorizontal: 2, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  dayBtnText:       { fontSize: 12, fontWeight: '600' },
  row:              { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  toggle:           { width: 44, height: 26, borderRadius: 13, padding: 2, justifyContent: 'center' },
  toggleThumb:      { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff' },
  toggleThumbOn:    { alignSelf: 'flex-end' },
  stepper:          { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  stepBtn:          { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  stepTxt:          { fontSize: 20, fontWeight: '300', lineHeight: 24 },
  stepValue:        { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '600' },
  durationRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  durationChip:     { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
  durationChipText: { fontSize: 13, fontWeight: '600' },
  actions:          { flexDirection: 'row', gap: 10, marginTop: 4 },
  btnDelete:        { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
  btnDeleteText:    { fontWeight: '700', fontSize: 15 },
  btnCancel:        { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
  btnCancelText:    { fontWeight: '600', fontSize: 15 },
  btnSave:          { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
  btnSaveText:      { color: '#fff', fontWeight: '700', fontSize: 15 },
});
