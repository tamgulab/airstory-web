import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Small month calendar for picking data-bearing dates.
 *
 * - `dataDates`     Set<'YYYY-MM-DD'> — dates that have data: bold + selectable.
 *                   Dates not in this set are greyed and inert.
 * - `selectedDates` Set<'YYYY-MM-DD'> — currently selected dates (draft).
 * - `onChange(nextSet)` — called with a new Set whenever the selection changes.
 *
 * Selection: click toggles a single date; dragging "paints" — the first date's
 * current state decides whether the drag selects or deselects everything it crosses.
 */

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function toKey(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export default function DataCalendar({ dataDates, selectedDates, onChange, initialMonthKey }) {
  const init = initialMonthKey ? new Date(`${initialMonthKey}-01T00:00:00`) : new Date();
  const [view, setView] = useState({ year: init.getFullYear(), month: init.getMonth() });

  // Refs so drag handlers always read the latest selection (avoids stale closures
  // during a fast drag, where several mouseenter events fire between renders).
  const selectedRef = useRef(selectedDates);
  selectedRef.current = selectedDates;
  const draggingRef = useRef(false);
  const modeRef = useRef('add'); // 'add' | 'remove'

  useEffect(() => {
    const stop = () => { draggingRef.current = false; };
    document.addEventListener('mouseup', stop);
    return () => document.removeEventListener('mouseup', stop);
  }, []);

  const applyToDate = (key) => {
    const next = new Set(selectedRef.current);
    if (modeRef.current === 'add') next.add(key);
    else next.delete(key);
    onChange(next);
  };

  const startDrag = (key) => {
    modeRef.current = selectedRef.current.has(key) ? 'remove' : 'add';
    draggingRef.current = true;
    applyToDate(key);
  };

  const enterDrag = (key) => {
    if (draggingRef.current) applyToDate(key);
  };

  const firstWeekday = new Date(view.year, view.month, 1).getDay();
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const prevMonth = () =>
    setView((v) => (v.month === 0 ? { year: v.year - 1, month: 11 } : { year: v.year, month: v.month - 1 }));
  const nextMonth = () =>
    setView((v) => (v.month === 11 ? { year: v.year + 1, month: 0 } : { year: v.year, month: v.month + 1 }));

  const monthLabel = new Date(view.year, view.month, 1).toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="select-none w-64">
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={prevMonth} className="p-1 rounded hover:bg-gray-100" aria-label="Previous month">
          <ChevronLeft className="w-4 h-4 text-gray-600" />
        </button>
        <span className="text-sm font-semibold text-gray-800">{monthLabel}</span>
        <button type="button" onClick={nextMonth} className="p-1 rounded hover:bg-gray-100" aria-label="Next month">
          <ChevronRight className="w-4 h-4 text-gray-600" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map((w) => (
          <div key={w} className="text-center text-[10px] font-medium text-gray-400">{w}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (d === null) return <div key={`empty-${i}`} />;
          const key = toKey(view.year, view.month, d);
          const hasData = dataDates.has(key);
          const isSelected = selectedDates.has(key);

          if (!hasData) {
            return (
              <div
                key={key}
                className="h-8 flex items-center justify-center text-xs text-gray-300 cursor-default"
                title="No data"
              >
                {d}
              </div>
            );
          }

          return (
            <button
              key={key}
              type="button"
              onMouseDown={() => startDrag(key)}
              onMouseEnter={() => enterDrag(key)}
              className={`h-8 flex items-center justify-center text-xs font-bold rounded-md transition-colors ${
                isSelected ? 'bg-blue-600 text-white' : 'text-gray-800 hover:bg-blue-50'
              }`}
            >
              {d}
            </button>
          );
        })}
      </div>

      <p className="mt-2 text-[10px] text-gray-400 leading-tight">
        Bold = has data. Click to toggle, or drag to select a range.
      </p>
    </div>
  );
}
