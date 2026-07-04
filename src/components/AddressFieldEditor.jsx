import { useMemo, useState } from 'react';
import { generateId } from '../lib/utils.js';

const EMPTY_ADDRESS = {
  line1: '',
  line2: '',
  city: '',
  region: '',
  postalCode: '',
  country: '',
};

function normalizeAddress(value) {
  if (!value) return { ...EMPTY_ADDRESS };
  if (typeof value === 'string') return { ...EMPTY_ADDRESS, line1: value };
  return {
    line1: value.line1 ?? value.primary ?? value.address ?? '',
    line2: value.line2 ?? value.secondary ?? '',
    city: value.city ?? value.locality ?? '',
    region: value.region ?? value.stateProvince ?? value.state ?? value.province ?? '',
    postalCode: value.postalCode ?? value.zipCode ?? value.zip ?? '',
    country: value.country ?? '',
  };
}

function cleanAddress(value) {
  const a = normalizeAddress(value);
  return {
    line1: a.line1.trim(),
    line2: a.line2.trim(),
    city: a.city.trim(),
    region: a.region.trim(),
    postalCode: a.postalCode.trim(),
    country: a.country.trim(),
  };
}

function hasAddress(value) {
  const a = cleanAddress(value);
  return Object.values(a).some(Boolean);
}

function sameAddress(a, b) {
  return JSON.stringify(cleanAddress(a)) === JSON.stringify(cleanAddress(b));
}

