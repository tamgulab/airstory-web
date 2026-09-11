import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Users } from 'lucide-react';
import Button from './ui/Button';
import Field from './ui/Field';
import Card from './ui/Card';
import SensorExplorer from './SensorExplorer';

export const AIR_FACTS = [
  "Trees act as natural air filters! One mature tree can absorb up to 48 lbs of CO2 per year.",
  "PM2.5 particles are about 30 times smaller than the width of a human hair.",
  "Rain can temporarily lower airborne particle levels by washing pollutants out of the air.",
  "Indoor air can sometimes be more polluted than outdoor air without proper ventilation.",
  "Morning and evening rush hours often show higher roadside pollution levels.",
  "High humidity can change how some pollutants behave and how particles stay suspended.",
  "Urban green spaces can reduce local air temperature and improve nearby air quality.",
  "Wind speed and direction strongly affect where pollution travels across a city.",
  "Long-term exposure to poor air quality can impact both lung and heart health.",
  "Air quality sensors help communities spot local hotspots that citywide averages can miss.",
];

const DOT_FIELD_STYLE = {
  backgroundImage: 'radial-gradient(#dcdce2 1px, transparent 1px)',
  backgroundSize: '22px 22px',
};

const WORDMARK_GRADIENT_STYLE = {
  backgroundImage: 'linear-gradient(100deg, #0071e3 0%, #2f9bd6 42%, #3aab86 100%)',
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
};

const WORDMARK_TEXT = 'AirStory';

