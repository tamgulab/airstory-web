import React, { useState } from 'react';
import { ArrowRight, GraduationCap, Users } from 'lucide-react';
import { getJoinCodeConfig } from '../api/auth';

/**
 * First-time onboarding for a user who just signed in (e.g. with Google) but has no app account
 * yet. They confirm their name and pick a role:
 *  - Teacher: name only -> creates a new workspace.
 *  - Student: enters a teacher's join code -> the code fixes their class period; the teacher
 *    assigns their group later. The student never picks a period or group here.
 */
const OnboardingForm = ({ defaultName = '', email = '', onSubmit, onCancel, submitting, error }) => {
  const [fullName, setFullName] = useState(defaultName);
  const [role, setRole] = useState('student');
  const [joinCode, setJoinCode] = useState('');
  const [joinConfig, setJoinConfig] = useState(null);
  const [checking, setChecking] = useState(false);
  const [localError, setLocalError] = useState('');

  const codeValid = /^[A-Z0-9]{5}$/.test(joinCode.trim().toUpperCase());

  const verifyCode = async () => {
    setLocalError('');
    if (!codeValid) {
      setLocalError('Join code must be exactly 5 letters/numbers.');
      return;
    }
    setChecking(true);
    try {
      const config = await getJoinCodeConfig(joinCode.trim().toUpperCase());
      setJoinConfig(config);
    } catch (e) {
      setJoinConfig(null);
      setLocalError(e.message || 'Invalid join code.');
    } finally {
      setChecking(false);
    }
  };

  const handleSubmit = () => {
    setLocalError('');
    if (!fullName.trim() || fullName.trim().length < 2) {
      setLocalError('Please enter your full name.');
      return;
    }
    if (role === 'student') {
      if (!codeValid) {
        setLocalError('Enter the join code from your teacher.');
        return;
      }
      if (!joinConfig) {
        setLocalError('Please verify your join code first.');
        return;
      }
    }
    onSubmit({
      fullName: fullName.trim(),
      role,
      joinCode: role === 'student' ? joinCode.trim().toUpperCase() : undefined,
    });
  };

  const inputClass =
    'w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 py-4 focus:outline-none focus:border-blue-500 focus:bg-white transition-all font-medium';

  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-3xl p-8 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200">
      <div className="text-center">
        <div className="mx-auto w-20 h-20 bg-blue-50 rounded-2xl flex items-center justify-center mb-4 text-blue-600">
          {role === 'student' ? <GraduationCap size={40} /> : <Users size={40} />}
        </div>
        <h2 className="text-2xl font-black text-gray-900">Finish setting up</h2>
        <p className="text-gray-500 font-medium mt-1">
          {email ? `Signed in as ${email}. ` : ''}Tell us who you are.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-xs font-bold text-black uppercase tracking-widest ml-1">Full Name</label>
          <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-black uppercase tracking-widest ml-1">I am a…</label>
          <div className="grid grid-cols-2 gap-3">
            {['student', 'teacher'].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => { setRole(r); setLocalError(''); }}
                className={`py-3 rounded-2xl font-bold text-sm capitalize transition-all border-2 ${
                  role === r ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {role === 'student' && (
          <div className="space-y-2">
            <label className="text-xs font-bold text-black uppercase tracking-widest ml-1">Join Code</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={joinCode}
                onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setJoinConfig(null); }}
                placeholder="5-letter/number class code"
                maxLength={5}
                className={`${inputClass} tracking-wider uppercase`}
              />
              <button
                type="button"
                onClick={verifyCode}
                disabled={!codeValid || checking}
                className="shrink-0 px-4 rounded-2xl font-bold text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50"
              >
                {checking ? '…' : 'Verify'}
              </button>
            </div>
            {joinConfig && (
              <p className="text-sm text-green-600 font-semibold ml-1">
                Joining {joinConfig.instructor ? `${joinConfig.instructor}'s class` : 'class'}
                {joinConfig.period ? ` · Period ${joinConfig.period}` : ''}. Your teacher will assign your group.
              </p>
            )}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting}
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
