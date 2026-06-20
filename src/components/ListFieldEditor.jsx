import { useState } from 'react';

/**
 * Add/edit/delete UI for a list of { id, label, [valueKey] } entries —
 * shared by the profile section's "Other Addresses" and "Phone Numbers" lists.
 */
export default function ListFieldEditor({
  items, valueKey, labelPlaceholder, valuePlaceholder,
  emptyText, addButtonText, onAdd, onEdit, onDelete,
}) {
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({ label: '', [valueKey]: '' });
  const [pendingDelete, setPendingDelete] = useState(null);
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newValue, setNewValue] = useState('');

  function startEdit(item) {
    setEditingId(item.id);
    setEditDraft({ label: item.label, [valueKey]: item[valueKey] });
    setPendingDelete(null);
  }

  function saveEdit(id) {
    onEdit(id, editDraft.label.trim(), editDraft[valueKey].trim());
    setEditingId(null);
  }

  function startAdd() {
    setAdding(true); setNewLabel(''); setNewValue('');
    setPendingDelete(null); setEditingId(null);
  }

  function cancelAdd() {
    setAdding(false); setNewLabel(''); setNewValue('');
  }

  function commitAdd() {
    if (!newLabel.trim() || !newValue.trim()) return;
    onAdd(newLabel.trim(), newValue.trim());
    setNewLabel(''); setNewValue(''); setAdding(false);
  }

  return (
    <>
      {items.length === 0 && !adding && (
        <p className="text-[11px] text-gray-400 dark:text-gray-500">{emptyText}</p>
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
                    placeholder={labelPlaceholder}
                    className="w-full text-sm bg-gray-100 dark:bg-gray-700 rounded px-2 py-1 text-gray-900 dark:text-white outline-none border border-blue-400 dark:border-blue-500"
                  />
                  <input
                    value={editDraft[valueKey]}
                    onChange={e => setEditDraft(d => ({ ...d, [valueKey]: e.target.value }))}
                    placeholder={valuePlaceholder}
                    className="w-full text-sm bg-gray-100 dark:bg-gray-700 rounded px-2 py-1 text-gray-900 dark:text-white outline-none border border-gray-200 dark:border-gray-600 focus:border-blue-400 dark:focus:border-blue-500"
                  />
                  <div className="flex gap-1.5">
                    <button type="button" onClick={() => setEditingId(null)}
                      className="flex-1 text-xs py-1 rounded border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Cancel</button>
                    <button type="button"
                      disabled={!editDraft.label.trim() || !editDraft[valueKey].trim()}
                      onClick={() => saveEdit(item.id)}
                      className="flex-1 text-xs py-1 rounded bg-blue-500 hover:bg-blue-600 disabled:opacity-40 text-white font-medium transition-colors">Save</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-1.5 py-1">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 truncate">{item.label}</p>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate">{item[valueKey]}</p>
                  </div>
                  {!isConfirming && (
                    <>
                      <button type="button"
                        onClick={() => startEdit(item)}
                        className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded text-gray-300 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm"
                        title="Edit">✏</button>
                      <button type="button"
                        onClick={() => setPendingDelete(item.id)}
                        className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-base leading-none"
                        title="Delete">×</button>
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
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            placeholder={labelPlaceholder}
            className="w-full text-sm bg-gray-100 dark:bg-gray-700 rounded-lg px-2 py-1.5 text-gray-900 dark:text-white outline-none border border-blue-400 dark:border-blue-500 placeholder-gray-400 dark:placeholder-gray-500"
          />
          <input
            value={newValue}
            onChange={e => setNewValue(e.target.value)}
            placeholder={valuePlaceholder}
            className="w-full text-sm bg-gray-100 dark:bg-gray-700 rounded-lg px-2 py-1.5 text-gray-900 dark:text-white outline-none border border-gray-200 dark:border-gray-600 focus:border-blue-400 dark:focus:border-blue-500 placeholder-gray-400 dark:placeholder-gray-500"
            onKeyDown={e => {
              if (e.key === 'Enter') commitAdd();
              if (e.key === 'Escape') cancelAdd();
            }}
          />
          <div className="flex gap-1.5">
            <button type="button" onClick={cancelAdd}
              className="flex-1 text-xs py-1 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Cancel</button>
            <button type="button"
              disabled={!newLabel.trim() || !newValue.trim()}
              onClick={commitAdd}
              className="flex-1 text-xs py-1 rounded-lg bg-blue-500 hover:bg-blue-600 disabled:opacity-40 text-white font-medium transition-colors">Add</button>
          </div>
        </div>
      ) : (
        <button type="button"
          onClick={startAdd}
          className="w-full text-left text-sm text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 px-1 py-1 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
          {addButtonText}
        </button>
      )}
    </>
  );
}
