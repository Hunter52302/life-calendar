import { useState, useMemo, useEffect } from 'react';
import CalendarGrid from '../components/CalendarGrid';
import AddEventForm from '../components/AddEventForm';
import PrecisionToggle from '../components/PrecisionToggle';
import CategoriesMenu from '../components/CategoriesMenu';
import MonthGridView from './MonthGridView';
import MultiMonthView from './MultiMonthView';

const ALL_VIEWS = ['day', 'week', 'month', 'quarter', 'half', 'year'];
const OPTIONAL_VIEWS = new Set(['quarter', 'half']);
const VIEW_LABELS = { day: 'Day', week: 'Week', month: 'Month', quarter: 'Quarter', half: 'Half Year', year: 'Year' };
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function PlanView({
  events, weekStart, precision, onPrecisionChange, allCategories, militaryTime, enabledViews = [],
  showWeekNumbers = false, pinnedCategories = [], onTogglePin, onManageCategories,
  onAddEvent, onAddEvents, onUpdateEvent, onDeleteEvent, onUpdateCategory, onAddCategory, onNavigateToDate,
  jumpTo = null, mobileDefaultView = 'month',
}) {
  const [view, setView] = useState(() => window.innerWidth < 640 ? mobileDefaultView : 'week');
  const [activeDay, setActiveDay] = useState(new Date().getDay());
  const [formState, setFormState] = useState(null);
  const [viewDate, setViewDate] = useState(() => new Date(weekStart + 'T00:00:00'));
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [showViewMenu, setShowViewMenu] = useState(false);

  useEffect(() => { setViewDate(new Date(weekStart + 'T00:00:00')); }, [weekStart]);

  // Jump to a specific day when navigating from search results
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!jumpTo) return;
    setActiveDay(jumpTo.dayOfWeek);
    setView('day');
  }, [jumpTo?._id]);

  const filteredEvents = useMemo(() =>
    categoryFilter ? events.filter(e => e.category === categoryFilter) : events,
    [events, categoryFilter]
  );
  const weekEvents = useMemo(() => filteredEvents.filter(e => e.week_start === weekStart), [filteredEvents, weekStart]);
  const isMultiMonth = ['month', 'quarter', 'half', 'year'].includes(view);
  const visibleViews = ALL_VIEWS.filter(v => !OPTIONAL_VIEWS.has(v) || enabledViews.includes(v));

  function navigatePeriod(dir) {
    setViewDate(prev => {
      const d = new Date(prev);
      if (view === 'month') d.setMonth(d.getMonth() + dir);
      else if (view === 'quarter') d.setMonth(d.getMonth() + 3 * dir);
      else if (view === 'half') d.setMonth(d.getMonth() + 6 * dir);
      else if (view === 'year') d.setFullYear(d.getFullYear() + dir);
      return d;
    });
  }

  function getPeriodLabel() {
    const y = viewDate.getFullYear(), m = viewDate.getMonth();
    if (view === 'month') return `${MONTH_NAMES[m]} ${y}`;
    if (view === 'quarter') return `Q${Math.floor(m / 3) + 1} ${y}`;
    if (view === 'half') return `${m < 6 ? 'H1' : 'H2'} ${y}`;
    if (view === 'year') return `${y}`;
    return '';
  }

  function getMultiMonthStart() {
    const y = viewDate.getFullYear(), m = viewDate.getMonth();
    if (view === 'quarter') return { year: y, month: Math.floor(m / 3) * 3 };
    if (view === 'half') return { year: y, month: m < 6 ? 0 : 6 };
    return { year: y, month: 0 };
  }

  function handleDayClick(dateStr) {
    onNavigateToDate?.(dateStr);
    setActiveDay(new Date(dateStr + 'T00:00:00').getDay());
    setView('day');
  }
  function handleWeekClick(weekStartStr) {
    onNavigateToDate?.(weekStartStr);
    setView('week');
  }
  function handleMonthClick(year, month) {
    setViewDate(new Date(year, month, 1));
    setView('month');
  }
  function handleSlotClick(day, slot) { setFormState({ event: null, defaultDay: day, defaultSlot: slot }); }
  function handleAllDayClick(day) { setFormState({ event: null, defaultDay: day, defaultSlot: 0, allDay: true }); }
  function handleEventClick(event) { setFormState({ event, defaultDay: event.day_of_week, defaultSlot: event.slot_start }); }
  function handleSave(data) {
    if (data.id) onUpdateEvent(data.id, data);
    else onAddEvent({ ...data, calendar: 'plan' });
  }

  const multiStart = isMultiMonth && view !== 'month' ? getMultiMonthStart() : null;
  const monthCount = view === 'quarter' ? 3 : view === 'half' ? 6 : 12;

  return (
    <div className="flex flex-col h-full dark:bg-gray-900">
      <div className="relative flex flex-wrap items-center px-4 py-2 gap-y-1.5 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
        {/* Left: view switcher + precision (day/week only) */}
        <div className="flex items-center gap-2 flex-shrink-0 order-1">
          {/* Mobile/tablet: dropdown */}
          <div className="relative lg:hidden">
            <button
              type="button"
              onClick={() => setShowViewMenu(s => !s)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-sm font-semibold text-gray-900 dark:text-white"
            >
              {VIEW_LABELS[view]}
              <svg className={`w-3.5 h-3.5 text-gray-500 dark:text-gray-400 transition-transform ${showViewMenu ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showViewMenu && (
              <>
                <div className="fixed inset-0 z-[60]" onClick={() => setShowViewMenu(false)} />
                <div className="absolute left-0 top-full mt-1 w-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden z-[70]">
                  {visibleViews.map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => { setView(v); setShowViewMenu(false); }}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                        view === v
                          ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white font-semibold'
                          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      {VIEW_LABELS[v]}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          {/* Wide desktop: pills */}
          <div className="hidden lg:flex gap-1 rounded-lg bg-gray-100 dark:bg-gray-800 p-1">
            {visibleViews.map(v => (
              <button key={v} type="button" onClick={() => setView(v)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  view === v
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}>
                {VIEW_LABELS[v]}
              </button>
            ))}
          </div>
          {!isMultiMonth && <PrecisionToggle precision={precision} onChange={onPrecisionChange} />}
        </div>

        {/* Right: categories menu */}
        <div className="ml-auto flex-shrink-0 order-2">
          <CategoriesMenu
            allCategories={allCategories}
            pinnedCategories={pinnedCategories}
            onTogglePin={onTogglePin}
            onUpdateCategory={onUpdateCategory}
            categoryFilter={categoryFilter}
            onSetFilter={setCategoryFilter}
            onManage={onManageCategories}
          />
        </div>

        {/* Period navigator — own row on mobile/tablet, absolutely centered on wide screens */}
        {isMultiMonth && (
          <div className="w-full flex justify-center items-center gap-1 order-3 lg:order-none lg:w-auto lg:absolute lg:left-1/2 lg:-translate-x-1/2">
            <button onClick={() => navigatePeriod(-1)} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400">←</button>
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 min-w-32 text-center">{getPeriodLabel()}</span>
            <button onClick={() => navigatePeriod(1)} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400">→</button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-hidden overflow-x-auto">
        {(view === 'day' || view === 'week') && (
          <CalendarGrid
            events={weekEvents} weekStart={weekStart} precision={precision}
            view={view} activeDay={activeDay}
            onSlotClick={handleSlotClick} onAllDayClick={handleAllDayClick} onEventClick={handleEventClick}
            onDayHeaderClick={dayIndex => { setActiveDay(dayIndex); setView('day'); }}
            militaryTime={militaryTime}
          />
        )}
        {view === 'month' && (
          <MonthGridView
            year={viewDate.getFullYear()} month={viewDate.getMonth()}
            events={filteredEvents} allCategories={allCategories}
            onDayClick={handleDayClick} onWeekClick={handleWeekClick}
            showWeekNumbers={showWeekNumbers}
          />
        )}
        {(view === 'quarter' || view === 'half' || view === 'year') && multiStart && (
          <MultiMonthView startYear={multiStart.year} startMonth={multiStart.month} monthCount={monthCount} events={filteredEvents} allCategories={allCategories} onMonthClick={handleMonthClick} />
        )}
      </div>

      {formState !== null && (
        <AddEventForm
          event={formState.event} defaultDay={formState.defaultDay} defaultSlot={formState.defaultSlot}
          defaultAllDay={formState.allDay ?? false}
          calendar="plan" weekStart={weekStart} precision={precision}
          allCategories={allCategories} militaryTime={militaryTime}
          onSave={handleSave} onAddEvents={onAddEvents} onDelete={onDeleteEvent}
          onUpdateCategory={onUpdateCategory} onAddCategory={onAddCategory}
          onClose={() => setFormState(null)}
        />
      )}
    </div>
  );
}