function formatAddress(value) {
  const a = cleanAddress(value);
  const cityLine = [a.city, [a.region, a.postalCode].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  return [a.line1, a.line2, cityLine, a.country].filter(Boolean).join(', ');
}

function AddressInputs({ value, onChange, autoFocus = false }) {
  const draft = normalizeAddress(value);
  const set = (field, next) => onChange({ ...draft, [field]: next });
  const inputClass = 'w-full text-sm bg-gray-100 dark:bg-gray-700 rounded-lg px-2 py-1.5 text-gray-900 dark:text-white outline-none border border-gray-200 dark:border-gray-600 focus:border-blue-400 dark:focus:border-blue-500 placeholder-gray-400 dark:placeholder-gray-500';

  return (
    <div className="space-y-1.5">
      <input
        autoFocus={autoFocus}
        value={draft.line1}
        onChange={e => set('line1', e.target.value)}
        placeholder="Primary address"
        className={inputClass}
      />
      <input
        value={draft.line2}
        onChange={e => set('line2', e.target.value)}
        placeholder="Address line 2 (unit, apartment, suite)"
        className={inputClass}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        <input
          value={draft.city}
          onChange={e => set('city', e.target.value)}
          placeholder="City / locality"
          className={inputClass}
        />
        <input
          value={draft.region}
          onChange={e => set('region', e.target.value)}
          placeholder="State / province / region"
          className={inputClass}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        <input
          value={draft.postalCode}
          onChange={e => set('postalCode', e.target.value)}
          placeholder="ZIP / postal code"
          className={inputClass}
        />
        <input
          value={draft.country}
          onChange={e => set('country', e.target.value)}
          placeholder="Country"
          className={inputClass}
        />
      </div>
    </div>
  );
}

export function SingleAddressEditor({ value, onSave }) {
  const normalized = useMemo(() => normalizeAddress(value), [value]);
  const [draft, setDraft] = useState(normalized);

  const changed = !sameAddress(draft, value);
  return (
    <div className="space-y-1.5">
      <AddressInputs value={draft} onChange={setDraft} />
      <button
        type="button"
        disabled={!changed}
        onClick={() => onSave(cleanAddress(draft))}
        className="text-xs px-2.5 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-default text-white font-medium transition-colors"
      >Save</button>
    </div>
  );
}

export default function AddressFieldEditor({ items, onAdd, onEdit, onDelete }) {
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({ label: '', address: { ...EMPTY_ADDRESS } });
  const [pendingDelete, setPendingDelete] = useState(null);
  const [adding, setAdding] = useState(false);
  const [newDraft, setNewDraft] = useState({ label: '', address: { ...EMPTY_ADDRESS } });

  function startEdit(item) {
    setEditingId(item.id);
    setEditDraft({ label: item.label ?? '', address: normalizeAddress(item.address ?? item) });
    setPendingDelete(null);
    setAdding(false);
  }

  function startAdd() {
    setAdding(true);
    setNewDraft({ label: '', address: { ...EMPTY_ADDRESS } });
    setPendingDelete(null);
    setEditingId(null);
  }

  function commitAdd() {
    if (!newDraft.label.trim() || !hasAddress(newDraft.address)) return;
    onAdd({ id: generateId(), label: newDraft.label.trim(), address: cleanAddress(newDraft.address) });
    setNewDraft({ label: '', address: { ...EMPTY_ADDRESS } });
    setAdding(false);
  }

  function commitEdit(id) {
    if (!editDraft.label.trim() || !hasAddress(editDraft.address)) return;
    onEdit(id, editDraft.label.trim(), cleanAddress(editDraft.address));
    setEditingId(null);
  }

  return (
    <>
      {items.length === 0 && !adding && (
        <p className="text-[11px] text-gray-400 dark:text-gray-500">No saved addresses yet.</p>
      )}

      <div className="space-y-1">
        {items.map(item => {
          const isEditing = editingId === item.id;
          const isConfirming = pendingDelete === item.id;
          return (
            <div key={item.id} className="rounded-lg">
              {isEditing ? (
                <div className="space-y-1.5 py-1">
                  <input
                    autoFocus
                    value={editDraft.label}
                    onChange={e => setEditDraft(d => ({ ...d, label: e.target.value }))}
                    placeholder="Label (work, school, doctor)"
                    className="w-full text-sm bg-gray-100 dark:bg-gray-700 rounded-lg px-2 py-1.5 text-gray-900 dark:text-white outline-none border border-blue-400 dark:border-blue-500 placeholder-gray-400 dark:placeholder-gray-500"
                  />
                  <AddressInputs value={editDraft.address} onChange={address => setEditDraft(d => ({ ...d, address }))} />
                  <div className="flex gap-1.5">
                    <button type="button" onClick={() => setEditingId(null)}
                      className="flex-1 text-xs py-1 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Cancel</button>
                    <button type="button"
                      disabled={!editDraft.label.trim() || !hasAddress(editDraft.address)}
                      onClick={() => commitEdit(item.id)}
                      className="flex-1 text-xs py-1 rounded-lg bg-blue-500 hover:bg-blue-600 disabled:opacity-40 text-white font-medium transition-colors">Save</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-1.5 py-1">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 truncate">{item.label}</p>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate">{formatAddress(item.address ?? item)}</p>
                  </div>
                  {!isConfirming && (
                    <>
                      <button type="button"
                        onClick={() => startEdit(item)}
                        className="flex-shrink-0 h-6 px-2 flex items-center justify-center rounded text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-xs"
                        title="Edit">Edit</button>
                      <button type="button"
                        onClick={() => setPendingDelete(item.id)}
                        className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-base leading-none"
                        title="Delete">x</button>
                    </>
                  )}
                </div>
              )}
              {isConfirming && (
                <div className="flex items-center gap-2 pb-1.5">
                  <span className="text-xs text-red-500 dark:text-red-400 flex-1">Remove "{item.label}"?</span>
                  <button type="button" onClick={() => setPendingDelete(null)}
                    className="text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Cancel</button>
                  <button type="button"
                    onClick={() => { onDelete(item.id); setPendingDelete(null); }}
                    className="text-xs px-2 py-1 rounded bg-red-500 hover:bg-red-600 text-white font-medium transition-colors">Remove</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {adding ? (
        <div className="space-y-1.5 pt-1">
          <input
            autoFocus
            value={newDraft.label}
            onChange={e => setNewDraft(d => ({ ...d, label: e.target.value }))}
            placeholder="Label (work, school, doctor)"
            className="w-full text-sm bg-gray-100 dark:bg-gray-700 rounded-lg px-2 py-1.5 text-gray-900 dark:text-white outline-none border border-blue-400 dark:border-blue-500 placeholder-gray-400 dark:placeholder-gray-500"
          />
          <AddressInputs value={newDraft.address} onChange={address => setNewDraft(d => ({ ...d, address }))} />
          <div className="flex gap-1.5">
            <button type="button" onClick={() => setAdding(false)}
              className="flex-1 text-xs py-1 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Cancel</button>
            <button type="button"
              disabled={!newDraft.label.trim() || !hasAddress(newDraft.address)}
              onClick={commitAdd}
              className="flex-1 text-xs py-1 rounded-lg bg-blue-500 hover:bg-blue-600 disabled:opacity-40 text-white font-medium transition-colors">Add</button>
          </div>
        </div>
      ) : (
        <button type="button"
          onClick={startAdd}
          className="w-full text-left text-sm text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 px-1 py-1 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
          + Add address
        </button>
      )}
    </>
  );
}
