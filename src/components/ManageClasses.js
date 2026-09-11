import React, { useEffect, useState } from 'react';
import { LockKeyhole, Trash2, MoveRight, X, Copy, Mail, Upload } from 'lucide-react';
import {
  buildInviteLink,
  createInvitations,
  getClassStructure,
  getInvitations,
  getRoster,
  removeStudent,
  resetStudentPassword,
  revokeInvitation,
  setWorkspaceSchool,
  updateClassStructure,
  updateStudentPlacement,
} from '../api/auth';
import { getSchools } from '../api/schools';
import { extractInviteEmails, parseInviteSpreadsheet } from '../utils/inviteSpreadsheet';
import ConfirmDialog from './ConfirmDialog';
import Button from './ui/Button';
import Card from './ui/Card';
import SchoolCombobox from './SchoolCombobox';

/** Prefer a full email; bare local-parts / codes get a clear no-domain label. */
function formatMemberContact(m) {
  const email = String(m?.email || '').trim();
  if (email.includes('@')) return email;
  const code = String(m?.student_code || email || m?.username || '').trim();
  if (!code) return '—';
  return code.includes('@') ? code : `${code} (no domain)`;
}

/** A student is assigned only once they have both a period and a real group. */
function needsGroupAssign(m) {
  if (!m?.period) return true;
  const g = String(m?.group_code || '').trim();
  return !g || g === 'G?' || g === '?';
}

