import React, { useEffect, useLayoutEffect, useState } from 'react';
import { X } from 'lucide-react';

const HOLE_PAD = 8;
const CARD_WIDTH = 300;
const VIEWPORT_MARGIN = 16;
const DIM_COLOR = 'rgba(17, 17, 20, 0.28)';

function measure(selector) {
  const el = typeof selector === 'string' ? document.querySelector(selector) : selector;
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

/**
 * A small, self-contained "spotlight" walkthrough: dims the page, cuts a see-through
 * hole around one element at a time, and shows a short callout next to it. Steps whose
 * target isn't currently in the DOM (e.g. a teacher-only control for a student view) are
 * skipped automatically rather than breaking the tour.
 *
 * Steps can belong to different app sections (e.g. Analysis, then Workspace) — pass the
 * app's current section plus a setter, and the tour will switch sections itself as it
 * advances or goes back, waiting for that section's elements to mount before continuing.
 *
 * steps: [{ selector: '[data-tour="x"]', title, body, section? }]
 */
export default function GuidedTour({ steps, open, onClose, currentSection, onNavigate }) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState(null);
  const [ready, setReady] = useState(false);

  // Reset to the first step whenever the tour (re)opens. This is a layout effect, and it's
  // declared before the measuring effect below, so it always runs first within the same
  // commit — otherwise a tour closed mid-way through would briefly flash its old step/
  // position before snapping back to the start.
  useLayoutEffect(() => {
    if (open) {
      setIndex(0);
      setRect(null);
      setReady(false);
    }
  }, [open]);

  // Recompute the target's position each step. If the step lives in a different app
  // section, navigate there first and wait for that section to mount. If the target
  // still isn't in the DOM once we're in the right section (e.g. a teacher-only control),
  // skip ahead rather than breaking the tour.
  useLayoutEffect(() => {
    if (!open) return;
    const step = steps[index];
    if (!step) {
      onClose?.();
      return;
    }
    if (step.section && currentSection && step.section !== currentSection) {
      setReady(false);
      onNavigate?.(step.section);
      return;
    }
    const found = measure(step.selector);
    if (!found) {
      if (index < steps.length - 1) setIndex(index + 1);
      else onClose?.();
      return;
    }
    setRect(found);
    setReady(true);
    const target = document.querySelector(step.selector);
    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target?.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, index, currentSection, steps.length]);

  useEffect(() => {
    if (!open) return undefined;
    const recompute = () => {
      const step = steps[index];
      if (step) setRect(measure(step.selector) || rect);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
      else if (e.key === 'ArrowRight') setIndex((i) => Math.min(i + 1, steps.length - 1));
      else if (e.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0));
    };
    window.addEventListener('resize', recompute);
    window.addEventListener('scroll', recompute, true);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('resize', recompute);
      window.removeEventListener('scroll', recompute, true);
      document.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, index, steps.length]);

  // Make the tour genuinely interactive: once a step's target is spotlighted, clicking it
  // for real (not just clicking "Next") both performs the actual action and advances the
  // tour. Listening in the bubble phase means the element's own click handling always runs
  // first, so we never interfere with it.
  useEffect(() => {
    if (!open || !ready) return undefined;
    const step = steps[index];
    if (!step) return undefined;
    const target = document.querySelector(step.selector);
    if (!target) return undefined;
    const advance = () => {
      if (index < steps.length - 1) setIndex(index + 1);
      else onClose?.();
    };
    target.addEventListener('click', advance);
    return () => target.removeEventListener('click', advance);
  }, [open, ready, index, steps, onClose]);

  if (!open || !rect) return null;

  const step = steps[index];
  const isLast = index === steps.length - 1;
  const sectionChanged = step.section && currentSection && step.section !== currentSection;
  const sectionLabel = step.section ? step.section.charAt(0).toUpperCase() + step.section.slice(1) : '';

  const hole = {
    top: rect.top - HOLE_PAD,
    left: rect.left - HOLE_PAD,
    width: rect.width + HOLE_PAD * 2,
    height: rect.height + HOLE_PAD * 2,
  };

  // Prefer placing the callout below the target; flip above if there isn't room.
  const spaceBelow = window.innerHeight - (hole.top + hole.height);
  const placeAbove = spaceBelow < 190 && hole.top > 190;
  const cardTop = placeAbove ? Math.max(VIEWPORT_MARGIN, hole.top - 10) : hole.top + hole.height + 10;
  const cardLeftRaw = hole.left + hole.width / 2 - CARD_WIDTH / 2;
  const cardLeft = Math.min(
    Math.max(VIEWPORT_MARGIN, cardLeftRaw),
    window.innerWidth - CARD_WIDTH - VIEWPORT_MARGIN
  );

  // Dim everything except the spotlighted hole using four separate strips rather than one
  // full-viewport overlay — that way the hole has literally nothing covering it, so the
  // highlighted control underneath stays genuinely clickable instead of just decorative.
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const dimStrips = [
    { top: 0, left: 0, width: vw, height: Math.max(0, hole.top) }, // above
    { top: hole.top + hole.height, left: 0, width: vw, height: Math.max(0, vh - (hole.top + hole.height)) }, // below
    { top: hole.top, left: 0, width: Math.max(0, hole.left), height: hole.height }, // left
    { top: hole.top, left: hole.left + hole.width, width: Math.max(0, vw - (hole.left + hole.width)), height: hole.height }, // right
  ];

  return (
    <div aria-live="polite">
      {dimStrips.map((s, i) => (
        <div
          key={i}
          className="fixed z-[70] transition-opacity duration-300 ease-out"
          onClick={onClose}
          role="presentation"
          style={{ ...s, background: DIM_COLOR, opacity: ready ? 1 : 0 }}
        />
      ))}
      <div
        className="fixed z-[71] rounded-xl pointer-events-none transition-opacity duration-300 ease-out"
        style={{
          top: hole.top,
          left: hole.left,
          width: hole.width,
          height: hole.height,
          boxShadow: '0 0 0 2px rgba(255,255,255,0.95), 0 0 22px rgba(0,113,227,0.35)',
          opacity: ready ? 1 : 0,
        }}
      />
      <div
        className="fixed z-[72] rounded-card bg-surface border border-hairline-soft shadow-xl p-4 transition-opacity duration-300 ease-out"
        style={{ top: cardTop, left: cardLeft, width: CARD_WIDTH, opacity: ready ? 1 : 0 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="false"
        aria-label={`Guide, step ${index + 1} of ${steps.length}`}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-cap font-semibold uppercase tracking-wide text-muted">
            {sectionLabel ? `${sectionLabel} · ` : ''}Step {index + 1} of {steps.length}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close guide"
            className="p-0.5 -mr-1 -mt-0.5 text-muted hover:text-fg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-small font-semibold text-fg mt-1.5">
          {sectionChanged ? `Heading to ${sectionLabel}…` : step.title}
        </p>
        {!sectionChanged && <p className="text-small text-secondary mt-1">{step.body}</p>}
        {!sectionChanged && (
          <p className="text-cap text-muted mt-2">
            {isLast ? 'Click it to finish up.' : 'Click the highlighted control to continue.'}
          </p>
        )}
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-1">
            {steps.map((s, i) => (
              <span
                key={s.selector}
                className={`w-1.5 h-1.5 rounded-full ${i === index ? 'bg-fg' : 'bg-hairline'}`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-cap text-muted hover:text-fg underline underline-offset-2 transition-colors"
          >
            Skip tour
          </button>
        </div>
      </div>
    </div>
  );
}
