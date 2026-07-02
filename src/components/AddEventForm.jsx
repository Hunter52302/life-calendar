import { useState } from 'react';
import { DAYS_FULL } from '../lib/constants';
import { hoursToLabel, generateRepeatInstances } from '../lib/utils';
import MapProviderPicker from './MapProviderPicker.jsx';
import EventActionButtons from './EventActionButtons.jsx';
import { isLikelyUrl, openExternalUrl } from '../lib/handoffActions.js';
import EventTitleSuggestInput from './EventTitleSuggestInput.jsx';

// Convert a slot index to "HH:MM" string for <input type="time">
function slotToHHMM(slot, formPrecision) {
  const mins = slot * (formPrecision === 1 ? 60 : 30);
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Convert "HH:MM" string back to a slot index (snaps to nearest slot)
function hhmmToSlot(hhmm, formPrecision) {
  if (!hhmm) return 0;
  const [h, m] = hhmm.split(':').map(Number);
  const totalMins = (h || 0) * 60 + (m || 0);
  const slotMins = formPrecision === 1 ? 60 : 30;
  return Math.round(totalMins / slotMins);
}

const REPEAT_OPTIONS = [
  { value: 'none', label: 'Does not repeat' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

const COLOR_SWATCHES = [
  '#3B82F6', '#0EA5E9', '#06B6D4', '#22C55E',
  '#84CC16', '#F59E0B', '#F97316', '#EF4444',
  '#E11D48', '#EC4899', '#A855F7', '#8B5CF6',
  '#6B7280', '#14B8A6', '#2563EB', '#16A34A',
];

export default function AddEventForm({
  event,
  templateEvent,
  defaultDay,
  defaultSlot,
  defaultAllDay = false,
  calendar,
  weekStart,
  precision,
  allCategories,
  homeAddress = '',
  savedAddresses = [],
  eventTitleSuggestions = [],
  onSave,
  onAddEvents,
  onDelete,
  onUpdateCategory,
  onAddCategory,
  onClose,
}) {
  const isEditing = !!event;
  const source = event || templateEvent;
  const isActualMode = !!templateEvent;
  const formPrecision = source?.precision ?? precision;
  const slotCount = formPrecision === 1 ? 24 : 48;

  const [label, setLabel]       = useState(source?.label ?? '');
  const [category, setCategory] = useState(source?.category ?? allCategories[0]?.id ?? 'sleep');
  const [days, setDays]         = useState([source?.day_of_week ?? defaultDay ?? 0]);
  const [isAllDay, setIsAllDay] = useState(source?.is_all_day ?? defaultAllDay ?? false);
  const [slotStart, setSlotStart] = useState(source?.slot_start ?? defaultSlot ?? 8);
  const initDuration = source?.slot_duration ?? (formPrecision === 1 ? 1 : 2);
  const initStart    = source?.slot_start ?? defaultSlot ?? 8;
  const [slotEnd, setSlotEnd]   = useState(Math.min(initStart + initDuration, slotCount * 2));
  const [repeat, setRepeat]     = useState('none');

  // User-triggered handoff fields
  const [location, setLocation] = useState(source?.location ?? '');
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  const [meetingUrl, setMeetingUrl] = useState(source?.meeting_url ?? '');
  const [travelBufferMinutes, setTravelBufferMinutes] = useState(source?.travel_buffer_minutes ?? 0);
  const firstPerson = Array.isArray(source?.people) ? source.people[0] : null;
  const [personName, setPersonName] = useState(firstPerson?.displayName ?? '');
  const [personPhone, setPersonPhone] = useState(firstPerson?.phone ?? '');
  const [personEmail, setPersonEmail] = useState(firstPerson?.email ?? '');

  function applyTravelBuffer() {
    const minutes = Number(travelBufferMinutes) || 0;
    if (minutes <= 0) return;
    const slotsToSubtract = Math.ceil(minutes / (formPrecision === 1 ? 60 : 30));
    const duration = Math.max(1, slotEnd - slotStart);
    const newStart = Math.max(0, slotStart - slotsToSubtract);
    setSlotStart(newStart);
    setSlotEnd(newStart + duration);
  }

  // Category editing state
  const [categoryMode, setCategoryMode] = useState(null);
  const [editLabel, setEditLabel]       = useState('');
  const [editColor, setEditColor]       = useState(COLOR_SWATCHES[0]);

  const selectedCategory = allCategories.find(c => c.id === category);
  const slotDuration = Math.max(1, slotEnd - slotStart);

  function toggleDay(i) {
    setDays(prev =>
      prev.includes(i)
        ? prev.length > 1 ? prev.filter(d => d !== i) : prev
        : [...prev, i].sort((a, b) => a - b)
    );
  }

  function handleSave() {
    if (!label.trim()) return;
    const people = personName.trim() || personPhone.trim() || personEmail.trim()
      ? [{
          displayName: personName.trim(),
          phone: personPhone.trim(),
          email: personEmail.trim(),
          source: 'manual',
        }]
      : [];
    const makeBase = (dayIndex) => ({
      label: label.trim(),
      category,
      color: selectedCategory?.color ?? '#6B7280',
      day_of_week: dayIndex,
      week_start: weekStart,
      precision: formPrecision,
      calendar,
      source: 'manual',
      ...(location.trim() ? { location: location.trim() } : {}),
      ...(meetingUrl.trim() ? { meeting_url: meetingUrl.trim() } : {}),
      ...(Number(travelBufferMinutes) > 0 ? { travel_buffer_minutes: Number(travelBufferMinutes) } : {}),
      ...(people.length ? { people } : {}),
      ...(isAllDay
        ? { is_all_day: true, slot_start: 0, slot_duration: 1 }
        : { slot_start: slotStart, slot_duration: slotDuration }
      ),
    });
    if (isEditing) {
      onSave({ id: event.id, ...makeBase(days[0]) });
    } else if (repeat !== 'none') {
      onAddEvents(days.flatMap(d => generateRepeatInstances(makeBase(d), repeat)));
    } else if (days.length > 1) {
      onAddEvents(days.map(d => makeBase(d)));
    } else {
      onSave(makeBase(days[0]));
    }
    onClose();
  }

  function openEditCategory(cat) {
    setCategoryMode({ type: 'edit', id: cat.id });
    setEditLabel(cat.label);
    setEditColor(cat.color);
  }

  function openAddCategory() {
    setCategoryMode({ type: 'add' });
    setEditLabel('');
    setEditColor(COLOR_SWATCHES[0]);
  }

  function handleSaveCategory() {
    if (!editLabel.trim()) return;
    if (categoryMode.type === 'add') {
      onAddCategory?.({ label: editLabel.trim(), color: editColor });
    } else {
      onUpdateCategory?.(categoryMode.id, { label: editLabel.trim(), color: editColor });
    }
    setCategoryMode(null);
  }

  // startOptions / sameDayEndOptions / nextDayEndOptions removed; inputs handle time.

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4 pb-safe-4 sm:pb-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {isActualMode ? 'Set Actual' : isEditing ? 'Edit Event' : 'Add Event'}
          </h2>
          <button type="button" onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none">
            x
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Label */}
          <div>
            <label className="block text-xs font-medium text-gray-400 dark:text-gray-500 mb-1 uppercase tracking-wider">Label</label>
            <EventTitleSuggestInput
              value={label}
              onChange={setLabel}
              suggestions={eventTitleSuggestions}
              placeholder="e.g. Sleep, Deep work..."
              autoFocus
              onEnter={() => handleSave()}
              className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Category */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Category</label>
              {categoryMode && (
                <button type="button" onClick={() => setCategoryMode(null)} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">Back</button>
              )}
            </div>

            {!categoryMode ? (
              <div className="grid grid-cols-2 gap-1.5">
                {allCategories.map(cat => (
                  <div key={cat.id} className="relative group">
                    <button type="button" onClick={() => setCategory(c => c === cat.id ? null : cat.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all text-left pr-7 ${
                        category === cat.id ? 'font-medium' : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500'
                      }`}
                      style={category === cat.id ? { color: cat.color, borderColor: cat.color, backgroundColor: cat.color + '18' } : {}}>
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                      <span className="truncate">{cat.label}</span>
                    </button>
                    <button type="button" onClick={e => { e.stopPropagation(); openEditCategory(cat); }}
                      className="absolute top-1/2 right-1.5 -translate-y-1/2 opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 transition-opacity text-xs"
                      title="Edit category">Edit</button>
                  </div>
                ))}
                <button type="button" onClick={openAddCategory}
                  className="col-span-2 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 text-sm text-gray-500 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
                  <span className="text-base leading-none">+</span> Add more categories
                </button>
              </div>
            ) : (
              <div className="space-y-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  {categoryMode.type === 'add' ? 'New category' : 'Edit category'}
                </p>
                <input type="text" value={editLabel} onChange={e => setEditLabel(e.target.value)}
                  placeholder="Category name..."
                  className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus />
                <div className="flex flex-wrap gap-1.5">
                  {COLOR_SWATCHES.map(color => (
                    <button key={color} type="button" onClick={() => setEditColor(color)}
                      className={`w-6 h-6 rounded-full border-2 transition-all ${editColor === color ? 'border-gray-700 dark:border-white scale-110' : 'border-transparent hover:border-gray-300 dark:hover:border-gray-400'}`}
                      style={{ backgroundColor: color }} />
                  ))}
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setCategoryMode(null)}
                    className="flex-1 py-2 text-sm text-gray-500 dark:text-gray-400 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">Cancel</button>
                  <button type="button" onClick={handleSaveCategory} disabled={!editLabel.trim()}
                    className="flex-1 py-2 text-sm bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg hover:bg-gray-700 dark:hover:bg-white disabled:opacity-40 font-medium transition-colors">
                    {categoryMode.type === 'add' ? 'Add' : 'Save'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Day */}
          <div>
            <label className="block text-xs font-medium text-gray-400 dark:text-gray-500 mb-2 uppercase tracking-wider">Day</label>
            <div className="flex gap-1">
              {DAYS_FULL.map((d, i) => (
                <button key={i} type="button"
                  onClick={() => (isEditing || isActualMode) ? setDays([i]) : toggleDay(i)}
                  className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    days.includes(i)
                      ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}>
                  {d[0]}
                </button>
              ))}
            </div>
          </div>

          {/* All day toggle */}
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">All day</span>
            <button type="button" role="switch" aria-checked={isAllDay} onClick={() => setIsAllDay(v => !v)}
              className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${isAllDay ? 'bg-blue-500' : 'bg-gray-200 dark:bg-gray-600'}`}>
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isAllDay ? 'translate-x-4' : ''}`} />
            </button>
          </label>

          {/* Start + End + Duration */}
          {!isAllDay && (
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-400 dark:text-gray-500 mb-1 uppercase tracking-wider">Start</label>
                <input
                  type="time"
                  value={slotToHHMM(slotStart, formPrecision)}
                  step={formPrecision === 1 ? 3600 : 1800}
                  onChange={e => {
                    if (!e.target.value) return;
                    const newSlot = hhmmToSlot(e.target.value, formPrecision);
                    setSlotStart(newSlot);
                    if (slotEnd <= newSlot) setSlotEnd(newSlot + 1);
                  }}
                  className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-400 dark:text-gray-500 mb-1 uppercase tracking-wider">
                  End
                  {slotEnd >= slotCount && (
                    <span className="ml-1 text-[10px] text-amber-500 normal-case">+1 day</span>
                  )}
                </label>
                <input
                  type="time"
                  value={slotToHHMM(slotEnd, formPrecision)}
                  step={formPrecision === 1 ? 3600 : 1800}
                  onChange={e => {
                    if (!e.target.value) return;
                    let newSlot = hhmmToSlot(e.target.value, formPrecision);
                    // If end time is earlier or equal to start, treat it as next day
                    if (newSlot <= slotStart) newSlot += slotCount;
                    setSlotEnd(newSlot);
                  }}
                  className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex-shrink-0">
                <label className="block text-xs font-medium text-gray-400 dark:text-gray-500 mb-1 uppercase tracking-wider">Duration</label>
                <div className="border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  {hoursToLabel(slotDuration * formPrecision)}
                </div>
              </div>
            </div>
          )}

          {/* Location */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Location</label>

            {/* Location input row */}
            <div className="flex gap-2">
              <input
                type="text"
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="Address or place name"
                className="flex-1 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {/* Open in Maps button */}
              {location.trim() && (
                <button type="button" onClick={() => setMapPickerOpen(true)}
                  title="Open in Maps"
                  className="flex-shrink-0 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors text-sm">
                  Open in Maps
                  x
                </button>
              )}
            </div>

            {/* Saved address quick-fill */}
            {(homeAddress || savedAddresses.length > 0) && (
              <div className="flex flex-wrap gap-1.5">
                {homeAddress && (
                  <button type="button" onClick={() => setLocation(homeAddress)}
                    className="text-[11px] px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors truncate max-w-[140px]"
                    title={homeAddress}>
                    Saved address: Home
                  </button>
                )}
                {savedAddresses.map(addr => (
                  <button key={addr.id} type="button" onClick={() => setLocation(addr.address)}
                    className="text-[11px] px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors truncate max-w-[140px]"
                    title={addr.address}>
                    Saved address: {addr.label}
                  </button>
                ))}
              </div>
            )}

            <p className="text-[11px] text-gray-400 dark:text-gray-500">Maps opens only after you choose a provider.</p>

          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Travel buffer</label>
            <p className="text-[11px] text-gray-400 dark:text-gray-500">Manual time blocked before event. No route lookup.</p>
            <div className="flex flex-wrap gap-1.5">
              {[0, 15, 30, 45, 60].map(minutes => (
                <button
                  key={minutes}
                  type="button"
                  onClick={() => setTravelBufferMinutes(minutes)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs border transition-colors ${
                    Number(travelBufferMinutes) === minutes
                      ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 border-gray-900 dark:border-gray-100'
                      : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  {minutes === 0 ? 'None' : `${minutes} min`}
                </button>
              ))}
              <input
                type="number"
                min="0"
                value={[0, 15, 30, 45, 60].includes(Number(travelBufferMinutes)) ? '' : travelBufferMinutes}
                onChange={e => setTravelBufferMinutes(Math.max(0, Number(e.target.value) || 0))}
                placeholder="Custom"
                className="w-24 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {!isAllDay && Number(travelBufferMinutes) > 0 && (
              <div className="space-y-1">
                <button type="button" onClick={applyTravelBuffer}
                  className="w-full py-2 rounded-lg border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-sm font-medium hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors">
                  Apply buffer to start time
                </button>
                <p className="text-[11px] text-gray-400 dark:text-gray-500">Moves this event earlier by the selected buffer.</p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Meeting link</label>
            <div className="flex gap-2">
              <input
                type="url"
                value={meetingUrl}
                onChange={e => setMeetingUrl(e.target.value)}
                placeholder="https://zoom.us/j/..."
                className="flex-1 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {isLikelyUrl(meetingUrl) && (
                <button type="button" onClick={() => openExternalUrl(meetingUrl.trim())}
                  className="flex-shrink-0 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors text-sm">
                  Open meeting link
                </button>
              )}
            </div>
            <p className="text-[11px] text-gray-400 dark:text-gray-500">Links open only after you tap.</p>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Person</label>
            <input type="text" value={personName} onChange={e => setPersonName(e.target.value)}
              placeholder="Name"
              className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <div className="flex gap-2">
              <input type="tel" value={personPhone} onChange={e => setPersonPhone(e.target.value)}
                placeholder="Phone"
                className="flex-1 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input type="email" value={personEmail} onChange={e => setPersonEmail(e.target.value)}
                placeholder="Email"
                className="flex-1 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          {isEditing && (
            <EventActionButtons event={{
              ...event,
              location,
              meeting_url: meetingUrl,
              people: personName.trim() || personPhone.trim() || personEmail.trim()
                ? [{ displayName: personName.trim(), phone: personPhone.trim(), email: personEmail.trim(), source: 'manual' }]
                : [],
            }} />
          )}

          {/* Repeat */}
          {!isEditing && !isActualMode && (
            <div>
              <label className="block text-xs font-medium text-gray-400 dark:text-gray-500 mb-1 uppercase tracking-wider">Repeat</label>
              <select value={repeat} onChange={e => setRepeat(e.target.value)}
                className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {REPEAT_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
          )}
        </div>

        <MapProviderPicker
          open={mapPickerOpen}
          destination={location}
          onClose={() => setMapPickerOpen(false)}
        />

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100 dark:border-gray-700 sticky bottom-0 bg-white dark:bg-gray-800">
          {isEditing ? (
            <button type="button" onClick={() => { onDelete(event.id); onClose(); }}
              className="text-sm text-red-500 hover:text-red-600 font-medium transition-colors">
              {event?.plan_event_id ? 'Remove actual' : 'Delete'}
            </button>
          ) : <div />}
          <div className="flex gap-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              Cancel
            </button>
            <button type="button" onClick={handleSave} disabled={!label.trim()}
              className="px-4 py-2 text-sm bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg hover:bg-gray-700 dark:hover:bg-white font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              {isEditing ? 'Save changes' : 'Add event'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}