export default function ManageClasses({
  workspaceId,
  theme,
  onGroupSelect,
  viewerProfile,
  onClassStructureChanged,
  onSchoolChanged,
}) {
  const [members, setMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmails, setInviteEmails] = useState('');
  const [invitePlacements, setInvitePlacements] = useState({}); // email -> { period, groupCode, fullName }
  const [inviteRole, setInviteRole] = useState('student');
  const [invitePeriod, setInvitePeriod] = useState('');
  const [inviteBusy, setInviteBusy] = useState(false);
  // After sending: { invitations: [...], skipped: [{email, reason}] } from the API.
  const [inviteResult, setInviteResult] = useState(null);
  const [revokeInviteTarget, setRevokeInviteTarget] = useState(null); // invitation pending revocation
  const [error, setError] = useState('');
  const [activeStudent, setActiveStudent] = useState(null);
  const [activeAction, setActiveAction] = useState('');
  const [draftPassword, setDraftPassword] = useState('');
  const [draftPeriod, setDraftPeriod] = useState('P1');
  const [draftGroup, setDraftGroup] = useState('G1');
  const [busy, setBusy] = useState(false);
  const [periodCount, setPeriodCount] = useState(1);
  // Per-period structure: the draft is an editable list of rows; the saved snapshot stays separate.
  // draft row: { name, groups, savedName }  (savedName === null => newly added in this draft)
  const [draftRows, setDraftRows] = useState([]);
  const [savedGroupCounts, setSavedGroupCounts] = useState({});
  // Actual period labels (e.g. P3, P5) when known; falls back to P1..Pn.
  const [periodLabels, setPeriodLabels] = useState(null);
  // Section 3: default visibility for new uploads/classes (public | school).
  const [defaultVisibility, setDefaultVisibility] = useState('school');
  const [copiedKey, setCopiedKey] = useState('');
  // Section 4/5/6 state
  const [shrink, setShrink] = useState(null); // { blockers:[{period,group,accounts,sessions}], hasMembers } | null
  const [removeTarget, setRemoveTarget] = useState(null); // account pending removal
  const [rosterPeriod, setRosterPeriod] = useState('all');
  const [showHelp, setShowHelp] = useState(false);
  // Refinement 3: drag-and-drop members between groups + undo toast.
  const [dragMember, setDragMember] = useState(null);
  const [dropTarget, setDropTarget] = useState(null); // `${period}-${group}` being hovered
  const [toast, setToast] = useState(null); // { message, undo } | null

  // Inline school editor (moved here from My Page — the class's school is a workspace-scoped setting).
  const [schoolEditing, setSchoolEditing] = useState(false);
  const [schoolInput, setSchoolInput] = useState('');
  const [schoolOptions, setSchoolOptions] = useState([]);
  const [schoolBusy, setSchoolBusy] = useState(false);
  const [schoolError, setSchoolError] = useState('');

  /** Copy text to the clipboard with per-item "Copied" feedback (keyed by invite id, etc.). */
  const copyText = async (text, key) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // clipboard may be unavailable (e.g. non-secure context); ignore
    }
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((c) => (c === key ? '' : c)), 1500);
  };

  const load = async () => {
    if (!workspaceId) return;
    try {
      const [roster, invites, structure] = await Promise.all([
        getRoster(workspaceId),
        getInvitations(workspaceId),
        getClassStructure(workspaceId),
      ]);
      setMembers(roster.members || []);
      setInvitations(invites.invitations || []);
      // TODO(backend): structure is still (periodCount, groupCount) — expand to uniform
      // per-period counts until the backend returns a per-period list.
      const bp = structure.periodCount || 1;
      const bg = structure.groupCount || 4;
      const bPeriods = Array.from({ length: bp }, (_, i) => `P${i + 1}`);
      const bCounts = {};
      bPeriods.forEach((p) => { bCounts[p] = bg; });
      setPeriodCount(bp);
      setSavedGroupCounts(bCounts);
      setPeriodLabels(bPeriods);
      setDraftRows(bPeriods.map((p) => ({ name: p, groups: bCounts[p], savedName: p })));
      setError('');
    } catch (e) {
      setError(e.message || 'Failed to load class management data.');
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);


  const doSaveStructure = async () => {
    const np = Number(periodCount);
    const active = draftRows.slice(0, np);
    const names = active.map((r) => (r.name || '').trim());
    if (names.some((n) => !n)) { setError('Period names cannot be empty.'); return; }
    if (new Set(names).size !== names.length) { setError('Period names must be unique.'); return; }

    try {
      setBusy(true);
      // TODO(backend): structure model needs a per-period list of { name, groupCount } with
      // rename support. Until then, send count + max group count as a compatibility shim.
      const ng = Math.max(1, ...active.map((r) => Number(r.groups) || 0));
      const updated = await updateClassStructure(workspaceId, { periodCount: np, groupCount: ng });
      setPeriodCount(updated.periodCount || np);
      setError('');
      onClassStructureChanged?.(updated);
    } catch (e) {
      setError(e.message || 'Failed to update class structure.');
    } finally {
      setBusy(false);
    }
  };

  // Section 4: block shrinking out a period/group that still has accounts or sessions.
  // Per-position vs the SAVED structure: a removed period (row beyond the count) flags ALL its
  // groups; a kept period flags only the groups beyond its reduced count. Members are keyed by
  // the SAVED period name (renames apply only after a clean save).
  const handleSaveClassStructure = () => {
    const activeCount = Number(periodCount);
    const blockers = [];
    savedPeriods.forEach((savedName, i) => {
      const row = draftRows[i];
      const keptCount = row && i < activeCount ? (Number(row.groups) || 0) : 0;
      groupsFor(savedName).forEach((g) => {
        if (Number(g.slice(1)) <= keptCount) return; // still within the kept range
        const acc = accountsByGroup[`${savedName} ${g}`] || 0;
        const sess = sessionsByGroup[`${savedName} ${g}`] || 0;
        if (acc > 0 || sess > 0) blockers.push({ period: savedName, group: g, accounts: acc, sessions: sess });
      });
    });
    if (blockers.length === 0) { doSaveStructure(); return; }
    setShrink({ blockers, hasMembers: blockers.some((b) => b.accounts > 0) });
  };

  // Period count input grows the draft rows live (new rows default to the P# pattern + 4 groups);
  // lowering keeps the rows but marks the tail for removal.
  const onPeriodCountChange = (val) => {
    setPeriodCount(val);
    const target = Number(val) || 0;
    setDraftRows((prev) => {
      if (target <= prev.length) return prev;
      const rows = [...prev];
      let maxNum = rows.reduce((mx, r) => Math.max(mx, parseInt(String(r.name).replace(/\D/g, ''), 10) || 0), 0);
      while (rows.length < target) {
        maxNum += 1;
        rows.push({ name: `P${maxNum}`, groups: 4, savedName: null });
      }
      return rows;
    });
  };

  const showToast = (message, undo) => {
    setToast({ message, undo });
    setTimeout(() => setToast((t) => (t && t.message === message ? null : t)), 5000);
  };

  // Refinement 3: drop a dragged member chip onto a group in the SAME period to move them.
  const handleGroupDrop = (period, group) => {
    const m = dragMember;
    setDragMember(null);
    setDropTarget(null);
    if (!m) return;
    if (m.period !== period) {
      showToast("Can't move between periods — a member belongs to one class-period.", null);
      return;
    }
    if (m.group_code === group) return;
    const fromGroup = m.group_code;
    const applyGroup = (g) => {
      setMembers((prev) => prev.map((x) => (x.id === m.id ? { ...x, group_code: g } : x)));
      updateStudentPlacement(workspaceId, m.id, { period, groupCode: g }).catch(() => {});
    };
    applyGroup(group);
    showToast(`Moved ${m.full_name || formatMemberContact(m)} to ${period} · ${group}`, () => applyGroup(fromGroup));
  };

  /** Open the invite modal, optionally prefilled for a specific period (from the Groups section). */
  const openInviteModal = ({ role = 'student', period = '' } = {}) => {
    setInviteEmails('');
    setInvitePlacements({});
    setInviteRole(role);
    setInvitePeriod(period);
    setInviteResult(null);
    setInviteOpen(true);
  };

  const doRemoveStudent = async (student) => {
    if (!student) return;
    try {
      setBusy(true);
      await removeStudent(workspaceId, student.id);
      await load();
      setRemoveTarget(null);
      setError('');
    } catch (e) {
      setError(e.message || 'Failed to remove student.');
    } finally {
      setBusy(false);
    }
  };

  const handleInviteSpreadsheet = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const { rows } = parseInviteSpreadsheet(String(reader.result || ''));
      if (!rows.length) {
        setError('No email addresses found. Use a CSV with a header row (name, email, period, group) then one student per line.');
        return;
      }
      const existing = extractInviteEmails(inviteEmails);
      const seen = new Set(existing);
      const mergedEmails = [...existing];
      const placements = { ...invitePlacements };
      for (const row of rows) {
        if (!seen.has(row.email)) {
          seen.add(row.email);
          mergedEmails.push(row.email);
        }
        if (row.period || row.groupCode || row.fullName) {
          placements[row.email] = {
            period: row.period,
            groupCode: row.groupCode,
            fullName: row.fullName,
          };
        }
      }
      setInviteEmails(mergedEmails.join('\n'));
      setInvitePlacements(placements);
      setError('');
    };
    reader.onerror = () => setError('Could not read that file.');
    reader.readAsText(file);
  };

  const handleInvite = async () => {
    const emails = extractInviteEmails(inviteEmails);
    if (!emails.length) {
      setError('Enter at least one email address (or upload a spreadsheet/CSV).');
      return;
    }
    const invitees = emails.map((email) => {
      const placed = invitePlacements[email] || {};
      return {
        email,
        period: inviteRole === 'student' ? (placed.period || invitePeriod || '') : '',
        groupCode: inviteRole === 'student' ? (placed.groupCode || '') : '',
        fullName: placed.fullName || '',
      };
    });
    try {
      setInviteBusy(true);
      const result = await createInvitations(workspaceId, {
        invitees,
        role: inviteRole,
      });
      setInviteResult(result);
      const created = result.invitations || [];
      setInvitations((prev) => [
        ...created,
        ...prev.filter((i) => !created.some((c) => c.id === i.id)),
      ]);
      setError('');
    } catch (e) {
      setError(e.message || 'Failed to create invitations.');
    } finally {
      setInviteBusy(false);
    }
  };

  const doRevokeInvitation = async (invite) => {
    if (!invite) return;
    try {
      setBusy(true);
      await revokeInvitation(workspaceId, invite.id);
      setInvitations((prev) => prev.map((i) => (i.id === invite.id ? { ...i, status: 'revoked' } : i)));
      setRevokeInviteTarget(null);
      setError('');
    } catch (e) {
      setError(e.message || 'Failed to revoke invitation.');
    } finally {
      setBusy(false);
    }
  };

  /** Display status: a pending invite past its expiry shows as expired (the server enforces it too). */
  const inviteStatus = (invite) => {
    if (invite.status === 'pending' && new Date(invite.expires_at) <= new Date()) return 'expired';
    return invite.status;
  };

  const handleResetPassword = async (student) => {
    if (!draftPassword) return;
    try {
      setBusy(true);
      await resetStudentPassword(workspaceId, student.id, draftPassword);
      setDraftPassword('');
      setActiveStudent(null);
      setActiveAction('');
      setError('');
      // eslint-disable-next-line no-alert
      alert(`Password reset for ${student.full_name}`);
    } catch (e) {
      setError(e.message || 'Failed to reset student password.');
    } finally {
      setBusy(false);
    }
  };

  const openStudentAction = (student, action) => {
    setActiveStudent(student);
    setActiveAction(action);
    setDraftPassword('');
    setDraftPeriod(student.period || 'P1');
    setDraftGroup(student.group_code || 'G1');
  };

  const handleMoveStudent = async () => {
    if (!activeStudent) return;
    try {
      setBusy(true);
      await updateStudentPlacement(workspaceId, activeStudent.id, { period: draftPeriod, groupCode: draftGroup });
      await load();
      setActiveStudent(null);
      setActiveAction('');
      setError('');
    } catch (e) {
      setError(e.message || 'Failed to move student.');
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveStudent = async () => {
    if (!activeStudent) return;
    try {
      setBusy(true);
      await removeStudent(workspaceId, activeStudent.id);
      await load();
      setActiveStudent(null);
      setActiveAction('');
      setError('');
    } catch (e) {
      setError(e.message || 'Failed to remove student.');
    } finally {
      setBusy(false);
    }
  };

  // Section 2: Class overview — derived from the SAVED structure + roster (not the draft inputs).
  const savedPeriods = (periodLabels && periodLabels.length)
    ? periodLabels
    : Array.from({ length: periodCount || 1 }, (_, i) => `P${i + 1}`);
  // Group labels for a period derive from its saved count (G1..Gn) — counts can differ per period.
  const groupsFor = (period) => Array.from({ length: savedGroupCounts[period] || 0 }, (_, i) => `G${i + 1}`);
  const studentMembers = members.filter((m) => m.role === 'student');
  const accountsByGroup = {};
  studentMembers.forEach((m) => {
    const key = `${m.period} ${m.group_code}`;
    accountsByGroup[key] = (accountsByGroup[key] || 0) + 1;
  });
  const totalGroupSlots = savedPeriods.reduce((sum, p) => sum + groupsFor(p).length, 0);
  let coveredGroups = 0;
  savedPeriods.forEach((p) => groupsFor(p).forEach((g) => {
    if (accountsByGroup[`${p} ${g}`] > 0) coveredGroups += 1;
  }));
  const coverageWarn = coveredGroups < totalGroupSlots;
  const hasSchool = Boolean(viewerProfile?.school && String(viewerProfile.school).trim());
  const teacherName = viewerProfile?.instructor || '—';

  // Open the inline school editor: seed the input and pull the school directory for the picker.
  const openSchoolEditor = () => {
    setSchoolError('');
    setSchoolInput(viewerProfile?.school || '');
    setSchoolEditing(true);
    getSchools()
      .then((data) => setSchoolOptions(data.schools || []))
      .catch(() => setSchoolOptions([]));
  };

  // Save the class's school. It maps this class to a school workspace, so it must be a directory
  // entry (not free text). onSchoolChanged re-syncs the account so the new school reflects here.
  const handleSaveSchool = async () => {
    setSchoolError('');
    const value = schoolInput.trim();
    const match = schoolOptions.find((s) => s.name.toLowerCase() === value.toLowerCase());
    if (!match) {
      setSchoolError('Pick a school from the list.');
      return;
    }
    setSchoolBusy(true);
    try {
      await setWorkspaceSchool(workspaceId, match.id);
      setSchoolEditing(false);
      await onSchoolChanged?.();
    } catch (e) {
      setSchoolError(e.message || 'Could not save school.');
    } finally {
      setSchoolBusy(false);
    }
  };

  // Detach the class from its school: members leave the school workspace (they keep Public).
  const handleRemoveSchool = async () => {
    setSchoolError('');
    setSchoolBusy(true);
    try {
      await setWorkspaceSchool(workspaceId, null);
      setSchoolInput('');
      setSchoolEditing(false);
      await onSchoolChanged?.();
    } catch (e) {
      setSchoolError(e.message || 'Could not remove school.');
    } finally {
      setSchoolBusy(false);
    }
  };

  // Sessions per (period, group) for THIS teacher's class — feeds shrink protection (Section 4).
  const sessionsByGroup = {};

  // Roster rows: one per (period, group) in the saved structure, filtered by the period filter (Section 5).
  const rosterRows = [];
  savedPeriods.forEach((period) => {
    if (rosterPeriod !== 'all' && rosterPeriod !== period) return;
    groupsFor(period).forEach((group) => {
      const accts = studentMembers.filter((m) => m.period === period && m.group_code === group);
      rosterRows.push({ period, group, accts });
    });
  });

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-page text-fg">Manage classes</h1>
            <button
              onClick={() => setShowHelp(true)}
              className="flex items-center justify-center w-6 h-6 rounded-full border border-hairline text-muted text-cap font-bold leading-none hover:bg-canvas hover:text-fg transition-colors"
              title="Teacher workflow"
              aria-label="Teacher workflow help"
            >
              ?
            </button>
          </div>
          <p className="text-small text-muted">Teacher controls for groups, invitations, and student access</p>
        </div>
        <div className="actions flex gap-2">
          <Button size="sm" variant="neutral" onClick={() => setShowHelp(true)}>Class help</Button>
          <Button size="sm" onClick={() => openInviteModal()}>Invite people</Button>
        </div>
      </div>
      {error && <p className="text-small text-aqi-unhealthy">{error}</p>}

      {/* Row 1: Class Overview (left) + Class Structure (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Class Overview — current saved state (read-only) */}
      <Card>
        <div className="flex items-start justify-between mb-1">
          <div>
            <h3 className="text-tile text-fg">Class overview</h3>
            <p className="text-small text-muted mt-1">Current saved structure</p>
          </div>
        </div>
        <div className="divide-y divide-hairline-soft mt-4">
          <div className="flex items-start justify-between gap-4 py-3">
            <p className="text-small text-muted">School · Teacher</p>
            <div className="text-right min-w-0 max-w-[70%]">
              {schoolEditing ? (
                <div className="text-left">
                  <SchoolCombobox
                    id="school-input"
                    value={schoolInput}
                    onChange={(v) => { setSchoolInput(v); setSchoolError(''); }}
                    options={schoolOptions.map((s) => s.name)}
                    placeholder="Search or select a school"
                    inputClassName="w-full px-3 py-2 border border-hairline rounded-ctrl bg-surface text-small text-fg"
                  />
                  <div className="flex flex-wrap justify-end gap-2 mt-2">
                    <Button type="button" size="sm" variant="neutral" onClick={() => { setSchoolEditing(false); setSchoolError(''); }} disabled={schoolBusy}>
                      Cancel
                    </Button>
                    {hasSchool && (
                      <Button type="button" size="sm" variant="danger" onClick={handleRemoveSchool} disabled={schoolBusy}>
                        Remove
                      </Button>
                    )}
                    <Button type="button" size="sm" onClick={handleSaveSchool} disabled={schoolBusy}>
                      {schoolBusy ? 'Saving…' : 'Save'}
                    </Button>
                  </div>
                  {schoolError ? (
                    <p className="text-cap text-aqi-unhealthy mt-1">{schoolError}</p>
                  ) : (
                    <p className="text-cap text-muted mt-1">
                      Sets the school for this whole class — its members join the school workspace.
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <p className="text-small font-medium text-fg">
                    {hasSchool ? viewerProfile.school : <span className="text-muted font-normal">Not set</span>}{' '}
                    <button
                      type="button"
                      onClick={openSchoolEditor}
                      className="text-small font-semibold text-link hover:underline"
                    >
                      (Edit)
                    </button>
                  </p>
                  <p className="text-cap text-muted mt-0.5">{teacherName}</p>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between gap-4 py-3">
            <p className="text-small text-muted">Periods</p>
            <p className="text-small font-medium text-fg">{savedPeriods.join(', ') || '—'}</p>
          </div>
          <div className="flex items-center justify-between gap-4 py-3">
            <p className="text-small text-muted">Groups per period</p>
            <p className="text-small font-medium text-fg">
              {savedPeriods.map((p) => `${p} · ${savedGroupCounts[p] || 0}`).join(', ') || '—'}
            </p>
          </div>
          <div className="flex items-center justify-between gap-4 py-3">
            <p className="text-small text-muted">Members joined</p>
            <p className="text-small font-medium text-fg">{studentMembers.length}</p>
          </div>
          <div className="flex items-start justify-between gap-4 py-3">
            <p className="text-small text-muted">Group coverage</p>
            <div className="text-right">
              <p className={`text-small font-medium ${coverageWarn ? 'text-aqi-usg' : 'text-aqi-good'}`}>
                {coveredGroups} of {totalGroupSlots}
              </p>
              {coverageWarn && <p className="text-cap text-muted mt-0.5">Some groups have no account</p>}
            </div>
          </div>
        </div>
      </Card>

        {/* Class Structure */}
        <Card>
          <h3 className="text-tile text-fg">Class structure</h3>
          <p className="text-small text-muted mt-1">Renaming a period updates its codes, roster, and groups when you save.</p>
          <div className="grid grid-cols-2 gap-4 mt-5 mb-4">
            <div className="field">
              <label className="block text-small text-secondary mb-1.5">Period count</label>
              <input
                type="number"
                min={1}
                max={12}
                value={periodCount}
                onChange={(e) => onPeriodCountChange(e.target.value)}
                className="w-full h-11 px-4 border border-hairline rounded-ctrl bg-surface text-fg text-body focus:outline-none focus:border-link focus:ring-4 focus:ring-[rgba(0,102,204,0.15)]"
              />
            </div>
            <div className="field">
              {/* Default reach for new uploads: 'school' (this school) or 'public' (everyone). */}
              <label className="block text-small text-secondary mb-1.5">Default visibility</label>
              <select
                value={defaultVisibility === 'group' ? 'school' : defaultVisibility}
                onChange={(e) => setDefaultVisibility(e.target.value)}
                className="w-full h-11 px-4 border border-hairline rounded-ctrl bg-surface text-fg text-body focus:outline-none focus:border-link focus:ring-4 focus:ring-[rgba(0,102,204,0.15)]"
              >
                <option value="school">School only</option>
                <option value="public">Public</option>
              </select>
            </div>
          </div>
          <div className="mb-4">
            <p className="text-small text-secondary mb-2">Periods &amp; groups <span className="text-muted">— draft, names are editable</span></p>
            <div className="space-y-2">
              {draftRows.map((row, i) => {
                const active = i < Number(periodCount);
                const isNew = row.savedName === null;
                const isRenamed = !isNew && (row.name || '').trim() !== row.savedName;
                const isResized = !isNew && Number(row.groups) !== (savedGroupCounts[row.savedName] || 0);
                return (
                  <div key={i} className={`flex items-center gap-2 ${active ? '' : 'opacity-70'}`}>
                    <input
                      type="text"
                      value={row.name}
                      maxLength={6}
                      onChange={(e) => setDraftRows((prev) => prev.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))}
                      className={`w-16 h-9 px-2 border rounded-ctrl text-small bg-surface text-fg ${active ? 'border-hairline' : 'border-aqi-unhealthy/40 line-through text-muted'}`}
                    />
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={row.groups}
                      disabled={!active}
                      onChange={(e) => setDraftRows((prev) => prev.map((r, j) => (j === i ? { ...r, groups: e.target.value } : r)))}
                      className="w-20 h-9 px-3 border border-hairline rounded-ctrl bg-surface text-fg disabled:bg-canvas disabled:text-muted"
                    />
                    <span className="text-small text-muted">groups</span>
                    {!active && <span className="text-cap px-1.5 py-0.5 rounded-pill bg-canvas text-aqi-unhealthy border border-hairline">will remove</span>}
                    {active && isNew && <span className="text-cap px-1.5 py-0.5 rounded-pill bg-canvas text-aqi-usg border border-hairline">new · unsaved</span>}
                    {active && !isNew && (isRenamed || isResized) && <span className="text-cap px-1.5 py-0.5 rounded-pill bg-canvas text-aqi-usg border border-hairline">unsaved</span>}
                  </div>
                );
              })}
            </div>
            {/* TODO(backend): structure model needs a per-period list of { name, groupCount } with
                rename support (renames propagate to members/codes). Propose in docs/openapi.yaml. */}
          </div>
          <Button disabled={busy} onClick={handleSaveClassStructure}>
            Save structure
          </Button>
          <p className="text-small text-muted mt-3">
            New uploads use the visibility selected here.
          </p>
        </Card>
      </div>

      {/* Row 2: Invitations — full width */}
      <Card>
        <div className="page__head flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="text-tile text-fg">Invitations</h3>
            <p className="text-small text-muted mt-1">
              Each student or co-teacher gets a personal join link.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => openInviteModal()}>
            <Mail className="w-4 h-4" />
            Invite people
          </Button>
        </div>
        <div className="tablewrap border border-hairline-soft rounded-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-small">
            <thead>
              <tr className="text-left text-cap font-semibold text-secondary bg-canvas">
                <th className="py-3 px-3.5">Email</th>
                <th className="py-3 px-3.5">Name</th>
                <th className="py-3 px-3.5">Role</th>
                <th className="py-3 px-3.5">Placement</th>
                <th className="py-3 px-3.5">Status</th>
                <th className="py-3 px-3.5">Expires</th>
                <th className="py-3 px-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline-soft">
              {invitations.map((inv) => {
                const status = inviteStatus(inv);
                const statusStyles = {
                  pending: 'bg-canvas text-link border border-hairline',
                  accepted: 'bg-canvas text-aqi-good border border-hairline',
                  revoked: 'bg-canvas text-secondary border border-hairline',
                  expired: 'bg-canvas text-aqi-usg border border-hairline',
                };
                return (
                  <tr key={inv.id}>
                    <td className="py-3 px-3.5 font-medium text-fg">{inv.email}</td>
                    <td className="py-3 px-3.5 text-secondary">{inv.full_name || '—'}</td>
                    <td className="py-3 px-3.5 capitalize">{inv.role}</td>
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      {inv.period || inv.group_code
                        ? `${inv.period || 'P?'} · ${inv.group_code || 'G?'}`
                        : '—'}
                    </td>
                    <td className="py-3 px-3.5">
                      <span className={`tag inline-block px-2.5 py-0.5 text-cap rounded-pill ${statusStyles[status] || statusStyles.pending}`}>
                        {status}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 text-muted whitespace-nowrap">
                      {inv.expires_at ? new Date(inv.expires_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-3 px-3.5">
                      <div className="flex items-center gap-1 justify-end">
                        {status === 'pending' && (
                          <>
                            <button
                              onClick={() => copyText(buildInviteLink(inv.token), inv.id)}
                              title="Copy invite link"
                              className="px-2 py-1.5 rounded-pill text-cap border border-hairline text-link hover:bg-canvas inline-flex items-center gap-1"
                            >
                              <Copy className="w-3.5 h-3.5" />
                              {copiedKey === inv.id ? 'Copied' : 'Copy link'}
                            </button>
                            <button
                              onClick={() => setRevokeInviteTarget(inv)}
                              title="Revoke invitation"
                              className="px-2 py-1.5 rounded-pill text-cap border border-hairline text-aqi-unhealthy hover:bg-canvas inline-flex items-center gap-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Revoke
                            </button>
                          </>
                        )}
                        {status === 'expired' && (
                          <span className="text-cap text-muted">Re-invite to refresh the link</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!invitations.length && (
                <tr>
                  <td colSpan={7} style={{ padding: 0 }}>
                    <div className="empty border-0 rounded-none text-center py-9">
                      <p className="text-small">Nobody is invited yet.</p>
                      <Button size="sm" variant="outline" className="mt-3" onClick={() => openInviteModal()}>
                        Invite your first student
                      </Button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        </div>
      </Card>

      {/* Row 3: Class Roster — flat people list (actions live here) */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-tile text-fg">Class roster</h3>
            <p className="text-small text-muted mt-1">Everyone who joined your workspace.</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => openInviteModal()}>
            <Mail className="w-4 h-4" />
            Invite student
          </Button>
        </div>
        <div className="tablewrap border border-hairline-soft rounded-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-small">
            <thead>
              <tr className="text-left text-cap font-semibold text-secondary bg-canvas">
                <th className="py-3 px-3.5">Name</th>
                <th className="py-3 px-3.5">Email</th>
                <th className="py-3 px-3.5">Group</th>
                <th className="py-3 px-3.5">Joined</th>
                <th className="py-3 px-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline-soft">
              {studentMembers.map((m) => {
                const assignFirst = needsGroupAssign(m);
                return (
                <tr key={m.id}>
                  <td className="py-3 px-3.5 font-medium text-fg">
                    {m.full_name ? m.full_name : <span className="text-muted italic">{formatMemberContact(m)}</span>}
                  </td>
                  <td className="mono py-3 px-3.5 text-secondary text-xs" title={formatMemberContact(m)}>
                    {formatMemberContact(m)}
                  </td>
                  <td className="py-3 px-3.5 whitespace-nowrap">{m.period || 'P?'} · {m.group_code || 'G?'}</td>
                  <td className="py-3 px-3.5 text-muted whitespace-nowrap">{m.joined_at}</td>
                  <td className="py-3 px-3.5">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => openStudentAction(m, 'password')} title="Reset password" className="px-2 py-1.5 rounded-pill text-cap border border-hairline text-aqi-usg hover:bg-canvas inline-flex items-center gap-1"><LockKeyhole className="w-3.5 h-3.5" />PW</button>
                      <button
                        onClick={() => openStudentAction(m, 'move')}
                        title={assignFirst ? 'Assign period/group' : 'Move period/group'}
                        className="px-2 py-1.5 rounded-pill text-cap border border-hairline text-link hover:bg-canvas inline-flex items-center gap-1"
                      >
                        <MoveRight className="w-3.5 h-3.5" />
                        {assignFirst ? 'Assign' : 'Move'}
                      </button>
                      <button onClick={() => setRemoveTarget(m)} title="Remove account" className="px-2 py-1.5 rounded-pill text-cap border border-hairline text-aqi-unhealthy hover:bg-canvas inline-flex items-center gap-1"><Trash2 className="w-3.5 h-3.5" />Remove</button>
                    </div>
                  </td>
                </tr>
                );
              })}
              {studentMembers.length === 0 && (
                <tr><td colSpan={5} className="py-6 text-center text-muted">No students yet — invite them by email.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        </div>
      </Card>

      {/* Row 4: Groups — composition & coverage (no member actions; those live in the Roster) */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-tile text-fg">Groups</h3>
            <p className="text-small text-muted mt-1">Coverage &amp; composition — drag a member chip to another group (same period) to move them.</p>
          </div>
          <select
            value={rosterPeriod}
            onChange={(e) => setRosterPeriod(e.target.value)}
            className="sel-sm h-9 text-small border border-hairline rounded-ctrl bg-surface text-fg pl-3 pr-8"
          >
            <option value="all">All periods</option>
            {savedPeriods.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="tablewrap border border-hairline-soft rounded-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-small">
            <thead>
              <tr className="text-left text-cap font-semibold text-secondary bg-canvas">
                <th className="py-3 px-3.5">Group</th>
                <th className="py-3 px-3.5">Coverage</th>
                <th className="py-3 px-3.5">Members</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline-soft">
              {rosterRows.map(({ period, group, accts }) => (
                <tr key={`${period}-${group}`} className="align-top">
                  <td className="py-3 px-3.5 whitespace-nowrap">
                    <p className="font-semibold text-fg">{period} · {group}</p>
                    <button
                      onClick={() => onGroupSelect?.({ period, group })}
                      className="text-cap text-link hover:underline"
                    >
                      Open Raw Data →
                    </button>
                  </td>
                  <td className="py-3 px-3.5 whitespace-nowrap">
                    <span className={`tag inline-block px-2.5 py-0.5 text-cap rounded-pill border border-hairline ${accts.length === 0 ? 'text-aqi-usg' : 'text-aqi-good'}`}>
                      {accts.length === 0 ? 'No account' : `${accts.length} account${accts.length === 1 ? '' : 's'}`}
                    </span>
                  </td>
                  <td
                    className={`py-3 px-3.5 rounded-ctrl transition-colors ${dropTarget === `${period}-${group}` ? 'bg-canvas ring-1 ring-link' : ''}`}
                    onDragOver={(e) => { e.preventDefault(); setDropTarget(`${period}-${group}`); }}
                    onDragLeave={() => setDropTarget((t) => (t === `${period}-${group}` ? null : t))}
                    onDrop={() => handleGroupDrop(period, group)}
                  >
                    {accts.length === 0 ? (
                      <button
                        onClick={() => openInviteModal({ period })}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-pill text-cap font-medium border border-hairline text-link hover:bg-canvas"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        Invite
                      </button>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {accts.map((a) => (
                          <span
                            key={a.id}
                            draggable
                            onDragStart={() => setDragMember(a)}
                            onDragEnd={() => { setDragMember(null); setDropTarget(null); }}
                            className="px-2 py-1 rounded-pill bg-canvas border border-hairline text-secondary text-cap cursor-grab active:cursor-grabbing select-none"
                            title="Drag to another group in the same period"
                          >
                            {a.full_name || formatMemberContact(a)}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
      </Card>

      {activeStudent && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => !busy && setActiveStudent(null)}>
          <div className="bg-surface rounded-card w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-hairline-soft flex items-center justify-between">
              <div>
                <h4 className="font-bold text-fg">
                  {activeAction === 'password' && 'Reset Password'}
                  {activeAction === 'move' && (needsGroupAssign(activeStudent) ? 'Assign Student' : 'Move Student')}
                  {activeAction === 'delete' && 'Remove Student'}
                </h4>
                <p className="text-xs text-muted mt-1">
                  {activeStudent.full_name} • {formatMemberContact(activeStudent)}
                </p>
              </div>
              <button
                onClick={() => !busy && setActiveStudent(null)}
                className="p-1.5 rounded-ctrl hover:bg-canvas"
              >
                <X className="w-4 h-4 text-muted" />
              </button>
            </div>
            <div className="p-5">
              {activeAction === 'password' && (
                <div className="space-y-3">
                  <input
                    type="password"
                    value={draftPassword}
                    onChange={(e) => setDraftPassword(e.target.value)}
                    placeholder="New password (8+ chars)"
                    className="w-full px-3 py-2 border border-hairline rounded-ctrl text-sm"
                  />
                  <Button size="sm" variant="neutral" disabled={busy || draftPassword.length < 8} onClick={() => handleResetPassword(activeStudent)}>
                    Apply password
                  </Button>
                </div>
              )}
              {activeAction === 'move' && (
                <div className="space-y-3">
                  {needsGroupAssign(activeStudent) && (
                    <p className="text-xs text-aqi-usg bg-canvas border border-hairline rounded-ctrl px-3 py-2">
                      This student has no group yet — pick a period and group to assign them.
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <select
                      value={draftPeriod}
                      onChange={(e) => setDraftPeriod(e.target.value)}
                      className="px-3 py-2 border border-hairline rounded-ctrl text-sm"
                    >
                      {savedPeriods.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <select
                      value={draftGroup}
                      onChange={(e) => setDraftGroup(e.target.value)}
                      className="px-3 py-2 border border-hairline rounded-ctrl text-sm"
                    >
                      {groupsFor(draftPeriod).map((g) => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                  <Button size="sm" disabled={busy} onClick={handleMoveStudent}>
                    {needsGroupAssign(activeStudent) ? 'Assign student' : 'Move student'}
                  </Button>
                </div>
              )}
              {activeAction === 'delete' && (
                <div className="space-y-3">
                  <p className="text-sm text-secondary">
                    Remove this student from the class roster?
                  </p>
                  <Button size="sm" variant="danger" disabled={busy} onClick={handleRemoveStudent}>
                    Remove student
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Invite people modal — creates invitations and shows the personal join links to share */}
      {inviteOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => !inviteBusy && setInviteOpen(false)}>
          <div className="bg-surface rounded-card w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-hairline-soft flex items-center justify-between">
              <h4 className="font-bold text-fg">Invite people</h4>
              <button onClick={() => !inviteBusy && setInviteOpen(false)} className="p-1.5 rounded-ctrl hover:bg-canvas">
                <X className="w-4 h-4 text-muted" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              {inviteResult ? (
                <>
                  {(inviteResult.invitations || []).length > 0 && (
                    <>
                      <p className="text-sm text-aqi-good">
                        Created {inviteResult.invitations.length} invitation{inviteResult.invitations.length === 1 ? '' : 's'}. Share each link with its invitee:
                      </p>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {inviteResult.invitations.map((inv) => (
                          <div key={inv.id} className="flex items-center justify-between gap-2 p-2 bg-canvas rounded-ctrl">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-fg truncate">{inv.email}</p>
                              <p className="text-xs text-muted truncate font-mono">{buildInviteLink(inv.token)}</p>
                            </div>
                            <button
                              onClick={() => copyText(buildInviteLink(inv.token), `modal-${inv.id}`)}
                              className="shrink-0 px-2 py-1.5 rounded-pill text-cap border border-hairline text-link hover:bg-canvas inline-flex items-center gap-1"
                            >
                              <Copy className="w-3.5 h-3.5" />
                              {copiedKey === `modal-${inv.id}` ? 'Copied' : 'Copy'}
                            </button>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  {(inviteResult.skipped || []).length > 0 && (
                    <p className="text-xs text-aqi-usg">
                      Skipped (already a member): {inviteResult.skipped.map((s) => s.email).join(', ')}
                    </p>
                  )}
                  <button
                    onClick={() => {
                      setInviteResult(null);
                      setInviteEmails('');
                      setInvitePlacements({});
                    }}
                    className="text-sm text-link hover:text-link font-semibold"
                  >
                    Invite more people
                  </button>
                </>
              ) : (
                <>
                  <p className="text-xs text-muted">
                    Upload a CSV — the first header row (<span className="font-mono">name, email, period, group</span>)
                    is skipped automatically. Names pre-fill on the student join page; period/group assign on accept.
                  </p>
                  <textarea
                    value={inviteEmails}
                    onChange={(e) => setInviteEmails(e.target.value)}
                    rows={3}
                    placeholder="student@example.com, student2@example.com"
                    className="w-full px-3 py-2 border border-hairline rounded-ctrl text-sm"
                  />
                  {Object.keys(invitePlacements).length > 0 && (
                    <p className="text-xs text-aqi-good bg-canvas border border-hairline rounded-ctrl px-3 py-2">
                      Spreadsheet loaded for {Object.keys(invitePlacements).length} student
                      {Object.keys(invitePlacements).length === 1 ? '' : 's'}
                      {' '}(name / period / group pre-filled where provided).
                    </p>
                  )}
                  <label className="inline-flex items-center gap-2 px-3 py-2 rounded-ctrl text-xs font-medium bg-canvas text-secondary border border-hairline-soft hover:bg-canvas cursor-pointer w-fit">
                    <Upload className="w-3.5 h-3.5" />
                    Upload spreadsheet / CSV
                    <input
                      type="file"
                      accept=".csv,.txt,text/csv,text/plain"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        handleInviteSpreadsheet(file);
                        e.target.value = '';
                      }}
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-muted mb-1">Role</label>
                      <select
                        value={inviteRole}
                        onChange={(e) => setInviteRole(e.target.value)}
                        className="w-full px-3 py-2 border border-hairline rounded-ctrl text-sm bg-surface"
                      >
                        <option value="student">Student</option>
                        <option value="teacher">Teacher</option>
                      </select>
                    </div>
                    {inviteRole === 'student' && (
                      <div>
                        <label className="block text-xs text-muted mb-1">Default period (optional)</label>
                        <select
                          value={invitePeriod}
                          onChange={(e) => setInvitePeriod(e.target.value)}
                          className="w-full px-3 py-2 border border-hairline rounded-ctrl text-sm bg-surface"
                        >
                          <option value="">Assign later</option>
                          {savedPeriods.map((p) => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                  <Button onClick={handleInvite} disabled={inviteBusy}>
                    {inviteBusy ? 'Creating…' : 'Create invitations'}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Section 6: Teacher Workflow help (behind the ? icon by the title) */}
      {showHelp && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowHelp(false)}>
          <div className="bg-surface rounded-card max-w-lg w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-hairline-soft p-5 flex items-center justify-between">
              <h3 className="text-tile text-fg">Teacher workflow</h3>
              <button onClick={() => setShowHelp(false)} className="p-1 hover:bg-canvas rounded-ctrl">
                <X className="w-5 h-5 text-secondary" />
              </button>
            </div>
            <ul className="p-6 text-small text-secondary space-y-2 list-disc ml-4">
              <li>Invite students and co-teachers by email — share each personal join link from the Invitations section.</li>
              <li>Open a group&apos;s Raw Data from the Groups section; manage individual members in the Roster.</li>
              <li>Reset student passwords when needed (teacher support flow).</li>
              <li>Use period/group selections here to drive Raw Data and Analysis comparisons.</li>
            </ul>
            <div className="p-6 pt-0">
              <Button wide onClick={() => setShowHelp(false)}>
                Got it
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Refinement 3: move toast with Undo */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] bg-fg text-white px-4 py-3 rounded-ctrl shadow-xl flex items-center gap-3 max-w-[90vw]">
          <span className="text-sm">{toast.message}</span>
          {toast.undo && (
            <button
              onClick={() => { toast.undo(); setToast(null); }}
              className="text-sm font-semibold text-link-dark hover:opacity-85"
            >
              Undo
            </button>
          )}
          <button onClick={() => setToast(null)} className="text-muted hover:text-white" aria-label="Dismiss">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Section 4: structure-shrink protection (reuses the shared ConfirmDialog) */}
      <ConfirmDialog
        open={!!shrink}
        variant="danger"
        title={shrink?.hasMembers ? 'Move students before shrinking' : 'Sessions will keep their group label'}
        message={shrink ? (
          shrink.hasMembers
            ? `These groups still have accounts: ${shrink.blockers.map((b) => `${b.period}·${b.group} (${b.accounts} account${b.accounts === 1 ? '' : 's'}${b.sessions ? `, ${b.sessions} session${b.sessions === 1 ? '' : 's'}` : ''})`).join(', ')}. Move those students into a kept group first. Existing sessions keep their original group label as a historical record.`
            : `These groups have sessions but no accounts: ${shrink.blockers.map((b) => `${b.period}·${b.group} (${b.sessions} session${b.sessions === 1 ? '' : 's'})`).join(', ')}. They keep their original group label as a historical record.`
        ) : ''}
        confirmLabel={shrink?.hasMembers ? 'Move students…' : 'Remove anyway'}
        confirmIcon={shrink?.hasMembers ? <MoveRight className="w-4 h-4" /> : undefined}
        onCancel={() => setShrink(null)}
        onConfirm={() => {
          if (shrink?.hasMembers) {
            const blk = shrink.blockers.find((b) => b.accounts > 0);
            const member = blk && studentMembers.find((m) => m.period === blk.period && m.group_code === blk.group);
            setShrink(null);
            if (member) openStudentAction(member, 'move');
          } else {
            setShrink(null);
            doSaveStructure();
          }
        }}
      />

      {/* Section 5: remove-account confirmation (shared ConfirmDialog) */}
      <ConfirmDialog
        open={!!removeTarget}
        variant="danger"
        title="Remove this account?"
        message={removeTarget ? `Remove ${removeTarget.full_name || formatMemberContact(removeTarget)} (${removeTarget.period || 'P?'} · ${removeTarget.group_code || 'G?'}) from the roster?` : ''}
        confirmLabel="Remove"
        onCancel={() => setRemoveTarget(null)}
        onConfirm={() => doRemoveStudent(removeTarget)}
      />

      {/* Revoke-invitation confirmation (shared ConfirmDialog) */}
      <ConfirmDialog
        open={!!revokeInviteTarget}
        variant="danger"
        title="Revoke this invitation?"
        message={revokeInviteTarget
          ? `Revoke the invitation for ${revokeInviteTarget.email}? Their join link stops working immediately. You can re-invite them later.`
          : ''}
        confirmLabel="Revoke"
        onCancel={() => setRevokeInviteTarget(null)}
        onConfirm={() => doRevokeInvitation(revokeInviteTarget)}
      />
    </div>
  );
}
