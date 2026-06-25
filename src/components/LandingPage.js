import React, { useMemo, useState } from 'react';
import { 
  ArrowRight, 
  BookOpen, 
  Users, 
  Beaker, 
  GraduationCap, 
  CheckCircle, 
  XCircle, 
  Leaf,
  Shield,
  Activity,
} from 'lucide-react';
import { getJoinCodeConfig } from '../api/auth';
import AirStoryLogo from './AirStoryLogo';

const Button = ({ children, variant = 'primary', className = '', ...props }) => {
  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 shadow-md active:scale-95 transition-all",
    secondary: "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 shadow-sm active:scale-95 transition-all",
    success: "bg-green-600 text-white hover:bg-green-700 shadow-md active:scale-95 transition-all",
    danger: "bg-red-50 text-red-700 hover:bg-red-100 border border-red-100 transition-all"
  };

  return (
    <button className={`px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};

const AIR_FACTS = [
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

const LandingPage = ({ onLogin, onRegister, onGoogleLogin, filters, authError, authLoading }) => {
  const [mode, setMode] = useState('student');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [signupInstructor, setSignupInstructor] = useState(filters.instructor || '');
  const [signupPeriod, setSignupPeriod] = useState(filters.period || 'P1');
  const [signupGroup, setSignupGroup] = useState(filters.group || 'G1');
  const [showVerification, setShowVerification] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [signupStep, setSignupStep] = useState(1);
  const [formError, setFormError] = useState('');
  const [joinConfig, setJoinConfig] = useState(null);
  const [loadingJoinConfig, setLoadingJoinConfig] = useState(false);
  const randomAirFact = useMemo(
    () => AIR_FACTS[Math.floor(Math.random() * AIR_FACTS.length)],
    []
  );

  // Sign-up role choice (login needs no role — it's read from the account on the server).
  const handleRoleChange = (newMode) => {
    setFormError('');
    setSignupStep(1);
    setMode(newMode);
  };

  const handleLoginAttempt = async () => {
    if (isSignUp && mode === 'student' && signupStep === 1) {
      if (!/^[A-Z0-9]{5}$/.test(joinCode.trim().toUpperCase())) {
        setFormError('Join code must be exactly 5 letters/numbers.');
        return;
      }
      setLoadingJoinConfig(true);
      try {
        const config = await getJoinCodeConfig(joinCode.trim().toUpperCase());
        setJoinConfig(config);
        setSignupInstructor(config.instructor || signupInstructor);
        // The code fixes the period; the teacher assigns the group later, so neither is chosen here.
        setSignupPeriod(config.period || '');
        setSignupGroup('');
        setFormError('');
        setSignupStep(2);
      } catch (e) {
        setFormError(e.message || 'Invalid join code.');
      } finally {
        setLoadingJoinConfig(false);
      }
      return;
    }
    if (isSignUp && mode === 'student' && !joinCode.trim()) {
      setFormError('Student sign up requires a teacher join code.');
      return;
    }
    if (isSignUp && mode === 'student' && !/^[A-Z0-9]{5}$/.test(joinCode.trim().toUpperCase())) {
      setFormError('Join code must be exactly 5 letters/numbers.');
      return;
    }
    setFormError('');
    // Optional demo: teacher verification step before hitting the API (matches seeded Sikich account).
    if (
      !isSignUp &&
      email.trim().toLowerCase() === 'sikich@tamgu.com' &&
      password === 'sikich2026'
    ) {
      setShowVerification(true);
    } else {
      if (isSignUp) {
        onRegister({
          email,
          password,
          fullName,
          mode,
          joinCode,
          instructor: signupInstructor,
          period: signupPeriod,
          group: signupGroup,
        });
      } else {
        onLogin({ email, password, mode });
      }
    }
  };

  const confirmVerification = () => {
    setShowVerification(false);
    if (isSignUp) {
      onRegister({
        email,
        password,
        fullName,
        mode,
        joinCode,
        instructor: signupInstructor,
        period: signupPeriod,
        group: signupGroup,
      });
    } else {
      onLogin({ email, password, mode });
    }
  };

  if (showHelp) {
    return (
      <div className="w-full max-w-md mx-auto bg-white rounded-3xl p-8 shadow-2xl text-center space-y-6 animate-in zoom-in-95 duration-200">
        <div className="mx-auto w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center text-orange-600">
          <Users size={40} />
        </div>
        <div>
          <h2 className="text-2xl font-black text-gray-900 mb-2">Needs Teacher Assistance</h2>
          <p className="text-gray-600 font-medium">
            Please ask your teacher to verify your account details or reset your password.
          </p>
        </div>
        <Button variant="secondary" onClick={() => setShowHelp(false)} className="w-full">
          Back to Login
        </Button>
      </div>
    );
  }

  if (showVerification) {
    return (
      <div className="w-full max-w-md mx-auto bg-white rounded-3xl p-8 shadow-2xl text-center space-y-6 animate-in zoom-in-95 duration-200">
        <div className="mx-auto w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
          {mode === 'student' ? <GraduationCap size={40} /> : <Users size={40} />}
        </div>
        <div>
          <h2 className="text-2xl font-black text-gray-900 mb-2">Confirm User Info</h2>
          <p className="text-gray-600 font-medium">Is this you?</p>
        </div>
        
        <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 text-left space-y-4">
          <div>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">{mode === 'student' ? 'Student Name' : 'Instructor Name'}</p>
            <p className="text-lg font-bold text-gray-900">{fullName.trim() || email.trim() || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Access Level</p>
            <p className="text-lg font-bold text-gray-900">{mode === 'student' ? 'Student' : 'Instructor'}</p>
          </div>
          {mode === 'student' && (
            <div>
               <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Sign-up selection</p>
               <p className="text-lg font-bold text-blue-600 font-mono">
                 {signupPeriod} • {signupGroup}
                 {joinConfig?.schoolCode ? ` • ${joinConfig.schoolCode}` : ''}
                 {signupInstructor ? ` • ${signupInstructor}` : ''}
               </p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Button variant="danger" onClick={() => { setShowVerification(false); setShowHelp(true); }}>
            <XCircle size={20} /> No
          </Button>
          <Button variant="success" onClick={confirmVerification}>
            <CheckCircle size={20} /> Yes
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-12">
      <div className="grid lg:grid-cols-2 gap-16 items-center">
        
        {/* Left Side: Info */}
        <div className="space-y-8">
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-full font-bold text-sm border border-blue-100">
            <Leaf size={16} className="text-green-500" />
            <span>TAMGU LAB @TC</span>
          </div>
          
          <div className="space-y-4 group">
            <AirStoryLogo />
            <p className="text-xl text-gray-600 font-medium max-w-lg leading-relaxed">
              Turn everyday air-quality observations into a story you can learn from—together.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm transition-transform hover:scale-105">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 shrink-0">
                <Beaker size={20}/>
              </div>
              <div>
                <p className="font-bold text-gray-900 text-sm">Experiments</p>
                <p className="text-xs text-gray-500 font-medium">Hands-on STEM</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm transition-transform hover:scale-105">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                <Activity size={20}/>
              </div>
              <div>
                <p className="font-bold text-gray-900 text-sm">Live Data</p>
                <p className="text-xs text-gray-500 font-medium">Real sensors</p>
              </div>
            </div>
          </div>

          {/* Educational "Did you know?" Section - Toned down */}
          <div className="p-5 bg-gray-50 rounded-2xl border border-gray-200 transition-colors hover:bg-white group">
            <div className="flex gap-4 items-center">
              <div className="bg-blue-100 p-2 rounded-xl text-blue-600">
                <BookOpen size={20} />
              </div>
              <div>
                <h4 className="font-bold text-gray-400 text-[10px] uppercase tracking-[0.2em] mb-0.5">Random Air Fact of the Day!</h4>
                <p className="font-semibold text-gray-700 leading-snug">
                  {randomAirFact}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Login */}
        <div className="relative">
          {/* Decorative Elements */}
          <div className="absolute -top-12 -right-12 w-64 h-64 bg-blue-100 rounded-full blur-3xl opacity-50 -z-10" />
          <div className="absolute -bottom-12 -left-12 w-64 h-64 bg-cyan-100 rounded-full blur-3xl opacity-50 -z-10" />
          
          <div className="bg-white rounded-[2.5rem] p-3 shadow-2xl border border-gray-100 relative overflow-hidden">
            <div className="px-8 pt-8 pb-10 space-y-6">
              <div className="text-center">
                <div className="mx-auto w-20 h-20 bg-blue-50 rounded-2xl flex items-center justify-center mb-4 text-blue-600 transform -rotate-6 group hover:rotate-0 transition-transform">
                  {isSignUp && mode === 'student' ? <GraduationCap size={40} /> : <Users size={40} />}
                </div>
                <h3 className="text-2xl font-black text-gray-900">
                  {isSignUp
                    ? (mode === 'student' ? `Student Sign Up ${signupStep === 1 ? '• Step 1' : '• Step 2'}` : 'Teacher Sign Up')
                    : 'Log In'}
                </h3>
                <p className="text-gray-500 font-medium mt-1">
                  {isSignUp ? 'Set up your account.' : 'Sign in to Air Story to continue.'}
                </p>
              </div>

              {/* Role choice only matters when creating an account; logging in reads it from the account. */}
              {isSignUp && (
                <div className="grid grid-cols-2 p-1.5 bg-gray-100 rounded-[2rem]">
                  <button
                    type="button"
                    onClick={() => handleRoleChange('student')}
                    className={`py-3 rounded-[1.75rem] font-bold text-sm transition-all duration-300 ${mode === 'student' ? 'bg-white text-blue-600 shadow-lg scale-[1.02]' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    I'm a Student
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRoleChange('teacher')}
                    className={`py-3 rounded-[1.75rem] font-bold text-sm transition-all duration-300 ${mode === 'teacher' ? 'bg-white text-blue-600 shadow-lg scale-[1.02]' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    I'm a Teacher
                  </button>
                </div>
              )}

              <div className="space-y-4">
                {isSignUp && (
                  <>
                    {mode === 'student' && (
                      <>
                        {signupStep === 1 && (
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Join Code</label>
                            <input
                              type="text"
                              value={joinCode}
                              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                              placeholder="5-letter/number class code"
                              maxLength={5}
                              className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 py-4 focus:outline-none focus:border-blue-500 focus:bg-white transition-all font-medium tracking-wider uppercase"
                            />
                          </div>
                        )}
                        {signupStep === 2 && (
                          <>
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Full Name</label>
                              <input
                                type="text"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 py-4 focus:outline-none focus:border-blue-500 focus:bg-white transition-all font-medium"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Instructor (optional)</label>
                              <input
                                type="text"
                                value={signupInstructor}
                                onChange={(e) => setSignupInstructor(e.target.value)}
                                placeholder="Class instructor name (as on your roster)"
                                className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 py-4 focus:outline-none focus:border-blue-500 focus:bg-white transition-all font-medium"
                              />
                            </div>
                            <div className="rounded-2xl bg-blue-50 border border-blue-100 px-4 py-3">
                              <p className="text-xs font-bold text-blue-400 uppercase tracking-widest">Class Period</p>
                              <p className="text-lg font-black text-blue-700">{signupPeriod || 'Assigned by your code'}</p>
                              <p className="text-xs text-gray-500 font-medium mt-1">Your teacher will assign your group.</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setSignupStep(1)}
                              className="text-xs text-blue-600 hover:text-blue-700 font-semibold"
                            >
                              Change Join Code
                            </button>
                          </>
                        )}
                      </>
                    )}
                    {mode === 'teacher' && (
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Full Name</label>
                        <input
                          type="text"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 py-4 focus:outline-none focus:border-blue-500 focus:bg-white transition-all font-medium"
                        />
                      </div>
                    )}
                  </>
                )}
                {!(isSignUp && mode === 'student' && signupStep === 1) && (
                  <>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Email Address</label>
                      <input 
                        type="email" 
                        placeholder="name@school.edu" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 py-4 focus:outline-none focus:border-blue-500 focus:bg-white transition-all font-medium" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Password</label>
                      <input 
                        type="password" 
                        placeholder="••••••••" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 py-4 focus:outline-none focus:border-blue-500 focus:bg-white transition-all font-medium" 
                      />
                    </div>
                  </>
                )}
              </div>

              <Button onClick={handleLoginAttempt} className="w-full py-4 text-lg">
                {isSignUp
                  ? (mode === 'student' ? (signupStep === 1 ? (loadingJoinConfig ? 'Checking Code...' : 'Next') : 'Create Account') : 'Create Account')
                  : 'Log In'}
                <ArrowRight size={22} className="ml-1" />
              </Button>
              {onGoogleLogin && (
                <>
                  <div className="flex items-center gap-3 py-1">
                    <div className="h-px bg-gray-200 flex-1" />
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">or</span>
                    <div className="h-px bg-gray-200 flex-1" />
                  </div>
                  <button
                    type="button"
                    onClick={onGoogleLogin}
                    className="w-full py-3.5 rounded-xl font-bold flex items-center justify-center gap-3 bg-white text-gray-700 border border-gray-200 shadow-sm hover:bg-gray-50 active:scale-95 transition-all"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
                    </svg>
                    Continue with Google
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => {
                  setFormError('');
                  setIsSignUp((prev) => !prev);
                  setSignupStep(1);
                  setJoinConfig(null);
                }}
                className="w-full text-sm text-blue-600 hover:text-blue-700 font-semibold"
              >
                {isSignUp ? 'Already have an account? Log in' : 'Need an account? Sign up'}
              </button>
              {authError && (
                <p className="text-sm text-red-600 text-center font-medium">{authError}</p>
              )}
              {formError && (
                <p className="text-sm text-red-600 text-center font-medium">{formError}</p>
              )}
              {authLoading && (
                <p className="text-sm text-gray-500 text-center font-medium">Signing in...</p>
              )}
              
              <div className="flex items-center justify-center gap-2 pt-4 opacity-50">
                <Shield size={14} className="text-gray-400" />
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Secure School Login</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;