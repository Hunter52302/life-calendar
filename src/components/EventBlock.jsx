import { SLOT_HEIGHT } from '../lib/constants';
import { hoursToLabel } from '../lib/utils';

export default function EventBlock({ event, gridPrecision, onClick, onDragStart }) {
  const slotCount = gridPrecision <= 0.5 ? 48 : 24;
  const displayStart = Math.round((event.slot_start * event.precision) / gridPrecision);
  const displayDuration = Math.max(1, Math.round((event.slot_duration * event.precision) / gridPrecision));
  const isGhost = !!event._isGhost;
  const isContinuation = !!event._isContinuation;
  const overflowContinues = !!event._overflowContinues;
  const isDragPreview = !!event._isDragPreview;
  const draggable = !isGhost && !isContinuation && !!onDragStart;

  // Drag tracking lives in CalendarGrid (via window-level pointer listeners) rather than
  // on this element, because a cross-day drag re-parents this block into a different day
  // column's children, which unmounts/remounts it and would silently drop pointer capture.
  function handlePointerDown(e) {
    if (!draggable || (e.button !== undefined && e.button !== 0)) return;
    e.stopPropagation();
    onDragStart(event, e.pointerId, e.clientX, e.clientY);
  }

  // Use the stored total hours if present (for split overnight events), else compute normally
  const totalHours = event._totalHours ?? (event.slot_duration * event.precision);

  // Horizontal column layout for overlapping events
  const col = event._col ?? 0;
  const colCount = event._colCount ?? 1;
  const leftEdge  = colCount > 1 ? `calc(${(col / colCount) * 100}% + 2px)`             : 2;
  const rightEdge = colCount > 1 ? `calc(${((colCount - col - 1) / colCount) * 100}% + 2px)` : 2;

  // Safety cap — shouldn't trigger after CalendarGrid expansion, but just in case
  const clampedDuration = Math.min(displayDuration, slotCount - displayStart);

  // Visual connection between the two halves:
  //   main block (overflowContinues) → squared bottom corners, flush to day edge
  //   continuation block              → squared top corners, flush to day top
  const borderRadius = isContinuation
    ? '0 0 4px 4px'
    : overflowContinues
      ? '4px 4px 0 0'
      : 4;

  // Overflow block fills to the very bottom; continuation starts flush at the top
  const top = isContinuation ? 0 : displayStart * SLOT_HEIGHT + 1;
  const height = overflowContinues
    ? clampedDuration * SLOT_HEIGHT        // flush to bottom border
    : clampedDuration * SLOT_HEIGHT - 2;   // normal 1px gap top + bottom

  return (
    <div
      style={{
        position: 'absolute',
        top,
        height,
        left: leftEdge,
        right: rightEdge,
        backgroundColor: event.color,
        borderRadius,
        overflow: 'hidden',
        cursor: draggable ? 'grab' : 'pointer',
        touchAction: draggable ? 'none' : undefined,
        zIndex: isDragPreview ? 30 : 10,
        opacity: isGhost ? 0.35 : isDragPreview ? 0.65 : 1,
        boxShadow: isDragPreview ? '0 4px 14px rgba(0,0,0,0.35)' : 'none',
        border: isGhost ? `2px dashed ${event.color}` : 'none',
      }}
      onPointerDown={handlePointerDown}
      onClick={e => { e.stopPropagation(); onClick(event); }}
    >
      <div className="p-1 h-full flex flex-col justify-start">
        {isContinuation ? (
          <>
            <span className="text-white/70 text-xs leading-tight italic truncate">↩ {event.label}</span>
            {clampedDuration >= 2 && (
              <span className="text-white/60 text-xs leading-tight">
                {hoursToLabel(totalHours)} total
              </span>
            )}
          </>
        ) : (
          <>
            <span className="text-white text-xs font-semibold leading-tight truncate">{event.label}</span>
            {clampedDuration >= 2 && (
              <span className="text-white/75 text-xs leading-tight">
                {hoursToLabel(totalHours)}{overflowContinues ? ' →' : ''}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
