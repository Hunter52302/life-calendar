import { useState, useContext } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, ScrollView, Alert, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppContext } from '../context/AppContext.js';
import { generateId } from '../lib/utils.js';

const FIELD_COLORS = ['#7C3AED', '#3B82F6', '#22C55E', '#F59E0B', '#EF4444', '#14B8A6'];

function SectionHeader({ title }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

function Row({ label, value, onSave, placeholder, keyboardType = 'default', autoCapitalize = 'sentences', secureTextEntry = false }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  function save() {
    onSave(draft.trim());
    setEditing(false);
  }

  if (editing) {
    return (
      <View style={styles.rowEdit}>
        <Text style={styles.rowLabel}>{label}</Text>
        <TextInput
          style={styles.rowInput}
          value={draft}
          onChangeText={setDraft}
          autoFocus
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          secureTextEntry={secureTextEntry}
          returnKeyType="done"
          onSubmitEditing={save}
        />
        <View style={styles.rowActions}>
          <Pressable onPress={() => { setDraft(value); setEditing(false); }} style={styles.cancelBtn}>
            <Text style={styles.cancelBtnTxt}>Cancel</Text>
          </Pressable>
          <Pressable onPress={save} style={styles.saveBtn}>
            <Text style={styles.saveBtnTxt}>Save</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <Pressable style={styles.row} onPress={() => { setDraft(value); setEditing(true); }}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={value ? styles.rowValue : styles.rowPlaceholder} numberOfLines={1}>
        {value ? (secureTextEntry ? '••••••••' : value) : placeholder}
      </Text>
      <Text style={styles.editChevron}>›</Text>
    </Pressable>
  );
}

function BudgetRow({ cat, value, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value != null ? String(value) : '');

  function save() {
    const n = parseFloat(draft);
    if (draft.trim() === '') { onSave(null); }
    else if (!isNaN(n) && n >= 0) { onSave(n); }
    setEditing(false);
  }

  return (
    <View style={styles.budgetRow}>
      <View style={[styles.catDot, { backgroundColor: cat.color }]} />
      <Text style={styles.catName}>{cat.label}</Text>
      {editing ? (
        <>
          <TextInput
            style={styles.budgetInput}
            value={draft}
            onChangeText={setDraft}
            keyboardType="decimal-pad"
            autoFocus
            returnKeyType="done"
            onSubmitEditing={save}
            placeholder="hrs/wk"
            placeholderTextColor="#9CA3AF"
          />
          <Pressable onPress={save} style={styles.budgetSaveBtn}>
            <Text style={styles.budgetSaveTxt}>✓</Text>
          </Pressable>
        </>
      ) : (
        <Pressable onPress={() => { setDraft(value != null ? String(value) : ''); setEditing(true); }} style={styles.budgetValueWrap}>
          <Text style={value != null ? styles.budgetValue : styles.budgetPlaceholder}>
            {value != null ? `${value}h/wk` : 'Set target'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

export default function SettingsScreen() {
  const { auth, profile: profileData, budgets: budgetsData, assumeCompleted, setAssumeCompleted } = useContext(AppContext);
  const { profile, setProfile } = profileData;
  const { budgets, setBudget, deleteBudget } = budgetsData;
  const { events, llmSettings, setLlmSettings } = useContext(AppContext);
  const allCategories = events.allCategories;

  const LLM_PROVIDERS = [
    { id: 'none',      label: 'None' },
    { id: 'anthropic', label: 'Anthropic' },
    { id: 'openai',    label: 'OpenAI' },
    { id: 'custom',    label: 'Custom' },
  ];

  // Phone management
  const [addingPhone, setAddingPhone] = useState(false);
  const [newPhoneLabel, setNewPhoneLabel] = useState('');
  const [newPhoneNumber, setNewPhoneNumber] = useState('');

  // Address management
  const [addingAddr, setAddingAddr] = useState(false);
  const [newAddrLabel, setNewAddrLabel] = useState('');
  const [newAddrValue, setNewAddrValue] = useState('');

  function addPhone() {
    if (!newPhoneNumber.trim()) return;
    const updated = [...profile.phones, { id: generateId(), label: newPhoneLabel.trim() || 'Mobile', number: newPhoneNumber.trim() }];
    setProfile(p => ({ ...p, phones: updated }));
    setNewPhoneLabel(''); setNewPhoneNumber(''); setAddingPhone(false);
  }

  function deletePhone(id) {
    Alert.alert('Remove phone?', '', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => setProfile(p => ({ ...p, phones: p.phones.filter(ph => ph.id !== id) })) },
    ]);
  }

  function addAddress() {
    if (!newAddrValue.trim()) return;
    const updated = [...profile.otherAddresses, { id: generateId(), label: newAddrLabel.trim() || 'Other', address: newAddrValue.trim() }];
    setProfile(p => ({ ...p, otherAddresses: updated }));
    setNewAddrLabel(''); setNewAddrValue(''); setAddingAddr(false);
  }

  function deleteAddress(id) {
    Alert.alert('Remove address?', '', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => setProfile(p => ({ ...p, otherAddresses: p.otherAddresses.filter(a => a.id !== id) })) },
    ]);
  }

  function confirmLogout() {
    Alert.alert('Sign out?', 'You will need to sign in again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: auth.logout },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* ── Profile ── */}
        <SectionHeader title="Profile" />
        <View style={styles.card}>
          <Row label="Username"     value={profile.username}    onSave={v => setProfile(p => ({ ...p, username:    v }))} placeholder="Add username"     autoCapitalize="none" />
          <View style={styles.divider} />
          <Row label="Display Name" value={profile.displayName} onSave={v => setProfile(p => ({ ...p, displayName: v }))} placeholder="Add display name" />
          <View style={styles.divider} />
          <Row label="Email"        value={profile.email}       onSave={v => setProfile(p => ({ ...p, email:       v }))} placeholder="Add email"        keyboardType="email-address" autoCapitalize="none" />
          <View style={styles.divider} />
          <Row label="Birthday"     value={profile.birthday}    onSave={v => setProfile(p => ({ ...p, birthday:    v }))} placeholder="YYYY-MM-DD"       autoCapitalize="none" />
        </View>

        {/* ── Phone Numbers ── */}
        <View style={styles.sectionHeaderRow}>
          <SectionHeader title="Phone Numbers" />
          <Pressable onPress={() => setAddingPhone(v => !v)} style={styles.addChip}>
            <Text style={styles.addChipTxt}>{addingPhone ? '✕' : '+ Add'}</Text>
          </Pressable>
        </View>
        {addingPhone && (
          <View style={styles.addForm}>
            <TextInput style={styles.formInput} placeholder="Label (e.g. Mobile)" placeholderTextColor="#9CA3AF" value={newPhoneLabel} onChangeText={setNewPhoneLabel} />
            <TextInput style={styles.formInput} placeholder="Phone number" placeholderTextColor="#9CA3AF" value={newPhoneNumber} onChangeText={setNewPhoneNumber} keyboardType="phone-pad" returnKeyType="done" onSubmitEditing={addPhone} />
            <Pressable onPress={addPhone} style={[styles.saveBtn, !newPhoneNumber.trim() && styles.saveBtnDisabled]} disabled={!newPhoneNumber.trim()}>
              <Text style={styles.saveBtnTxt}>Save</Text>
            </Pressable>
          </View>
        )}
        {profile.phones.length > 0 && (
          <View style={styles.card}>
            {profile.phones.map((ph, i) => (
              <View key={ph.id}>
                {i > 0 && <View style={styles.divider} />}
                <View style={styles.listRow}>
                  <View style={styles.listInfo}>
                    <Text style={styles.listLabel}>{ph.label}</Text>
                    <Text style={styles.listValue}>{ph.number}</Text>
                  </View>
                  <Pressable onPress={() => deletePhone(ph.id)} hitSlop={8}>
                    <Text style={styles.deleteX}>✕</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ── Addresses ── */}
        <SectionHeader title="Home Address" />
        <View style={styles.card}>
          <Row label="Home" value={profile.homeAddress} onSave={v => setProfile(p => ({ ...p, homeAddress: v }))} placeholder="Add home address" />
        </View>

        <View style={styles.sectionHeaderRow}>
          <SectionHeader title="Other Addresses" />
          <Pressable onPress={() => setAddingAddr(v => !v)} style={styles.addChip}>
            <Text style={styles.addChipTxt}>{addingAddr ? '✕' : '+ Add'}</Text>
          </Pressable>
        </View>
        {addingAddr && (
          <View style={styles.addForm}>
            <TextInput style={styles.formInput} placeholder="Label (e.g. Office)" placeholderTextColor="#9CA3AF" value={newAddrLabel} onChangeText={setNewAddrLabel} />
            <TextInput style={styles.formInput} placeholder="Address" placeholderTextColor="#9CA3AF" value={newAddrValue} onChangeText={setNewAddrValue} returnKeyType="done" onSubmitEditing={addAddress} />
            <Pressable onPress={addAddress} style={[styles.saveBtn, !newAddrValue.trim() && styles.saveBtnDisabled]} disabled={!newAddrValue.trim()}>
              <Text style={styles.saveBtnTxt}>Save</Text>
            </Pressable>
          </View>
        )}
        {profile.otherAddresses.length > 0 && (
          <View style={styles.card}>
            {profile.otherAddresses.map((a, i) => (
              <View key={a.id}>
                {i > 0 && <View style={styles.divider} />}
                <View style={styles.listRow}>
                  <View style={styles.listInfo}>
                    <Text style={styles.listLabel}>{a.label}</Text>
                    <Text style={styles.listValue} numberOfLines={2}>{a.address}</Text>
                  </View>
                  <Pressable onPress={() => deleteAddress(a.id)} hitSlop={8}>
                    <Text style={styles.deleteX}>✕</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ── Time Budgets ── */}
        <SectionHeader title="Weekly Time Budgets" />
        <View style={styles.card}>
          <Text style={styles.budgetHint}>Set weekly hour targets for each category.</Text>
          {allCategories.map((cat, i) => (
            <View key={cat.id}>
              {i > 0 && <View style={styles.divider} />}
              <BudgetRow
                cat={cat}
                value={budgets[cat.id] ?? null}
                onSave={v => v != null ? setBudget(cat.id, v) : deleteBudget(cat.id)}
              />
            </View>
          ))}
        </View>

        {/* ── Live Calendar ── */}
        <SectionHeader title="Live Calendar" />
        <View style={styles.card}>
          <View style={styles.switchRow}>
            <View style={styles.switchInfo}>
              <Text style={styles.switchLabel}>Assume planned events happened</Text>
              <Text style={styles.switchHint}>
                When a planned event's time passes without you logging or editing it, Live automatically marks it done exactly as planned.
              </Text>
            </View>
            <Switch
              value={assumeCompleted}
              onValueChange={setAssumeCompleted}
              trackColor={{ false: '#D1D5DB', true: '#7C3AED' }}
              thumbColor="#fff"
            />
          </View>
          <View style={styles.divider} />
          <Text style={styles.switchWarning}>
            {assumeCompleted
              ? "You only need to open Live to fix things that didn't go to plan — everything else logs itself."
              : "Off: nothing logs automatically. You must confirm or edit every planned event yourself in Live, or it stays unlogged and won't count toward Reality stats."}
          </Text>
        </View>

        {/* ── AI Parsing ── */}
        <SectionHeader title="AI-Assisted Text/Voice Parsing" />
        <View style={styles.card}>
          <Text style={styles.llmHint}>
            By default, "Add Events from Text" uses a free, local, offline parser. Optionally connect your own LLM for smarter multi-event extraction and category guessing. Your text and API key are sent directly from this app to the provider you choose below — never through any third-party server.
          </Text>
          <View style={styles.divider} />
          <View style={styles.llmProviderRow}>
            {LLM_PROVIDERS.map(p => (
              <Pressable
                key={p.id}
                onPress={() => setLlmSettings(prev => ({ ...prev, provider: p.id }))}
                style={[styles.llmProviderBtn, llmSettings.provider === p.id && styles.llmProviderBtnOn]}
              >
                <Text style={[styles.llmProviderTxt, llmSettings.provider === p.id && styles.llmProviderTxtOn]}>
                  {p.label}
                </Text>
              </Pressable>
            ))}
          </View>
          {llmSettings.provider !== 'none' && (
            <>
              <View style={styles.divider} />
              <Row
                label="API Key"
                value={llmSettings.apiKey}
                onSave={v => setLlmSettings(prev => ({ ...prev, apiKey: v }))}
                placeholder="sk-..."
                autoCapitalize="none"
                secureTextEntry
              />
              {llmSettings.provider === 'custom' && (
                <Row
                  label="Endpoint URL"
                  value={llmSettings.endpoint}
                  onSave={v => setLlmSettings(prev => ({ ...prev, endpoint: v }))}
                  placeholder="http://localhost:11434/api/chat"
                  autoCapitalize="none"
                  keyboardType="url"
                />
              )}
              <Row
                label="Model"
                value={llmSettings.model}
                onSave={v => setLlmSettings(prev => ({ ...prev, model: v }))}
                placeholder={llmSettings.provider === 'anthropic' ? 'claude-3-5-haiku-latest' : llmSettings.provider === 'openai' ? 'gpt-4o-mini' : 'llama3.1'}
                autoCapitalize="none"
              />
              <View style={styles.divider} />
              <Text style={styles.switchWarning}>
                If the request ever fails (bad key, offline, etc.) parsing silently falls back to the local parser — it never blocks adding events.
              </Text>
            </>
          )}
        </View>

        {/* ── Account ── */}
        <SectionHeader title="Account" />
        <View style={styles.card}>
          <Pressable onPress={confirmLogout} style={styles.logoutRow}>
            <Text style={styles.logoutTxt}>Sign out</Text>
          </Pressable>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: '#F9FAFB' },
  header:          { paddingHorizontal: 20, paddingVertical: 14 },
  title:           { fontSize: 24, fontWeight: '700', color: '#111827' },
  content:         { paddingHorizontal: 16, paddingTop: 4 },

  sectionHeader:   { fontSize: 13, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 20, marginBottom: 6, marginLeft: 4 },
  sectionHeaderRow:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginRight: 4 },
  addChip:         { backgroundColor: '#7C3AED', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  addChipTxt:      { color: '#fff', fontSize: 12, fontWeight: '700' },

  card:            { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden' },
  divider:         { height: StyleSheet.hairlineWidth, backgroundColor: '#E5E7EB', marginLeft: 16 },

  row:             { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  rowEdit:         { paddingHorizontal: 16, paddingVertical: 12 },
  rowLabel:        { fontSize: 15, fontWeight: '600', color: '#111827', width: 110 },
  rowValue:        { flex: 1, fontSize: 15, color: '#374151' },
  rowPlaceholder:  { flex: 1, fontSize: 15, color: '#9CA3AF' },
  editChevron:     { fontSize: 18, color: '#D1D5DB', marginLeft: 4 },
  rowInput:        { borderWidth: 1, borderColor: '#7C3AED', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 15, color: '#111827', marginTop: 6 },
  rowActions:      { flexDirection: 'row', gap: 8, marginTop: 8, justifyContent: 'flex-end' },
  cancelBtn:       { paddingHorizontal: 12, paddingVertical: 6 },
  cancelBtnTxt:    { color: '#6B7280', fontSize: 14 },
  saveBtn:         { backgroundColor: '#7C3AED', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnTxt:      { color: '#fff', fontSize: 14, fontWeight: '700' },

  addForm:         { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#E5E7EB', padding: 14, marginBottom: 8 },
  formInput:       { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, padding: 11, fontSize: 15, color: '#111827', marginBottom: 10 },

  listRow:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  listInfo:        { flex: 1 },
  listLabel:       { fontSize: 12, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  listValue:       { fontSize: 15, color: '#111827' },
  deleteX:         { color: '#D1D5DB', fontSize: 16, paddingLeft: 12 },

  budgetHint:      { fontSize: 12, color: '#9CA3AF', marginBottom: 10, paddingHorizontal: 16, paddingTop: 12 },
  budgetRow:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  catDot:          { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  catName:         { flex: 1, fontSize: 15, fontWeight: '600', color: '#111827' },
  budgetInput:     { width: 80, borderWidth: 1, borderColor: '#7C3AED', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, fontSize: 14, color: '#111827', textAlign: 'right' },
  budgetSaveBtn:   { marginLeft: 8, backgroundColor: '#7C3AED', borderRadius: 8, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  budgetSaveTxt:   { color: '#fff', fontSize: 16, fontWeight: '700' },
  budgetValueWrap: { paddingVertical: 4, paddingHorizontal: 8 },
  budgetValue:     { fontSize: 14, fontWeight: '700', color: '#7C3AED' },
  budgetPlaceholder:{ fontSize: 14, color: '#9CA3AF' },

  logoutRow:       { paddingHorizontal: 16, paddingVertical: 16 },
  logoutTxt:       { fontSize: 16, color: '#EF4444', fontWeight: '600', textAlign: 'center' },

  switchRow:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  switchInfo:      { flex: 1 },
  switchLabel:     { fontSize: 15, fontWeight: '600', color: '#111827', marginBottom: 3 },
  switchHint:      { fontSize: 12, color: '#9CA3AF', lineHeight: 16 },
  switchWarning:   { fontSize: 12, color: '#B45309', lineHeight: 16, paddingHorizontal: 16, paddingVertical: 12 },

  llmHint:         { fontSize: 12, color: '#9CA3AF', lineHeight: 16, paddingHorizontal: 16, paddingVertical: 12 },
  llmProviderRow:  { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  llmProviderBtn:  { flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#D1D5DB', alignItems: 'center' },
  llmProviderBtnOn:{ backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  llmProviderTxt:  { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  llmProviderTxtOn:{ color: '#fff' },
});
