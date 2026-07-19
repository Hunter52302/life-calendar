import { buildSegments, dateToWeekData } from './calendarUtils.js';
import { generateId, generateRepeatInstances } from './utils.js';

export const REPEAT_TOTAL = { daily: 365, weekly: 52, biweekly: 26, monthly: 12, yearly: 3 };

export function draftSegmentCount(draft) {
  return buildSegments(draft.startDate, draft.startTime, draft.endDate, draft.endTime).length;
}

function draftExtras(draft) {
  return {
    ...(draft.meeting_url ? { meeting_url: draft.meeting_url } : {}),
    ...(draft.location ? { location: draft.location } : {}),
    ...(draft.people?.length ? { people: draft.people } : {}),
  };
}

export function draftToEvents(draft, allCategories = [], sharedSeriesId = null) {
  const category = draft.catId ?? null;
  const cat = allCategories.find(c => c.id === category);
  const segments = buildSegments(draft.startDate, draft.startTime, draft.endDate, draft.endTime);
  const extra = draftExtras(draft);
  const baseFor = segment => {
    const { week_start, day_of_week } = dateToWeekData(segment.date);
    return {
      label: draft.label.trim() || 'Event',
      category,
      color: cat?.color ?? '#6B7280',
      week_start,
      day_of_week,
      slot_start: segment.slotStart,
      slot_duration: segment.slotDuration,
      precision: 0.5,
      calendar: draft.calendar,
      source: 'paste',
      is_all_day: !!draft.allDay,
    };
  };

  // A range ending exactly at midnight has a different end date but only one
  // stored calendar segment. It can still repeat normally (for example
  // Monday 5 AM–12 AM business hours).
  if (draft.recurrence && segments.length === 1) {
    const seriesId = sharedSeriesId || generateId();
    return generateRepeatInstances(
      { ...baseFor(segments[0]), series_id: seriesId },
      draft.recurrence,
    ).map(event => ({ ...event, ...extra }));
  }

  return segments.map(segment => ({
    ...baseFor(segment),
    ...(sharedSeriesId ? { series_id: sharedSeriesId } : {}),
    ...extra,
  }));
}

export function draftsToEvents(drafts, allCategories = [], { groupAsSeries = false } = {}) {
  const enabled = drafts.filter(draft => draft.enabled);
  const sharedSeriesId = groupAsSeries && enabled.length ? generateId() : null;
  return enabled.flatMap(draft => draftToEvents(draft, allCategories, sharedSeriesId));
}

export function draftOccurrenceCount(draft) {
  const segments = draftSegmentCount(draft);
  return draft.recurrence && segments === 1
    ? (REPEAT_TOTAL[draft.recurrence] ?? 1)
    : segments;
}
