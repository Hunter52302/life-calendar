import { useState, useEffect, useContext, useRef } from 'react';
import {
  View, Text, TextInput, Pressable, Modal, ScrollView,
  StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { AppContext } from '../context/AppContext.js';
import { parseEventText } from '../lib/parserRouter.js';
import { buildSegments } from '../lib/calendarUtils.js';
import { getWeekStart } from '../lib/utils.js';
import { useVoiceInput } from '../hooks/useVoiceInput.js';

function fmtDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

const CONFIDENCE_COLORS = {
  high:   { bg: '#D1FAE5', text: '#065F46' },
  medium: { bg: '#FEF3C7', text: '#92400E' },
  low:    { bg: '#F3F4F6', text: '#6B7280' },
};
const CONFIDENCE_LABELS = { high: 'exact', medium: 'approx', low: 'inferred' };

function ConfidenceBadge({ confidence }) {
  const style = CONFIDENCE_COLORS[confidence] ?? CONFIDENCE_COLORS.low;
  return (
    <View style={[badge.wrap, { backgroundColor: style.bg }]}>
      <Text style={[badge.txt, { color: style.text }]}>
        {CONFIDENCE_LABELS[confidence] ?? confidence}
      </Text>
    </View>
  );
}

const badge = StyleSheet.create({
  wrap: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  txt:  { fontSize: 10, fontWeight: '700' },
});

function DraftCard({ draft, allCategories, onChange, onToggle }) {
  const isMultiDay = draft.endDate !== draft.startDate;

  return (
    <View style={[card.wrap, !draft.enabled && card.disabled]}>
      <View style={card.row}>
        {/* Checkbox */}
        <Pressable onPress={onToggle} hitSlop={8} style={[card.check, draft.enabled && card.checkOn]}>
          {draft.enabled && <Text style={card.checkMark}>✓</Text>}
        </Pressable>

        <View style={card.body}>
          <TextInput
            style={[card.label, !draft.enabled && { color: '#9CA3AF' }]}
            value={draft.label}
            onChangeText={v => onChange({ ...draft, label: v })}
            placeholder="Event name"
            placeholderTextColor="#9CA3AF"
          />
          <View style={card.metaRow}>
            <ConfidenceBadge confidence={draft.confidence} />
            {!draft.catId && (
              <View style={[badge.wrap, { backgroundColor: '#FEF3C7', marginLeft: 4 }]}>
                <Text style={[badge.txt, { color: '#92400E' }]}>uncategorized</Text>
              </View>
            )}
            {isMultiDay && (
              <Text style={card.multiDay}> · 2 segments</Text>
            )}
            {draft.meeting_url && (
              <View style={[badge.wrap, { backgroundColor: '#DBEAFE', marginLeft: 4 }]}>
                <Text style={[badge.txt, { color: '#1D4ED8' }]}>Meeting link detected</Text>
              </View>
            )}
          </View>
          <Text style={card.dateText}>
            {fmtDate(draft.startDate)} {draft.startTime} → {isMultiDay ? `${fmtDate(draft.endDate)} ` : ''}{draft.endTime}
          </Text>

          {/* Category pills */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={card.pillScroll}>
            {allCategories.map(c => (
              <Pressable
                key={c.id}
                onPress={() => onChange({ ...draft, catId: c.id })}
                style={[card.pill, draft.catId === c.id && { backgroundColor: c.color, borderColor: c.color }]}
              >
                <View style={[card.dot, { backgroundColor: c.color }]} />
                <Text style={[card.pillTxt, draft.catId === c.id && { color: '#fff' }]}>{c.label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Plan / Live toggle */}
          <View style={card.calRow}>
            <Pressable
              onPress={() => onChange({ ...draft, calendar: 'plan' })}
              style={[card.calBtn, draft.calendar === 'plan' && card.calPlan]}
            >
              <Text style={[card.calTxt, draft.calendar === 'plan' && { color: '#fff' }]}>Plan</Text>
            </Pressable>
            <Pressable
              onPress={() => onChange({ ...draft, calendar: 'actual' })}
              style={[card.calBtn, draft.calendar === 'actual' && card.calActual]}
            >
              <Text style={[card.calTxt, draft.calendar === 'actual' && { color: '#fff' }]}>Live</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const card = StyleSheet.create({
  wrap:      { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', padding: 12, marginBottom: 10 },
  disabled:  { opacity: 0.45, backgroundColor: '#F9FAFB' },
  row:       { flexDirection: 'row', gap: 10 },
  check:     { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#D1D5DB', marginTop: 2, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  checkOn:   { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  checkMark: { color: '#fff', fontSize: 13, fontWeight: '700', lineHeight: 16 },
  body:      { flex: 1, gap: 4 },
  label:     { fontSize: 14, fontWeight: '600', color: '#111827', borderBottomWidth: 1, borderBottomColor: '#E5E7EB', paddingBottom: 4, marginBottom: 2 },
  metaRow:   { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  multiDay:  { fontSize: 10, color: '#F59E0B', fontWeight: '600' },
  dateText:  { fontSize: 11, color: '#6B7280' },
  pillScroll:{ marginTop: 6 },
  pill:      { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: '#D1D5DB', marginRight: 6, backgroundColor: '#fff' },
  dot:       { width: 8, height: 8, borderRadius: 4 },
  pillTxt:   { fontSize: 11, color: '#4B5563', fontWeight: '500' },
  calRow:    { flexDirection: 'row', gap: 6, marginTop: 6 },
  calBtn:    { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: '#D1D5DB' },
  calPlan:   { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  calActual: { backgroundColor: '#059669', borderColor: '#059669' },
  calTxt:    { fontSize: 11, fontWeight: '600', color: '#6B7280' },
});

export default function ParseModal({ visible, initialText = '', onClose }) {
  const { events, categoryKeywords, llmSettings } = useContext(AppContext);
  const [rawText, setRawText] = useState(initialText);
  const [drafts, setDrafts] = useState(null);
  const [detecting, setDetecting] = useState(false);
  const allCategories = events.allCategories;
  const keywordMap = categoryKeywords?.keywordMap ?? {};
  const voice = useVoiceInput();
  const voiceBaseRef = useRef('');

  useEffect(() => {
    if (visible) {
      setRawText(initialText);
      setDrafts(null);
      if (initialText?.trim()) {
        runDetect(initialText);
      }
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live-append speech transcript into the text input while listening
  useEffect(() => {
    if (!voice.listening) return;
    const base = voiceBaseRef.current;
    setRawText(base + (base && voice.transcript ? ' ' : '') + voice.transcript);
  }, [voice.transcript, voice.listening]);

  function toggleMic() {
    if (voice.listening) { voice.stop(); return; }
    voiceBaseRef.current = rawText;
    voice.start();
  }

  async function runDetect(text) {
    setDetecting(true);
    const results = await parseEventText(text ?? rawText, llmSettings, keywordMap);
    setDetecting(false);
    setDrafts(results.map((r, i) => ({ ...r, id: i, calendar: 'plan', enabled: true })));
  }

  function toggleDraft(id) {
    setDrafts(prev => prev.map(d => d.id === id ? { ...d, enabled: !d.enabled } : d));
  }

  function updateDraft(updated) {
    setDrafts(prev => prev.map(d => d.id === updated.id ? updated : d));
  }

  function handleAdd() {
    const toAdd = (drafts ?? []).filter(d => d.enabled);
    for (const d of toAdd) {
      const segs = buildSegments(d.startDate, d.startTime, d.endDate, d.endTime);
      const cat = allCategories.find(c => c.id === d.catId);
      for (const seg of segs) {
        const date = new Date(seg.date + 'T00:00:00');
        events.addEvent({
          label:         d.label.trim() || 'Event',
          category:      d.catId,
          color:         cat?.color ?? '#6B7280',
          week_start:    getWeekStart(date),
          day_of_week:   date.getDay(),
          slot_start:    seg.slotStart,
          slot_duration: seg.slotDuration,
          precision:     0.5,
          calendar:      d.calendar,
          source:        'paste',
          is_all_day:    false,
          ...(d.meeting_url ? { meeting_url: d.meeting_url } : {}),
        });
      }
    }
    onClose();
  }

  const enabledCount = drafts ? drafts.filter(d => d.enabled).length : 0;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>
              {drafts === null
                ? 'Add Events from Text'
                : drafts.length === 0
                  ? 'No events detected'
                  : `${drafts.length} event${drafts.length !== 1 ? 's' : ''} detected`}
            </Text>
            <Pressable onPress={onClose} hitSlop={8} style={styles.closeBtn}>
              <Text style={styles.closeX}>×</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            {/* Step 1: Input */}
            {drafts === null && (
              <View style={styles.section}>
                <Text style={styles.hint}>
                  Paste any text containing dates and times. Works with shift schedules, emails, and messages.
                </Text>
                <View>
                  <TextInput
                    style={[styles.textarea, voice.supported && { paddingRight: 48 }]}
                    multiline
                    numberOfLines={7}
                    value={rawText}
                    onChangeText={setRawText}
                    placeholder={'Thursday June 18: 3B 2300 – 0700\nFriday June 19: 2A 1400 – 2200\n\nor: "team meeting on May 19th from 8am to 9pm"'}
                    placeholderTextColor="#9CA3AF"
                    textAlignVertical="top"
                    autoFocus
                  />
                  {voice.supported && (
                    <Pressable
                      onPress={toggleMic}
                      style={[styles.micBtn, voice.listening && styles.micBtnOn]}
                    >
                      <Text style={styles.micTxt}>🎤</Text>
                    </Pressable>
                  )}
                </View>
                {voice.listening && (
                  <Text style={styles.hint}>Listening… speak now.</Text>
                )}
                <View style={styles.btnRow}>
                  <Pressable onPress={onClose} style={styles.cancelBtn}>
                    <Text style={styles.cancelTxt}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => runDetect()}
                    disabled={!rawText.trim() || detecting}
                    style={[styles.detectBtn, (!rawText.trim() || detecting) && styles.btnDisabled]}
                  >
                    <Text style={styles.detectTxt}>{detecting ? 'Detecting…' : 'Detect events →'}</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* Step 2: No results */}
            {drafts !== null && drafts.length === 0 && (
              <View style={styles.section}>
                <Text style={styles.hint}>
                  No dates or times were found. Try rephrasing or check that the text contains a date.
                </Text>
                <Pressable onPress={() => setDrafts(null)} style={styles.backBtn}>
                  <Text style={styles.backTxt}>← Try again</Text>
                </Pressable>
              </View>
            )}

            {/* Step 2: Review cards */}
            {drafts !== null && drafts.length > 0 && (
              <View>
                {/* Select all / none */}
                <View style={styles.selectRow}>
                  <Pressable onPress={() => setDrafts(prev => prev.map(d => ({ ...d, enabled: true })))}>
                    <Text style={styles.selectAll}>Select all</Text>
                  </Pressable>
                  <Pressable onPress={() => setDrafts(prev => prev.map(d => ({ ...d, enabled: false })))}>
                    <Text style={styles.selectNone}>None</Text>
                  </Pressable>
                  <Pressable onPress={() => setDrafts(null)} style={{ marginLeft: 'auto' }}>
                    <Text style={styles.selectNone}>← Re-paste</Text>
                  </Pressable>
                </View>

                {drafts.map(d => (
                  <DraftCard
                    key={d.id}
                    draft={d}
                    allCategories={allCategories}
                    onChange={updateDraft}
                    onToggle={() => toggleDraft(d.id)}
                  />
                ))}

                <View style={[styles.btnRow, { marginTop: 4 }]}>
                  <Pressable onPress={onClose} style={styles.cancelBtn}>
                    <Text style={styles.cancelTxt}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleAdd}
                    disabled={enabledCount === 0}
                    style={[styles.detectBtn, enabledCount === 0 && styles.btnDisabled]}
                  >
                    <Text style={styles.detectTxt}>
                      Add {enabledCount} event{enabledCount !== 1 ? 's' : ''}
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#fff' },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 3, borderBottomColor: '#7C3AED' },
  title:        { fontSize: 15, fontWeight: '700', color: '#111827', flex: 1 },
  closeBtn:     { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#F3F4F6' },
  closeX:       { fontSize: 18, color: '#6B7280', lineHeight: 22 },
  scroll:       { flex: 1 },
  scrollContent:{ padding: 16, paddingBottom: 32 },
  section:      { gap: 12 },
  hint:         { fontSize: 13, color: '#6B7280', lineHeight: 19 },
  textarea:     { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, padding: 12, fontSize: 13, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', minHeight: 140, color: '#111827' },
  micBtn:       { position: 'absolute', bottom: 8, right: 8, width: 32, height: 32, borderRadius: 16, backgroundColor: '#7C3AED', alignItems: 'center', justifyContent: 'center' },
  micBtnOn:     { backgroundColor: '#EF4444' },
  micTxt:       { fontSize: 14 },
  btnRow:       { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
  cancelBtn:    { paddingHorizontal: 16, paddingVertical: 10 },
  cancelTxt:    { fontSize: 13, color: '#6B7280' },
  detectBtn:    { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: '#7C3AED' },
  detectTxt:    { fontSize: 13, fontWeight: '600', color: '#fff' },
  btnDisabled:  { opacity: 0.4 },
  backBtn:      { alignSelf: 'flex-start' },
  backTxt:      { fontSize: 13, color: '#7C3AED', fontWeight: '600' },
  selectRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  selectAll:    { fontSize: 12, color: '#7C3AED', fontWeight: '600' },
  selectNone:   { fontSize: 12, color: '#9CA3AF' },
});
