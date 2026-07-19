function calendarId(value) {
  return value == null ? '' : String(value);
}
function eventFingerprint(event) {
  return [
    event?.label ?? '',
    event?.category ?? '',
    event?.week_start ?? '',
    event?.day_of_week ?? '',
    event?.slot_start ?? '',
    event?.slot_duration ?? '',
    event?.precision ?? '',
  ].join('|');
}

/**
 * Remove events owned by calendars marked "Skip SYL".
 *
 * New records carry source_calendar_id directly. Older auto-completed Live
 * records may only point at their Plan parent, or may have lost both pieces of
 * lineage. The parent lookup and narrow auto-completed fingerprint fallback
 * keep those legacy copies from inflating See Your Life totals.
 */
export function filterRealityEvents(planEvents = [], actualEvents = [], linkedCalendars = []) {
  const excludedIds = new Set(
    linkedCalendars
      .filter(calendar => calendar.excludeFromReality === true || calendar.exclude_from_reality === true)
      .map(calendar => calendarId(calendar.id ?? calendar.calendar_id))
      .filter(Boolean)
  );

  if (excludedIds.size === 0) return { planEvents, actualEvents };

  const planById = new Map(planEvents.map(event => [calendarId(event.id), event]));
  const excludedPlanFingerprints = new Set();

  const filteredPlan = planEvents.filter(event => {
    const excluded = excludedIds.has(calendarId(event.source_calendar_id));
    if (excluded) excludedPlanFingerprints.add(eventFingerprint(event));
    return !excluded;
  });

  const filteredActual = actualEvents.filter(event => {
    if (excludedIds.has(calendarId(event.source_calendar_id))) return false;

    const parent = planById.get(calendarId(event.plan_event_id));
    if (parent && excludedIds.has(calendarId(parent.source_calendar_id))) return false;

    return !(
      event.source === 'auto-completed' &&
      excludedPlanFingerprints.has(eventFingerprint(event))
    );
  });

  return { planEvents: filteredPlan, actualEvents: filteredActual };
}
