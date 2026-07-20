function zoneOffsetMinutes(timeZone, instant) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(instant);
    const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
    const asUtc = Date.UTC(
      Number(value.year), Number(value.month) - 1, Number(value.day),
      Number(value.hour), Number(value.minute), Number(value.second)
    );
    return Math.round((asUtc - instant.getTime()) / 60000);
  } catch {
    return 0;
  }
}

function formatMinutes(totalMinutes, military) {
  const minutes = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  if (military) return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return minute === 0
    ? `${displayHour} ${period}`
    : `${displayHour}:${String(minute).padStart(2, '0')} ${period}`;
}

/** Format a calendar slot in another zone relative to the primary wall clock. */
export function formatTimeZoneSlot(slot, precision, timeZone, primaryTimeZone, referenceDate, military = false) {
  const instant = new Date(`${referenceDate}T12:00:00Z`);
  const offsetDelta = zoneOffsetMinutes(timeZone, instant) - zoneOffsetMinutes(primaryTimeZone, instant);
  const slotMinutes = slot * (precision <= 0.5 ? 30 : 60);
  return formatMinutes(slotMinutes + offsetDelta, military);
}

/** Compact label for the fixed time-axis header (for example CDT or GMT+1). */
export function shortTimeZoneName(timeZone, referenceDate) {
  try {
    const name = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'short',
    }).formatToParts(new Date(`${referenceDate}T12:00:00Z`))
      .find(part => part.type === 'timeZoneName')?.value;
    return name || timeZone.split('/').pop().replace(/_/g, ' ');
  } catch {
    return timeZone;
  }
}
