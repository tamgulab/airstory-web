import React, { useEffect, useRef } from 'react';
import './DeviceExplorer.css';
import deviceExplorerMarkup from './deviceExplorerMarkup';
import { initDeviceExplorer, initSensorWalk } from './deviceExplorerController';

/**
 * Interactive sensor explorer — hover/click any part of the device to see
 * what it does, toggle airflow, and "look inside" the PM2.5 sensor for the
 * cutaway laser-scatter view.
 *
 * Implementation note: the diagram itself is ~300 lines of hand-tuned SVG
 * (gradients, part outlines, animation targets) and its interactivity is
 * ~300 lines of imperative DOM logic (hover binding, view switching, a
 * requestAnimationFrame particle animation). Both are reused verbatim from
 * the working design mockup rather than reimplemented in JSX/React state —
 * hand-translating that much SVG risks silently breaking part hitboxes or
 * animation math for no real benefit. What DID change is the layout: see
 * DeviceExplorer.css for the fit-to-screen fix.
 *
 * The markup is injected imperatively (ref.innerHTML) rather than via the
 * dangerouslySetInnerHTML prop: LandingPage re-renders shortly after mount
 * (auth state settling), and when that happens while dangerouslySetInnerHTML
 * is a controlled prop, React can silently re-apply it and wipe out every
 * listener bindParts() just attached — the diagram still looks right, but
 * hover/click stop doing anything with no console error. Setting the HTML
 * once ourselves means later re-renders of this component have nothing to
 * diff against, so the injected DOM (and its listeners) is never touched
 * again after the initial setup.
 */
export default function SensorExplorer() {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (containerRef.current.dataset.initialized === 'true') return;
    containerRef.current.dataset.initialized = 'true';
    containerRef.current.innerHTML = deviceExplorerMarkup;
    initDeviceExplorer();
    initSensorWalk();
  }, []);

  return <div ref={containerRef} />;
}
