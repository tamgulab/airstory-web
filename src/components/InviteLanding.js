import React, { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle, GraduationCap, Mail, Users, XCircle } from 'lucide-react';
import { getInvitePreview } from '../api/auth';

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

const inputClass =
  "w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 py-4 focus:outline-none focus:border-blue-500 focus:bg-white transition-all font-medium";

/**
 * Landing page for /join/<token> invite links.
 * Logged out: preview the invitation, then create an account or log in (App keeps the token
 * pending and shows the accept step after login). Logged in: accept into the workspace.
 */
const InviteLanding = ({
  token,
  isLoggedIn,
  currentEmail = '',
  onRegister,
  onLogin,
  onGoogleLogin,
  onAccept,
  onDismiss,
  onLogout,
  authError,
  authLoading,
}) => {
  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [tab, setTab] = useState('signup'); // 'signup' | 'login'
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoadingPreview(true);
    setPreviewError('');
    getInvitePreview(token)
      .then((data) => {
        if (!cancelled) setPreview(data);
      })
      .catch((e) => {
        if (!cancelled) setPreviewError(e.message || 'This invite link is not valid.');
      })
      .finally(() => {
        if (!cancelled) setLoadingPreview(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSubmit = () => {
    setFormError('');
    if (tab === 'signup') {
      if (fullName.trim().length < 2) {
        setFormError('Please enter your full name.');
        return;
      }
      if (password.length < 8) {
        setFormError('Password must be at least 8 characters.');
        return;
      }
      onRegister({ email: preview.email, password, fullName, inviteToken: token });
    } else {
      onLogin({ email: preview.email, password });
    }
  };

  const card = (children) => (
    <div className="w-full max-w-md mx-auto bg-white rounded-3xl p-8 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200">
      {children}
    </div>
  );

  if (loadingPreview) {
    return card(
      <p className="text-center text-gray-500 font-medium py-8">Checking your invitation…</p>
    );
  }

  if (previewError) {
    return card(
      <>
        <div className="mx-auto w-20 h-20 bg-red-50 rounded-full flex items-center justify-center text-red-500">
          <XCircle size={40} />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-black text-gray-900 mb-2">Invitation Unavailable</h2>
          <p className="text-gray-600 font-medium">{previewError}</p>
          <p className="text-gray-500 text-sm font-medium mt-2">
            Ask your teacher to send you a new invite link.
          </p>
        </div>
        <Button variant="secondary" onClick={onDismiss} className="w-full">
          Go to Sign In
        </Button>
      </>
    );
  }

  const roleLabel = preview.role === 'teacher' ? 'Teacher' : 'Student';
  const inviteSummary = (
    <>
      <div className="mx-auto w-20 h-20 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
        {preview.role === 'teacher' ? <Users size={40} /> : <GraduationCap size={40} />}
      </div>
      <div className="text-center">
        <h2 className="text-2xl font-black text-gray-900">
          Join <span className="text-blue-600">{preview.workspaceName}</span>
        </h2>
        <p className="text-gray-600 font-medium mt-1">as a {roleLabel}</p>
      </div>
      <div className="bg-gray-50 p-5 rounded-2xl border border-gray-200 space-y-3">
        <div className="flex items-center gap-3">
          <Mail size={18} className="text-gray-400 shrink-0" />
          <div>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Invited Email</p>
            <p className="font-bold text-gray-900">{preview.email}</p>
          </div>
        </div>
        {preview.period && (
          <div>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Class Period</p>
            <p className="font-bold text-blue-700">{preview.period}</p>
          </div>
        )}
        {preview.invitedBy && (
          <p className="text-sm text-gray-500 font-medium">Invited by {preview.invitedBy}</p>
        )}
      </div>
    </>
  );

  if (isLoggedIn) {
    const emailMismatch =
      currentEmail && currentEmail.toLowerCase() !== String(preview.email).toLowerCase();
    return card(
      <>
        {inviteSummary}
        {emailMismatch ? (
          <>
            <p className="text-sm text-red-600 text-center font-medium">
              This invitation was sent to {preview.email}, but you are signed in as {currentEmail}.
              Sign out and continue with the invited email.
            </p>
            <Button variant="secondary" onClick={onLogout} className="w-full">
              Sign Out
            </Button>
          </>
        ) : (
          <Button variant="success" onClick={onAccept} disabled={authLoading} className="w-full py-4 text-lg">
            <CheckCircle size={22} /> {authLoading ? 'Joining…' : 'Accept Invitation'}
          </Button>
        )}
        {authError && <p className="text-sm text-red-600 text-center font-medium">{authError}</p>}
        <button
          type="button"
          onClick={onDismiss}
          className="w-full text-sm text-gray-500 hover:text-gray-700 font-semibold"
        >
          Not now
        </button>
      </>
    );
  }

  return card(
    <>
      {inviteSummary}

      <div className="grid grid-cols-2 p-1.5 bg-gray-100 rounded-[2rem]">
        <button
          type="button"
          onClick={() => { setTab('signup'); setFormError(''); }}
          className={`py-3 rounded-[1.75rem] font-bold text-sm transition-all duration-300 ${tab === 'signup' ? 'bg-white text-blue-600 shadow-lg scale-[1.02]' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Create Account
        </button>
        <button
          type="button"
          onClick={() => { setTab('login'); setFormError(''); }}
          className={`py-3 rounded-[1.75rem] font-bold text-sm transition-all duration-300 ${tab === 'login' ? 'bg-white text-blue-600 shadow-lg scale-[1.02]' : 'text-gray-500 hover:text-gray-700'}`}
        >
          I Have an Account
        </button>
      </div>

      <div className="space-y-4">
        {tab === 'signup' && (
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={inputClass}
            />
          </div>
        )}
        <div className="space-y-2">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Email Address</label>
          <input type="email" value={preview.email} readOnly disabled className={`${inputClass} text-gray-500`} />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Password</label>
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      <Button onClick={handleSubmit} disabled={authLoading} className="w-full py-4 text-lg">
        {tab === 'signup' ? 'Create Account & Join' : 'Log In & Join'}
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
          <p className="text-xs text-gray-400 text-center font-medium">
            Use the Google account for {preview.email}.
          </p>
        </>
      )}

      {formError && <p className="text-sm text-red-600 text-center font-medium">{formError}</p>}
      {authError && <p className="text-sm text-red-600 text-center font-medium">{authError}</p>}
      {authLoading && <p className="text-sm text-gray-500 text-center font-medium">Working…</p>}

      <button
        type="button"
        onClick={onDismiss}
        className="w-full text-sm text-gray-500 hover:text-gray-700 font-semibold"
      >
        Not now — go to regular sign in
      </button>
    </>
  );
};

export default InviteLanding;
