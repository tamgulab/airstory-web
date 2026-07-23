import React, { useEffect, useRef, useState } from "react";
import { BookOpen } from "lucide-react";
import { pingHealth } from "../api/http";
import { AIR_FACTS } from "./LandingPage";

// The frontend is always up (Vercel), but the API sleeps on Render's free tier and can take
// ~30-60s to cold-start. This gate warms the backend the moment the app opens and blocks the
// UI behind a splash until /api/health responds — so users see "we're starting up" instead of
// a frozen login button on their first action.

const GRACE_MS = 1500; // if the server answers within this, skip the splash entirely (warm load)
const POLL_MS = 3000; // gap between wake attempts while the server is still cold
const PING_TIMEOUT_MS = 8000; // per-attempt timeout; a hung fetch is treated as "still waking"
const FACT_ROTATE_MS = 5000; // cycle through the air facts while waiting

export default function WakeGate({ children }) {
  const [ready, setReady] = useState(false);
  const [showSplash, setShowSplash] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  // Start on a random fact (like the landing page), then advance through the rest in order.
  const [factIndex, setFactIndex] = useState(() =>
    Math.floor(Math.random() * AIR_FACTS.length)
  );
  const startedAt = useRef(Date.now());

  // Warm the backend on mount and keep polling until it reports healthy.
  useEffect(() => {
    let cancelled = false;

    // Only reveal the splash if we're still waiting after the grace period. This avoids a
    // jarring flash when the server is already awake and answers in a few hundred ms.
    const graceTimer = setTimeout(() => {
      if (!cancelled) setShowSplash(true);
    }, GRACE_MS);

    (async function wake() {
      while (!cancelled) {
        const ok = await pingHealth(PING_TIMEOUT_MS);
        if (cancelled) return;
        if (ok) {
          setReady(true);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, POLL_MS));
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(graceTimer);
    };
  }, []);

  // Tick an elapsed-seconds counter while the splash is visible, to drive the reassurance copy.
  useEffect(() => {
    if (!showSplash || ready) return undefined;
    const id = setInterval(() => {
      setElapsed(Math.round((Date.now() - startedAt.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [showSplash, ready]);

  // Cycle through the air facts every few seconds so there's something to read while waiting.
  useEffect(() => {
    if (!showSplash || ready) return undefined;
    const id = setInterval(() => {
      setFactIndex((i) => (i + 1) % AIR_FACTS.length);
    }, FACT_ROTATE_MS);
    return () => clearInterval(id);
  }, [showSplash, ready]);

  if (ready) return children;
  // Brief blank during the grace window — consistent with a normal app boot, no flash on warm loads.
  if (!showSplash) return null;

  const message =
    elapsed < 20
      ? "The server is starting up. This usually takes 30–60 seconds on the first visit."
      : elapsed < 60
      ? "Almost there — waking the server takes a little longer after a period of inactivity."
      : "Still working on it. Free hosting can be slow to wake up; hang tight.";

  return (
    <div
      className="min-h-screen bg-slate-50 font-sans text-slate-900 flex flex-col"
      style={{
        backgroundImage: "radial-gradient(#cbd5e1 1px, transparent 1px)",
        backgroundSize: "24px 24px",
      }}
    >
      <div className="w-full h-1.5 bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-600" />
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white/80 backdrop-blur px-8 py-10 shadow-sm">
          <div
            className="mx-auto mb-6 h-12 w-12 rounded-full border-4 border-slate-200 border-t-blue-600 animate-spin"
            role="status"
            aria-label="Waking up the server"
          />
          <h1 className="text-xl font-semibold text-slate-900">Waking up the server</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">{message}</p>

          {/* Air facts, cycled every few seconds — same content as the landing page */}
          <div className="mt-6 p-5 bg-gray-50 rounded-2xl border border-gray-200 text-left">
            <div className="flex gap-4 items-center">
              <div className="bg-blue-100 p-2 rounded-xl text-blue-600 shrink-0">
                <BookOpen size={20} />
              </div>
              <div>
                <h4 className="font-bold text-gray-400 text-[10px] uppercase tracking-[0.2em] mb-0.5">
                  Random Air Fact of the Day!
                </h4>
                <p key={factIndex} className="font-semibold text-gray-700 leading-snug animate-fade-in">
                  {AIR_FACTS[factIndex]}
                </p>
              </div>
            </div>
          </div>

          <p className="mt-6 text-xs tabular-nums text-slate-400">{elapsed}s elapsed</p>
        </div>
        <p className="mt-6 max-w-md text-xs text-slate-400">
          This only happens after the app has been idle for a while — it stays fast once it's awake.
        </p>
      </main>
    </div>
  );
}
