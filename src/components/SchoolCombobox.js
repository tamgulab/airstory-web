import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';

/**
 * Editable combobox for picking a school from the internal directory.
 * - Clicking (or focusing) the field opens the full list.
 * - Typing filters the list (case-insensitive substring) and keeps it open.
 * - Free text is allowed: the value is whatever is in the input, so a school not yet
 *   in the directory can still be entered.
 *
 * Props:
 *   value          current text value
 *   onChange(v)    called with the new text (typing or selecting)
 *   options        array of school-name strings
 *   id             id for the <input> (used for label/focus wiring)
 *   placeholder    input placeholder
 *   disabled       disables the field
 *   inputClassName class names for the <input>
 */
export default function SchoolCombobox({
  value,
  onChange,
  options = [],
  id,
  placeholder,
  disabled = false,
  inputClassName = '',
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const wrapRef = useRef(null);
  const listRef = useRef(null);

  const filtered = useMemo(() => {
    const q = (value || '').trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [value, options]);

  // Close when clicking outside the combobox.
  useEffect(() => {
    if (!open) return undefined;
    const onDocMouseDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [open]);

  // Keep the highlighted option scrolled into view.
  useEffect(() => {
    if (!open || highlight < 0 || !listRef.current) return;
    const el = listRef.current.children[highlight];
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [highlight, open]);

  const select = (name) => {
    onChange(name);
    setOpen(false);
    setHighlight(-1);
  };

  const handleKeyDown = (e) => {
    if (disabled) return;
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setOpen(true);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      if (open && highlight >= 0 && highlight < filtered.length) {
        e.preventDefault();
        select(filtered[highlight]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setHighlight(-1);
    }
  };

  return (
    <div ref={wrapRef} className="relative flex-1">
      <div className="relative">
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          autoComplete="off"
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
            setHighlight(-1);
          }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          className={`${inputClassName} pr-10`}
        />
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          aria-label="Toggle school list"
          onClick={() => setOpen((o) => !o)}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600 disabled:opacity-50"
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {open && (
        <ul
          ref={listRef}
          role="listbox"
          className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg"
        >
          {filtered.length === 0 ? (
            <li className="px-4 py-2 text-sm text-gray-500">No matching schools — you can type a custom name.</li>
          ) : (
            filtered.map((name, i) => {
              const selected = name === value;
              return (
                <li
                  key={name}
                  role="option"
                  aria-selected={selected}
                  onMouseEnter={() => setHighlight(i)}
                  onMouseDown={(e) => {
                    // Prevent the input blur from closing the list before the click registers.
                    e.preventDefault();
                    select(name);
                  }}
                  className={`flex items-center justify-between px-4 py-2 text-sm cursor-pointer ${
                    i === highlight ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                  }`}
                >
                  <span>{name}</span>
                  {selected && <Check className="w-4 h-4 text-blue-600" />}
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
