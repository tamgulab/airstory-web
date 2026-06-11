import React, { useEffect, useRef } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';

/**
 * Shared confirmation dialog for ANY destructive action. Cancel is the default
 * (auto-focused; Escape / backdrop click cancel). Reuse this rather than building
 * one-off confirms so every delete flow looks and behaves the same.
 *
 * Props:
 * - open
 * - variant: 'default' (single item — lighter) | 'danger' (bulk / full wipe — heavier,
 *   red-bordered, adds an explicit "This cannot be undone." line)
 * - title    e.g. "Delete session 'Rivera P3 G1 Courtyard' and its readings?"
 * - message  short consequence; for bulk wipes also state the full scope
 * - confirmLabel / cancelLabel
 * - onConfirm / onCancel
 */
export default function ConfirmDialog({
  open,
  variant = 'default',
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  confirmIcon = <Trash2 className="w-4 h-4" />,
  onConfirm,
  onCancel,
}) {
  const cancelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    cancelRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  const isDanger = variant === 'danger';

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`bg-white rounded-2xl w-full shadow-2xl ${isDanger ? 'max-w-md border-2 border-red-500' : 'max-w-sm'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start gap-3">
            <div className={`flex-shrink-0 rounded-full p-2 ${isDanger ? 'bg-red-100' : 'bg-amber-100'}`}>
              <AlertTriangle className={isDanger ? 'w-6 h-6 text-red-600' : 'w-5 h-5 text-amber-600'} />
            </div>
            <div className="min-w-0">
              <h3 className={`font-bold text-gray-900 ${isDanger ? 'text-lg' : 'text-base'}`}>{title}</h3>
              {message && <p className="mt-1 text-sm text-gray-600">{message}</p>}
              {isDanger && <p className="mt-2 text-sm font-semibold text-red-600">This cannot be undone.</p>}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 pb-6">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg focus:outline-none focus:ring-2 ${
              isDanger ? 'bg-red-600 hover:bg-red-700 focus:ring-red-400' : 'bg-red-500 hover:bg-red-600 focus:ring-red-300'
            }`}
          >
            {confirmIcon}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
