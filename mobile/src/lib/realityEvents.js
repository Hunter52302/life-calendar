export function getRealityWeekEvents(allEvents, linkedCalendars, weekStart, calendar) {
  const excludedCalendarIds = new Set(
    linkedCalendars.filter(linked => linked.excludeFromReality).map(linked => linked.id)
  );

  return allEvents.filter(event =>
    event.calendar === calendar &&
    event.week_start === weekStart &&
    !excludedCalendarIds.has(event.source_calendar_id)
  );
}

export function countImportedCalendarEvents(allEvents, calendarId) {
  return allEvents.filter(event =>
    event.source_calendar_id === calendarId && event.source !== 'auto-completed'
  ).length;
}
