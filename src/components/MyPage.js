import React, { useMemo, useState } from 'react';
import { Edit2, Globe, Building2, Users } from 'lucide-react';
import { changePassword, updateAccountProfile } from '../api/auth';
import Button from './ui/Button';
import Card from './ui/Card';
import Avatar from './ui/Avatar';

// My Page shows the user's GLOBAL account profile - the same in every workspace. Nothing here is
// workspace-scoped: identity (display name / title / bio / email), password, and the list of
// workspaces the account belongs to. Per-class placement and the class roster live in the
// workspace's own views (Manage Classes / Raw Data), not here.

const KIND_META = {
  public: { label: 'Public', Icon: Globe },
  school: { label: 'School', Icon: Building2 },
  class: { label: 'Class', Icon: Users },
};

const MyPage = ({
  onLogout,
  memberships = [],
  account,
  profile = { display_name: '', title: '', bio: '' },
  onProfileSaved,
  switchWorkspace,
  workspaceFullName,
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
      onProfileSaved?.(res.profile);
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
      <div className="page__head">
        <h1 className="text-page text-fg">My page</h1>
        <p className="text-small text-secondary mt-1">Your account — the same in every workspace</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6 items-start">
        <div className="space-y-6">
          <Card className="text-center">
            {loading ? (
              <>
                <div className="w-[88px] h-[88px] mx-auto rounded-full bg-canvas animate-pulse mb-4" />
                <div className="h-6 w-32 mx-auto rounded bg-canvas animate-pulse mb-2" />
                <div className="h-4 w-20 mx-auto rounded bg-canvas animate-pulse" />
              </>
            ) : (
              <>
                <Avatar className="mx-auto mb-4" style={{ width: 88, height: 88 }} />
                <h2 className="text-tile text-fg">{displayName}</h2>
                <p className="text-small text-muted mt-1">{profile.title || 'No title set'}</p>
              </>
            )}

            <div className="space-y-3 py-4 mt-4 border-t border-hairline-soft text-left">
              <div className="flex items-start justify-between text-small gap-3">
                <span className="text-secondary shrink-0">Email</span>
                <span className="font-medium text-fg text-right break-all">{email || '—'}</span>
              </div>
              <div className="flex items-start justify-between text-small gap-3">
                <span className="text-secondary shrink-0">Bio</span>
                <span className="font-medium text-fg text-right">{profile.bio || '—'}</span>
              </div>
              <div className="flex items-center justify-between text-small">
                <span className="text-secondary">Workspaces</span>
                <span className="font-medium text-fg">{memberships.length}</span>
              </div>
            </div>

            <Button type="button" wide className="mt-4" onClick={openEdit} disabled={loading}>
              <Edit2 className="w-4 h-4" aria-hidden="true" />
              Edit Profile
            </Button>
          </Card>

          <Card>
            <h3 className="text-tile text-fg mb-4">Quick actions</h3>
            <div className="space-y-2">
              <Button type="button" variant="neutral" wide>Help & Support</Button>
              <Button type="button" variant="neutral" wide>Privacy Settings</Button>
              <Button type="button" variant="danger" wide onClick={onLogout}>Sign Out</Button>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h3 className="text-tile text-fg mb-6">Account settings</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-small font-semibold text-secondary mb-2">Display name</label>
                <input
                  type="text"
                  value={loading ? '' : displayName}
                  disabled
                  className="w-full px-4 py-3 bg-canvas border border-hairline rounded-ctrl text-secondary cursor-not-allowed"
                />
                <p className="text-cap text-muted mt-1">Use Edit Profile to change your name, title, or bio.</p>
              </div>
              <div>
                <label className="block text-small font-semibold text-secondary mb-2">Email address</label>
                <input
                  type="email"
                  value={email}
                  disabled
                  className="w-full px-4 py-3 bg-canvas border border-hairline rounded-ctrl text-secondary cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-small font-semibold text-secondary mb-2">Password</label>
                <Button
                  type="button"
                  variant="neutral"
                  size="sm"
                  onClick={() => {
                    setPasswordError('');
                    setPasswordEmail(email);
                    setPasswordNew('');
                    setShowPasswordModal(true);
                  }}
                >
                  Change password
                </Button>
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="text-tile text-fg mb-4">Your workspaces</h3>
            {memberships.length === 0 ? (
              <p className="text-small text-muted">No workspaces yet.</p>
            ) : (
              <div className="divide-y divide-hairline-soft">
                {memberships.map((m) => {
                  const meta = KIND_META[m.kind] || KIND_META.class;
                  const Icon = meta.Icon;
                  const label = workspaceFullName ? workspaceFullName(m) : m.workspace_name;
                  return (
                    <button
                      key={m.workspace_id}
                      type="button"
                      onClick={() => switchWorkspace?.(m.workspace_id)}
                      className="w-full flex items-center gap-3 py-3 text-left hover:bg-canvas transition-colors -mx-1 px-1 rounded-ctrl"
                    >
                      <span className="w-8 h-8 rounded-full border border-hairline bg-canvas flex items-center justify-center text-muted shrink-0">
                        <Icon className="w-4 h-4" aria-hidden="true" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-small font-medium text-fg truncate">{label}</p>
                        {m.school_name ? (
                          <p className="text-cap text-muted truncate">{m.school_name}</p>
                        ) : null}
                      </div>
                      <span className="text-cap font-semibold text-secondary shrink-0">{meta.label}</span>
                      <span className="text-cap font-semibold text-muted capitalize shrink-0">{m.role}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>

          <Card>
            <h3 className="text-tile text-fg mb-3">
              {roleAcrossWorkspaces === 'teacher' ? 'Teacher guide' : 'Getting started'}
            </h3>
            {roleAcrossWorkspaces === 'teacher' ? (
              <div className="text-small text-secondary space-y-1.5">
                <p>Start in Manage Classes to confirm period/group structure and set your school.</p>
                <p>Use Heat Map for a class-level overview, then Raw Data for detailed validation.</p>
                <p>Review student annotation asterisks (*) before exporting reports.</p>
              </div>
            ) : (
              <div className="text-small text-secondary space-y-1.5">
                <p>Start in Heat Map to understand current conditions.</p>
                <p>Use Raw Data to review measurements and add responsible edit notes.</p>
                <p>Use Analysis to summarize trends and add reflection insights.</p>
              </div>
            )}
          </Card>
        </div>
      </div>

      {isEditing && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4" onClick={() => !saveBusy && setIsEditing(false)}>
          <div className="bg-surface rounded-card max-w-md w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-hairline-soft flex items-center justify-between">
              <h3 className="text-tile text-fg">Edit profile</h3>
              <button type="button" onClick={() => !saveBusy && setIsEditing(false)} className="p-1 text-muted hover:text-fg" aria-label="Close">
                <span className="text-body">×</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-small font-semibold text-secondary mb-2">Display name</label>
                <input
                  type="text"
                  value={draft.displayName}
                  maxLength={120}
                  onChange={(e) => setDraft({ ...draft, displayName: e.target.value })}
                  className="w-full px-4 py-3 border border-hairline rounded-ctrl bg-surface text-fg"
                />
              </div>
              <div>
                <label className="block text-small font-semibold text-secondary mb-2">Title</label>
                <input
                  type="text"
                  value={draft.title}
                  maxLength={80}
                  placeholder="e.g. Student, Instructor, Researcher"
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  className="w-full px-4 py-3 border border-hairline rounded-ctrl bg-surface text-fg"
                />
              </div>
              <div>
                <label className="block text-small font-semibold text-secondary mb-2">Bio</label>
                <textarea
                  value={draft.bio}
                  maxLength={500}
                  rows={4}
                  placeholder="A short description about you"
                  onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
                  className="w-full px-4 py-3 border border-hairline rounded-ctrl bg-surface text-fg resize-none"
                />
              </div>
              {saveError ? <p className="text-small text-aqi-unhealthy">{saveError}</p> : null}
            </div>
            <div className="p-6 border-t border-hairline-soft flex justify-end gap-2">
              <Button type="button" variant="neutral" onClick={() => !saveBusy && setIsEditing(false)} disabled={saveBusy}>
                Cancel
              </Button>
              <Button type="button" onClick={handleSave} disabled={saveBusy}>
                {saveBusy ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {showPasswordModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4"
          onClick={() => !passwordBusy && setShowPasswordModal(false)}
        >
          <div className="bg-surface rounded-card max-w-md w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-hairline-soft flex items-center justify-between">
              <h3 className="text-tile text-fg">Change password</h3>
              <button type="button" onClick={() => !passwordBusy && setShowPasswordModal(false)} className="p-1 text-muted hover:text-fg" aria-label="Close">
                <span className="text-body">×</span>
              </button>
            </div>
            <form onSubmit={handlePasswordSubmit} className="p-6 space-y-4">
              <p className="text-small text-secondary">
                Confirm your email and choose a new password. You will be signed out and can log in again.
              </p>
              <div>
                <label className="block text-small font-semibold text-secondary mb-2">Email</label>
                <input
                  type="email"
                  required
                  value={passwordEmail}
                  onChange={(e) => setPasswordEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-hairline rounded-ctrl bg-surface text-fg"
                  autoComplete="username"
                />
              </div>
              <div>
                <label className="block text-small font-semibold text-secondary mb-2">New password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={passwordNew}
                  onChange={(e) => setPasswordNew(e.target.value)}
                  className="w-full px-4 py-3 border border-hairline rounded-ctrl bg-surface text-fg"
                  autoComplete="new-password"
                />
              </div>
              {passwordError ? <p className="text-small text-aqi-unhealthy">{passwordError}</p> : null}
              <div className="flex justify-end">
                <Button type="submit" disabled={passwordBusy}>
                  {passwordBusy ? 'Updating…' : 'Update password'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyPage;
