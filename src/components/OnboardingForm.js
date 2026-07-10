import React, { useEffect, useState } from 'react';
import { ArrowRight, GraduationCap, Users } from 'lucide-react';
import { getInvitePreview } from '../api/auth';

/**
 * First-time onboarding for a user who just signed in (e.g. with Google) but has no app account
 * yet. There are no standalone accounts:
 *  - With an invite token: they join the inviting workspace (role comes from the invitation),
 *    so they only confirm their name.
 *  - Without one: they name a new workspace and become its teacher.
 */
const OnboardingForm = ({ defaultName = '', email = '', inviteToken = '', onSubmit, onCancel, submitting, error }) => {
  const [fullName, setFullName] = useState(defaultName);
  const [workspaceName, setWorkspaceName] = useState('');
  const [invitePreview, setInvitePreview] = useState(null);
  const [inviteError, setInviteError] = useState('');
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    if (!inviteToken) return undefined;
    let cancelled = false;
    getInvitePreview(inviteToken)
      .then((data) => {
        if (!cancelled) setInvitePreview(data);
      })
      .catch((e) => {
        if (!cancelled) setInviteError(e.message || 'This invite link is not valid.');
      });
    return () => {
      cancelled = true;
    };
  }, [inviteToken]);

  const joining = Boolean(inviteToken);
  const emailMismatch =
    joining && invitePreview && email &&
    String(invitePreview.email).toLowerCase() !== email.toLowerCase();

  const handleSubmit = () => {
    setLocalError('');
    if (!fullName.trim() || fullName.trim().length < 2) {
      setLocalError('Please enter your full name.');
      return;
    }
    if (!joining && workspaceName.trim().length < 2) {
      setLocalError('Please name your workspace (e.g. "Lincoln High – Ms. Rivera").');
      return;
    }
    onSubmit({
      fullName: fullName.trim(),
      workspaceName: joining ? undefined : workspaceName.trim(),
    });
  };

  const inputClass =
    'w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 py-4 focus:outline-none focus:border-blue-500 focus:bg-white transition-all font-medium';

  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-3xl p-8 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200">
      <div className="text-center">
        <div className="mx-auto w-20 h-20 bg-blue-50 rounded-2xl flex items-center justify-center mb-4 text-blue-600">
          {joining && invitePreview?.role === 'student' ? <GraduationCap size={40} /> : <Users size={40} />}
        </div>
        <h2 className="text-2xl font-black text-gray-900">Finish setting up</h2>
        <p className="text-gray-500 font-medium mt-1">
          {email ? `Signed in as ${email}. ` : ''}
          {joining ? '' : "You'll create a workspace and can invite others."}
        </p>
      </div>

      {joining && invitePreview && !emailMismatch && (
        <div className="rounded-2xl bg-blue-50 border border-blue-100 px-4 py-3">
          <p className="text-xs font-bold text-blue-400 uppercase tracking-widest">You've been invited</p>
          <p className="text-lg font-black text-blue-700">
            {invitePreview.workspaceName} · {invitePreview.role === 'teacher' ? 'Teacher' : 'Student'}
          </p>
          {invitePreview.period && (
            <p className="text-xs text-gray-500 font-medium mt-1">Period {invitePreview.period}</p>
          )}
        </div>
      )}

      {joining && emailMismatch && (
        <p className="text-sm text-red-600 text-center font-medium">
          This invitation was sent to {invitePreview.email}, but you are signed in as {email}.
          Sign out and continue with the invited email.
        </p>
      )}

      {joining && inviteError && (
        <p className="text-sm text-red-600 text-center font-medium">{inviteError}</p>
      )}

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Full Name</label>
          <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} />
        </div>

        {!joining && (
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Workspace Name</label>
            <input
              type="text"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              placeholder='e.g. "Lincoln High – Ms. Rivera"'
              className={inputClass}
            />
            <p className="text-xs text-gray-500 font-medium ml-1">
              Joining a class instead? Use the invite link your teacher shared.
            </p>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting || Boolean(emailMismatch) || (joining && !invitePreview)}
        className="w-full py-4 text-lg rounded-xl font-bold flex items-center justify-center gap-2 bg-blue-600 text-white hover:bg-blue-700 shadow-md active:scale-95 transition-all disabled:opacity-60"
      >
        {submitting ? 'Setting up…' : 'Create my account'}
        <ArrowRight size={22} />
      </button>

      {(localError || error) && (
        <p className="text-sm text-red-600 text-center font-medium">{localError || error}</p>
      )}

      {onCancel && (
        <button type="button" onClick={onCancel} className="w-full text-sm text-gray-500 hover:text-gray-700 font-semibold">
          Cancel and sign out
        </button>
      )}
    </div>
  );
};

export default OnboardingForm;
