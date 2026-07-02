import { useId, useMemo, useRef, useState } from 'react';

function normalizeTitle(s) {
  return String(s ?? '').trim().replace(/\s+/g, ' ');
}

function buildMatches(value, suggestions) {
  const q = normalizeTitle(value).toLowerCase();
  if (!q) return [];

  const seen = new Set();
  const unique = [];

  for (const raw of suggestions) {
    const title = normalizeTitle(raw);
    if (!title) continue;

    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    if (key === q) continue;
    unique.push(title);
  }

  const prefix = [];
  const contains = [];

  for (const title of unique) {
    const key = title.toLowerCase();
    if (key.startsWith(q)) prefix.push(title);
    else if (key.includes(q)) contains.push(title);
  }

  return [...prefix, ...contains].slice(0, 6);
}

export default function EventTitleSuggestInput({
  value,
  onChange,
  suggestions = [],
  placeholder = 'e.g. Sleep, Deep work...',
  autoFocus = false,
  onEnter,
  className = '',
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);
  const id = useId();

  const matches = useMemo(
    () => buildMatches(value, suggestions),
    [value, suggestions]
  );

  function applySuggestion(title) {
    onChange(title);
    setOpen(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function handleKeyDown(e) {
    if (open && matches.length > 0) {
      const safeActiveIndex = Math.min(activeIndex, matches.length - 1);

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex(i => Math.min(i + 1, matches.length - 1));
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex(i => Math.max(i - 1, 0));
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        applySuggestion(matches[safeActiveIndex]);
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        return;
      }
    }

    if (e.key === 'Tab') {
      setOpen(false);
      return;
    }

    if (e.key === 'Enter') onEnter?.(e);
  }

  const show = open && !!normalizeTitle(value) && matches.length > 0;
  const safeActiveIndex = Math.min(activeIndex, Math.max(matches.length - 1, 0));
  const listboxId = `${id}-event-title-suggestions`;
  const activeId = show ? `${id}-event-title-suggestion-${safeActiveIndex}` : undefined;

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={e => {
          onChange(e.target.value);
          setActiveIndex(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        role="combobox"
        aria-expanded={!!show}
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-activedescendant={activeId}
        className={className}
      />

      {show && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1 z-[80] overflow-hidden rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-xl"
        >
          {matches.map((title, i) => (
            <button
              key={title}
              id={`${id}-event-title-suggestion-${i}`}
              type="button"
              role="option"
              aria-selected={i === safeActiveIndex}
              onMouseDown={e => {
                e.preventDefault();
                applySuggestion(title);
              }}
              onMouseEnter={() => setActiveIndex(i)}
              className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                i === safeActiveIndex
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200'
                  : 'text-gray-700 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-600'
              }`}
            >
              <span className="block truncate">{title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