const LandingPage = ({ onLogin, onRegister, onGoogleLogin, authError, authLoading }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [formError, setFormError] = useState('');
  const randomAirFact = useMemo(
    () => AIR_FACTS[Math.floor(Math.random() * AIR_FACTS.length)],
    []
  );

  // One-time wordmark reveal: types out "AirStory", then does a quick color "scan" before
  // settling into the real brand gradient — as if it just took a reading.
  const [wordmarkChars, setWordmarkChars] = useState(0);
  const [wordmarkPhase, setWordmarkPhase] = useState('typing'); // 'typing' | 'detecting' | 'done'

  useEffect(() => {
    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      setWordmarkChars(WORDMARK_TEXT.length);
      setWordmarkPhase('done');
      return;
    }
    let i = 0;
    const typeTimer = setInterval(() => {
      i += 1;
      setWordmarkChars(i);
      if (i >= WORDMARK_TEXT.length) {
        clearInterval(typeTimer);
        setWordmarkPhase('detecting');
        setTimeout(() => setWordmarkPhase('done'), 900);
      }
    }, 85);
    return () => clearInterval(typeTimer);
  }, []);

  // "Keep scrolling" shouldn't just jump — a brief held stall, then an eased release
  // into motion that settles rather than snapping to a stop.
  const handleScrollToDevice = (e) => {
    e.preventDefault();
    const target = document.getElementById('device-section');
    if (!target) return;

    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      target.scrollIntoView({ block: 'start' });
      return;
    }

    const startY = window.scrollY;
    const targetY = target.getBoundingClientRect().top + startY - 12;
    const distance = targetY - startY;
    if (Math.abs(distance) < 4) return;

    const stallMs = 150;
    const durationMs = 820;
    const easeOutQuint = (t) => 1 - Math.pow(1 - t, 5);
    const startTime = performance.now();

    const step = (now) => {
      const elapsed = now - startTime - stallMs;
      if (elapsed < 0) {
        requestAnimationFrame(step);
        return;
      }
      const t = Math.min(1, elapsed / durationMs);
      window.scrollTo(0, startY + distance * easeOutQuint(t));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const handleLoginAttempt = () => {
    if (isSignUp) {
      if (fullName.trim().length < 2) {
        setFormError('Please enter your full name.');
        return;
      }
      if (workspaceName.trim().length < 2) {
        setFormError('Please name your workspace (e.g. "Lincoln High – Ms. Rivera").');
        return;
      }
      setFormError('');
      onRegister({ email, password, fullName, workspaceName: workspaceName.trim() });
      return;
    }
    setFormError('');
    onLogin({ email, password });
  };

  if (showHelp) {
    return (
      <div className="w-full max-w-md mx-auto">
        <Card className="text-center space-y-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-canvas flex items-center justify-center text-secondary">
            <Users size={32} />
          </div>
          <div>
            <h2 className="text-page text-fg mb-2">Needs Teacher Assistance</h2>
            <p className="text-body text-secondary">
              Please ask your teacher to verify your account details or reset your password.
            </p>
          </div>
          <Button variant="neutral" wide onClick={() => setShowHelp(false)}>
            Back to Login
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full" style={DOT_FIELD_STYLE}>
      <div className="max-w-[1120px] mx-auto px-6">
        <div className="grid lg:grid-cols-[1fr_380px] gap-14 lg:gap-[72px] items-center py-10 lg:py-14">
          {/* Left: brand + info */}
          <div>
            <span className="inline-flex items-center gap-2 h-8 px-4 rounded-pill border border-hairline bg-surface text-cap tracking-wide uppercase text-secondary">
              <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M13 3c0 6-4 9-8 9a4 4 0 0 1 0-8c3 0 3-1 8-1z" fill="none" stroke="#2e9e5b" strokeWidth="1.4" />
                <path d="M3 13c2-3 4-5 7-6" fill="none" stroke="#2e9e5b" strokeWidth="1.4" />
              </svg>
              Tamgu Lab @ TC
            </span>

            <h1
              aria-label="Air Story"
              className={`text-[56px] sm:text-[72px] lg:text-[88px] leading-[1.02] font-semibold tracking-[-0.02em] mt-6 ${
                wordmarkPhase === 'detecting' ? 'wordmark-detecting' : ''
              }`}
              style={WORDMARK_GRADIENT_STYLE}
            >
              {WORDMARK_TEXT.slice(0, wordmarkChars)}
              {wordmarkPhase === 'typing' && <span className="wordmark-cursor" aria-hidden="true" />}
            </h1>
            <p className="text-body text-secondary mt-5 max-w-lg" style={{ fontSize: 21, lineHeight: '29px' }}>
              Measure the air your class breathes, then set it beside the city&rsquo;s own sensors.
            </p>

            <div className="grid grid-cols-2 gap-3 mt-8 max-w-md">
              <Card className="!p-4">
                <p className="text-small text-fg font-semibold">Experiments</p>
                <p className="text-small text-muted mt-0.5">Hands-on STEM</p>
              </Card>
              <Card className="!p-4">
                <p className="text-small text-fg font-semibold">Live data</p>
                <p className="text-small text-muted mt-0.5">Real sensors</p>
              </Card>
            </div>

            <Card flat className="mt-4 max-w-md !bg-white/60">
              <p className="text-cap text-muted uppercase tracking-wide">Air fact of the day</p>
              <p className="text-small text-fg mt-1.5">{randomAirFact}</p>
            </Card>
          </div>

          {/* Right: login/signup card */}
          <Card className="p-8">
            <h2 className="text-tile text-fg">
              {isSignUp ? 'Create a Workspace' : 'Log in'}
            </h2>
            <p className="text-small text-muted mt-1 mb-6">
              {isSignUp
                ? "You'll be the teacher and can invite students and co-teachers."
                : 'Use the address your school gave you.'}
            </p>

            <div className="space-y-4">
              {isSignUp && (
                <>
                  <Field
                    label="Full Name"
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                  <Field
                    label="Workspace Name"
                    id="workspaceName"
                    type="text"
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    placeholder='e.g. "Lincoln High – Ms. Rivera"'
                  />
                </>
              )}
              <Field
                label="School email"
                id="email"
                type="email"
                placeholder="name@school.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Field
                label="Password"
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {isSignUp && (
                <p className="text-cap text-muted text-center">
                  Joining a class? Use the invite link your teacher shared instead.
                </p>
              )}
            </div>

            <Button wide className="mt-6" onClick={handleLoginAttempt}>
              {isSignUp ? 'Create Workspace' : 'Log in'}
              <ArrowRight size={18} />
            </Button>

            {onGoogleLogin && (
              <>
                <div className="flex items-center gap-4 my-5 text-muted text-cap">
                  <span className="flex-1 h-px bg-hairline" />
                  or
                  <span className="flex-1 h-px bg-hairline" />
                </div>
                <Button variant="neutral" wide type="button" onClick={onGoogleLogin}>
                  <svg width="17" height="17" viewBox="0 0 18 18" aria-hidden="true">
                    <path fill="#4285F4" d="M17.6 9.2c0-.6-.1-1.2-.2-1.8H9v3.4h4.8a4.1 4.1 0 0 1-1.8 2.7v2.2h2.9c1.7-1.6 2.7-3.9 2.7-6.5z" />
                    <path fill="#34A853" d="M9 18c2.4 0 4.5-.8 6-2.2l-2.9-2.2c-.8.5-1.8.9-3.1.9-2.4 0-4.4-1.6-5.1-3.8H.9v2.3A9 9 0 0 0 9 18z" />
                    <path fill="#FBBC05" d="M3.9 10.7a5.4 5.4 0 0 1 0-3.4V5H.9a9 9 0 0 0 0 8l3-2.3z" />
                    <path fill="#EA4335" d="M9 3.6c1.3 0 2.5.5 3.4 1.3L15 2.3A9 9 0 0 0 .9 5l3 2.3C4.6 5.2 6.6 3.6 9 3.6z" />
                  </svg>
                  Continue with Google
                </Button>
              </>
            )}

            <button
              type="button"
              onClick={() => {
                setFormError('');
                setIsSignUp((prev) => !prev);
              }}
              className="w-full text-small text-link hover:underline text-center mt-5"
            >
              {isSignUp ? 'Already have an account? Log in' : 'New here? Create a workspace'}
            </button>

            {authError && (
              <p className="text-small text-aqi-unhealthy text-center mt-4">{authError}</p>
            )}
            {formError && (
              <p className="text-small text-aqi-unhealthy text-center mt-4">{formError}</p>
            )}
            {authLoading && (
              <p className="text-small text-muted text-center mt-4">Signing in...</p>
            )}

            <p className="text-cap text-muted uppercase tracking-wide text-center mt-6">
              Secure school login
            </p>
          </Card>
        </div>

        <div className="flex justify-center pb-12">
          <a
            href="#device-section"
            onClick={handleScrollToDevice}
            className="inline-flex flex-col items-center gap-2.5 px-6 py-3 rounded-card hover:bg-white/70 transition-colors"
          >
            <span className="text-cap tracking-wide uppercase text-muted">Keep scrolling</span>
            <span className="text-body font-semibold text-fg" style={{ fontSize: 19 }}>Inside the device</span>
            <span className="w-[42px] h-[42px] rounded-full border border-hairline bg-surface grid place-items-center text-fg animate-nudge">
              <svg width="18" height="11" viewBox="0 0 18 11" fill="none" aria-hidden="true">
                <path d="M1.5 1.5L9 9l7.5-7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </a>
        </div>
      </div>

      <div className="device-section" id="device-section">
        <div className="device-wide">
          <p className="text-cap text-muted uppercase tracking-wide" style={{ marginBottom: 12 }}>
            Inside the device
          </p>
          <h2 className="text-section text-fg">The sensor is the first thing to understand.</h2>
          <p className="text-body text-secondary" style={{ margin: '20px 0 36px', maxWidth: 640 }}>
            AirStory turns the air around you into measurements you can see. Move across a
            component to identify it, then select it to learn how it works.
          </p>
          <SensorExplorer />
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
