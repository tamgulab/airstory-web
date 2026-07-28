import React, { useEffect, useState } from 'react';

const STORAGE_PREFIX = 'air_reflection_v1_';

/**
 * Structured claim/evidence/reasoning (CER) or notice/wonder prompt shown under a chart, so
 * students record their thinking instead of just reading the numbers. Saved locally per
 * storageKey (session-scoped, not synced to the server in this iteration).
 */
const ReflectionPrompt = ({ storageKey, mode = 'cer', title }) => {
  const fields = mode === 'cer'
    ? [
        { key: 'claim', label: 'Claim', placeholder: 'What do you think is happening?' },
        { key: 'evidence', label: 'Evidence', placeholder: 'What in the chart supports that?' },
        { key: 'reasoning', label: 'Reasoning', placeholder: 'Why does that evidence support your claim?' },
      ]
    : [
        { key: 'notice', label: 'I notice…', placeholder: 'What stands out in this chart?' },
        { key: 'wonder', label: 'I wonder…', placeholder: 'What questions does this raise?' },
      ];

  const [values, setValues] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + storageKey);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_PREFIX + storageKey, JSON.stringify(values));
    } catch {
      // Best-effort only; not critical if storage is full/unavailable.
    }
  }, [storageKey, values]);

  return (
    <div className="mt-3 border border-dashed border-gray-300 rounded-xl">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left"
      >
        <span className="text-sm font-semibold text-gray-700">
          {title || (mode === 'cer' ? 'Claim, Evidence, Reasoning' : 'Notice & Wonder')}
        </span>
        <span className="text-xs text-gray-400">{open ? 'Hide' : 'Add your thinking'}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3">
          {fields.map((f) => (
            <div key={f.key}>
              <label className="block text-xs font-semibold text-gray-600 mb-1">{f.label}</label>
              <textarea
                value={values[f.key] || ''}
                onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                rows={2}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ReflectionPrompt;
