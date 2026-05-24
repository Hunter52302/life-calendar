import { addDays } from './utils';

function eventDate(e) {
  return addDays(e.week_start, e.day_of_week);
}

export function computeDiff(planEvents, actualEvents, allCategories) {
  const result = { byCategory: {}, byDay: {} };

  for (const cat of allCategories) {
    const planned = sumHours(planEvents, cat.id);
    const actual = sumHours(actualEvents, cat.id);
    if (planned > 0 || actual > 0) {
      result.byCategory[cat.id] = { category: cat, planned, actual, delta: actual - planned };
    }
  }

  const planByDate = groupByDate(planEvents);
  const actualByDate = groupByDate(actualEvents);
  const allDates = new Set([...Object.keys(planByDate), ...Object.keys(actualByDate)]);

  for (const dateStr of allDates) {
    result.byDay[dateStr] = {};
    const dayPlan = planByDate[dateStr] || [];
    const dayActual = actualByDate[dateStr] || [];
    for (const cat of allCategories) {
      const planned = sumHours(dayPlan, cat.id);
      const actual = sumHours(dayActual, cat.id);
      if (planned > 0 || actual > 0) {
        result.byDay[dateStr][cat.id] = { category: cat, planned, actual, delta: actual - planned };
      }
    }
  }

  return result;
}

function groupByDate(events) {
  const map = {};
  for (const e of events) {
    const d = eventDate(e);
    if (!map[d]) map[d] = [];
    map[d].push(e);
  }
  return map;
}

function sumHours(events, categoryId) {
  return events
    .filter(e => e.category === categoryId && !e.is_all_day)
    .reduce((sum, e) => sum + e.slot_duration * e.precision, 0);
}
