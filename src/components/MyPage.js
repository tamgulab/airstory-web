import React, { useMemo, useState } from 'react';
import { Settings, HelpCircle, Shield, LogOut, Edit2, Save, X, Globe, Building2, Users } from 'lucide-react';
import { changePassword, updateAccountProfile } from '../api/auth';

// My Page shows the user's GLOBAL account profile - the same in every workspace. Nothing here is
// workspace-scoped: identity (display name / title / bio / email), password, and the read-only
// list of workspaces the account belongs to. Per-class placement and the class roster live in the
// workspace's own views (Manage Classes / Raw Data), not here.
//
// Account identity + global profile come from App (which already fetched /auth/me), passed as
// props - so there is no per-mount network round trip here.

const initialsFrom = (name) => {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  if (parts.length === 1 && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
  return 'ME';
};

const KIND_META = {
  public: { label: 'Public', Icon: Globe, badge: 'bg-sky-100 text-sky-700' },
  school: { label: 'School', Icon: Building2, badge: 'bg-purple-100 text-purple-700' },
  class: { label: 'Class', Icon: Users, badge: 'bg-blue-100 text-blue-700' },
};

const MyPage = ({
  theme,
  onLogout,
  memberships = [],
  account,
  profile = { display_name: '', title: '', bio: '' },
  onProfileSaved,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState({ displayName: '', title: '', bio: '' });
  const [saveError, setSaveError] = useState('');
  const [saveBusy, setSaveBusy] = useState(false);

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordEmail, setPasswordEmail] = useState('');
  const [passwordNew, setPasswordNew] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);

  // Data arrives via props from App's /auth/me sync. `account` is null only in the brief window
  // before that first sync completes (e.g. deep-linking straight to My Page) - show skeletons then.
  const loading = !account;
  const email = account?.email || '';
  const displayName = profile.display_name || account?.full_name || 'Your name';

  const roleAcrossWorkspaces = useMemo(() => {
    if (memberships.some((m) => m.role === 'teacher')) return 'teacher';
    return memberships.length ? 'student' : '';
  }, [memberships]);

  const openEdit = () => {
    setDraft({
      displayName: profile.display_name || account?.full_name || '',
      title: profile.title || '',
      bio: profile.bio || '',
    });
    setSaveError('');
    setIsEditing(true);
  };

  const handleSave = async () => {
    setSaveBusy(true);
    setSaveError('');
    try {
      const res = await updateAccountProfile({
        displayName: draft.displayName.trim(),
        title: draft.title.trim(),
        bio: draft.bio.trim(),
      });
      setIsEditing(false);
      onProfileSaved?.(res.profile); // lift the new profile into App state (source of truth)
    } catch (e) {
      setSaveError(e.message || 'Could not save your profile.');
    } finally {
      setSaveBusy(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordError('');
    if (!passwordEmail.trim() || !passwordNew || passwordNew.length < 8) {
      setPasswordError('Use your account email and a new password (at least 8 characters).');
      return;
    }
    setPasswordBusy(true);
    try {
      await changePassword(passwordEmail, passwordNew);
      setShowPasswordModal(false);
      await onLogout?.();
    } catch (err) {
      setPasswordError(err.message || 'Could not change password.');
    } finally {
      setPasswordBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Page</h1>
          <p className="text-gray-600">Your account — the same in every workspace</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
            <div className="text-center mb-6">
              {loading ? (
                <>
                  <div className="w-24 h-24 mx-auto rounded-full bg-gray-200 animate-pulse mb-4" />
                  <div className="h-6 w-32 mx-auto rounded bg-gray-200 animate-pulse mb-2" />
                  <div className="h-4 w-20 mx-auto rounded bg-gray-100 animate-pulse" />
                </>
              ) : (
                <>
                  <div
                    className="w-24 h-24 mx-auto rounded-full flex items-center justify-center text-3xl font-bold text-white mb-4"
                    style={{ background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.primary}CC 100%)` }}
                  >
                    {initialsFrom(displayName)}
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 mb-1">{displayName}</h2>
                  {profile.title ? (
                    <p className="text-sm text-gray-600">{profile.title}</p>
                  ) : (
                    <p className="text-sm text-gray-400">No title set</p>
                  )}
                </>
              )}
            </div>

            <div className="space-y-3 py-4 border-t border-gray-200">
              <div className="flex items-start justify-between text-sm gap-3">
                <span className="text-gray-600 shrink-0">Email</span>
                <span className="font-medium text-gray-900 text-right break-all">{email || '—'}</span>
              </div>
              <div className="flex items-start justify-between text-sm gap-3">
                <span className="text-gray-600 shrink-0">Bio</span>
                <span className="font-medium text-gray-900 text-right">{profile.bio || '—'}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Workspaces</span>
                <span className="font-medium text-gray-900">{memberships.length}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={openEdit}
              disabled={loading}
              className={`w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 ${theme.bg} ${theme.hover} text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <Edit2 className="w-4 h-4" />
              Edit Profile
            </button>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200 mt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <button className="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-700 hover:bg-gray-50 rounded-lg transition-colors">
                <HelpCircle className="w-5 h-5 text-gray-400" />
                <span className="text-sm font-medium">Help & Support</span>
              </button>
              <button className="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-700 hover:bg-gray-50 rounded-lg transition-colors">
                <Shield className="w-5 h-5 text-gray-400" />
                <span className="text-sm font-medium">Privacy Settings</span>
              </button>
              <button
                onClick={onLogout}
                className="w-full flex items-center gap-3 px-4 py-3 text-left text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <LogOut className="w-5 h-5" />
                <span className="text-sm font-medium">Sign Out</span>
              </button>
            </div>
          </div>
        </div>

        {/* Settings + Workspaces */}
        <div className="lg:col-span-2 space-y-6">
          {/* Account Settings */}
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
            <div className="flex items-center gap-3 mb-6">
              <div className={`w-10 h-10 ${theme.bg} rounded-lg flex items-center justify-center`}>
                <Settings className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Account Settings</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Display name</label>
                <input
                  type="text"
                  value={loading ? '' : displayName}
                  disabled
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-500 cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">Use "Edit Profile" to change your name, title, or bio.</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
                <input
                  type="email"
                  value={email}
                  disabled
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-500 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
                <button
                  type="button"
                  onClick={() => {
                    setPasswordError('');
                    setPasswordNew('');
                    setPasswordEmail(email);
                    setShowPasswordModal(true);
                  }}
                  className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  Change Password
                </button>
              </div>
            </div>
          </div>

          {/* Your Workspaces */}
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
            <div className="flex items-center gap-3 mb-6">
              <div className={`w-10 h-10 ${theme.bg} rounded-lg flex items-center justify-center`}>
                <Users className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Your Workspaces</h3>
            </div>

            {memberships.length === 0 ? (
              <p className="text-sm text-gray-500">You are not a member of any workspace yet.</p>
            ) : (
              <div className="space-y-2">
                {memberships.map((m) => {
                  const meta = KIND_META[m.kind] || KIND_META.class;
                  const { Icon } = meta;
                  return (
                    <div
                      key={m.workspace_id}
                      className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                      <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 shrink-0">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{m.workspace_name}</p>
                        {m.school_name ? (
                          <p className="text-xs text-gray-500 truncate">{m.school_name}</p>
                        ) : null}
                      </div>
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${meta.badge}`}>
                        {meta.label}
                      </span>
                      <span className="text-xs font-semibold px-2 py-1 rounded-full bg-gray-100 text-gray-600 capitalize">
                        {m.role}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Guide */}
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              {roleAcrossWorkspaces === 'teacher' ? 'Teacher Guide' : 'Getting Started'}
            </h3>
            {roleAcrossWorkspaces === 'teacher' ? (
              <ul className="text-sm text-gray-700 space-y-2 list-disc pl-5">
                <li>Start in Manage Classes to confirm period/group structure and set your school.</li>
                <li>Use Heat Map for a class-level overview, then Raw Data for detailed validation.</li>
                <li>Review student annotation asterisks (*) before exporting reports.</li>
              </ul>
            ) : (
              <ul className="text-sm text-gray-700 space-y-2 list-disc pl-5">
                <li>Start in Heat Map to understand current conditions.</li>
                <li>Use Raw Data to review measurements and add responsible edit notes.</li>
                <li>Use Analysis to summarize trends and add reflection insights.</li>
              </ul>
            )}
          </div>

          {/* About */}
          <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-6 shadow-lg border border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 mb-4">About Air Story</h3>
            <div className="space-y-3 text-sm text-gray-600">
              <p>
                <strong className="text-gray-900">Version:</strong> 1.0.0
              </p>
              <p>
                Air Story is a comprehensive air quality monitoring platform designed for schools and communities.
              </p>
              <div className="flex flex-wrap gap-4 mt-4">
                <button type="button" className="text-blue-600 hover:text-blue-700 font-medium bg-transparent border-0 p-0 cursor-pointer">
                  Terms of Service
                </button>
                <button type="button" className="text-blue-600 hover:text-blue-700 font-medium bg-transparent border-0 p-0 cursor-pointer">
                  Privacy Policy
                </button>
                <button type="button" className="text-blue-600 hover:text-blue-700 font-medium bg-transparent border-0 p-0 cursor-pointer">
                  Contact
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Profile Modal — edits the GLOBAL profile */}
      {isEditing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => !saveBusy && setIsEditing(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className={`${theme.bg} text-white p-6 rounded-t-2xl flex items-center justify-between`}>
              <h3 className="text-xl font-bold">Edit Profile</h3>
              <button onClick={() => !saveBusy && setIsEditing(false)} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Display name</label>
                <input
                  type="text"
                  value={draft.displayName}
                  maxLength={120}
                  onChange={(e) => setDraft({ ...draft, displayName: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Title</label>
                <input
                  type="text"
                  value={draft.title}
                  maxLength={80}
                  placeholder="e.g. Student, Instructor, Researcher"
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Bio</label>
                <textarea
                  value={draft.bio}
                  maxLength={500}
                  rows={4}
                  placeholder="A short description about you"
                  onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                />
              </div>
            </div>

            {saveError ? (
              <div className="px-6 pb-2">
                <p className="text-sm text-red-600">{saveError}</p>
              </div>
            ) : null}
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                type="button"
                onClick={() => !saveBusy && setIsEditing(false)}
                disabled={saveBusy}
                className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saveBusy}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 ${theme.bg} ${theme.hover} text-white font-semibold rounded-lg transition-colors disabled:opacity-50`}
              >
                <Save className="w-4 h-4" />
                {saveBusy ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPasswordModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => !passwordBusy && setShowPasswordModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`${theme.bg} text-white p-6 rounded-t-2xl flex items-center justify-between`}>
              <h3 className="text-xl font-bold">Change password</h3>
              <button
                type="button"
                onClick={() => !passwordBusy && setShowPasswordModal(false)}
                className="p-1 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handlePasswordSubmit} className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                Confirm your email and choose a new password. You will be signed out and can log in again.
              </p>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  required
                  value={passwordEmail}
                  onChange={(e) => setPasswordEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  autoComplete="username"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">New password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={passwordNew}
                  onChange={(e) => setPasswordNew(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  autoComplete="new-password"
                />
              </div>
              {passwordError ? <p className="text-sm text-red-600">{passwordError}</p> : null}
              <button
                type="submit"
                disabled={passwordBusy}
                className={`w-full py-3 rounded-lg font-semibold text-white ${theme.bg} ${theme.hover} disabled:opacity-50`}
              >
                {passwordBusy ? 'Updating…' : 'Update password'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyPage;
