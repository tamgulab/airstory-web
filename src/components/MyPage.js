import React, { useEffect, useMemo, useState } from 'react';
import { User, Settings, HelpCircle, Shield, LogOut, Edit2, Save, X } from 'lucide-react';
import { getMe, getRoster, changePassword, updateMyProfile } from '../api/auth';
import { periodsFromClassStructure } from '../utils/classStructure';

const MyPage = ({
  workspaceId,
  userRole,
  viewerProfile,
  filters,
  setFilters,
  theme,
  onLogout,
  classStructure,
  onProfileSaved,
}) => {
  const isTeacherRole = userRole === 'teacher';
  const [isEditing, setIsEditing] = useState(false);
  const [tempFilters, setTempFilters] = useState({ ...filters });
  const [groupMembers, setGroupMembers] = useState([]);
  const [instructor, setInstructor] = useState({ name: '', role: 'Instructor', id: '' });
  const [me, setMe] = useState(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordEmail, setPasswordEmail] = useState('');
  const [passwordNew, setPasswordNew] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [profileSaveError, setProfileSaveError] = useState('');
  const [profileSaveBusy, setProfileSaveBusy] = useState(false);

  const profileInitials = () => {
    const name = (viewerProfile.displayName || me?.user?.full_name || '').trim();
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    if (parts.length === 1 && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
    return isTeacherRole ? 'IN' : 'ST';
  };

  useEffect(() => {
    let cancelled = false;
    async function loadRoster() {
      if (!workspaceId) return;
      try {
        const [meData, rosterData] = await Promise.all([getMe(), getRoster(workspaceId)]);
        if (cancelled) return;
        setMe(meData);
        const members = rosterData.members || [];
        const teacher = members.find((m) => m.role === 'teacher');
        const students = members.filter((m) => m.role === 'student');
        if (teacher) {
          setInstructor({
            name: teacher.full_name,
            role: 'Instructor',
            id: teacher.student_code || teacher.email,
          });
        }
        const apiStudents = students.map((s) => ({
          name: s.full_name,
          role: `${s.period || 'P?'} • ${s.group_code || 'G?'}`,
          id: s.student_code || s.email,
        }));
        setGroupMembers(apiStudents);
      } catch {
        // keep existing static fallback when API unavailable
      }
    }
    loadRoster();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const periodEditOptions = useMemo(() => {
    const p = periodsFromClassStructure(classStructure);
    if (p.length) return p;
    return ['P1', 'P2', 'P3', 'P4'];
  }, [classStructure]);

  const groupEditNums = useMemo(() => {
    const n =
      typeof classStructure?.groupCount === 'number' && classStructure.groupCount > 0
        ? classStructure.groupCount
        : 6;
    return Array.from({ length: n }, (_, i) => i + 1);
  }, [classStructure]);

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordError('');
    if (!passwordEmail.trim() || !passwordNew || passwordNew.length < 8) {
      setPasswordError('Use your account email and a new password (at least 8 characters).');
      return;
    }
    try {
      setPasswordBusy(true);
      await changePassword(passwordEmail.trim().toLowerCase(), passwordNew);
      setShowPasswordModal(false);
      setPasswordNew('');
      onLogout();
    } catch (err) {
      setPasswordError(err.message || 'Could not update password.');
    } finally {
      setPasswordBusy(false);
    }
  };

  const groupedStructure = useMemo(() => {
    const map = {};
    groupMembers.forEach((m) => {
      const parts = String(m.role).split('•').map((p) => p.trim());
      const period = parts[0] || 'P?';
      const group = parts[1] || 'G?';
      const key = `${period} ${group}`;
      if (!map[key]) map[key] = [];
      map[key].push(m);
    });
    return map;
  }, [groupMembers]);

  const handleSave = async () => {
    setProfileSaveError('');
    setProfileSaveBusy(true);
    try {
      await updateMyProfile({
        schoolCode: tempFilters.school,
        instructor: tempFilters.instructor,
        period: tempFilters.period,
        groupCode: tempFilters.group,
      });
      setFilters(tempFilters);
      setIsEditing(false);
      await onProfileSaved?.();
    } catch (e) {
      setProfileSaveError(e.message || 'Could not save profile.');
    } finally {
      setProfileSaveBusy(false);
    }
  };

  const handleCancel = () => {
    setTempFilters({ ...filters });
    setIsEditing(false);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Page</h1>
          <p className="text-gray-600">Manage your profile and preferences</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
            <div className="text-center mb-6">
              <div 
                className="w-24 h-24 mx-auto rounded-full flex items-center justify-center text-3xl font-bold text-white mb-4"
                style={{ background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.primary}CC 100%)` }}
              >
                {isTeacherRole ? profileInitials() : (viewerProfile.studentId || filters.studentId || 'STU000').slice(3)}
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">
                {isTeacherRole
                  ? viewerProfile.displayName || me?.user?.full_name || 'Instructor'
                  : viewerProfile.studentId || filters.studentId}
              </h2>
              <p className="text-sm text-gray-600">
                {isTeacherRole
                  ? `${viewerProfile.school || filters.school} • ${viewerProfile.instructor || filters.instructor || 'Instructor'}`
                  : `${viewerProfile.school || filters.school} - ${viewerProfile.instructor || filters.instructor} - ${viewerProfile.period || filters.period} - Group ${(viewerProfile.group || filters.group || '').replace('G', '')}`}
              </p>
            </div>

            <div className="space-y-3 py-4 border-t border-gray-200">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Country</span>
                <span className="font-medium text-gray-900">{filters.country}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">State</span>
                <span className="font-medium text-gray-900">{filters.state}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">School Code</span>
                <span className="font-medium text-gray-900">{viewerProfile.school || filters.school}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Class (Instructor)</span>
                <span className="font-medium text-gray-900">{viewerProfile.instructor || filters.instructor}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Period</span>
                <span className="font-medium text-gray-900">{viewerProfile.period || filters.period}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Group</span>
                <span className="font-medium text-gray-900">{viewerProfile.group || filters.group}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setTempFilters({ ...filters });
                setProfileSaveError('');
                setIsEditing(true);
              }}
              className={`w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 ${theme.bg} ${theme.hover} text-white font-medium rounded-lg transition-all`}
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

          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200 mt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              {userRole === 'teacher' ? 'Teacher Guide' : 'Student Guide'}
            </h3>
            {(userRole === 'teacher') ? (
              <ul className="text-sm text-gray-700 space-y-2">
                <li>Start in Manage Classes to confirm period/group structure.</li>
                <li>Use HeatMap for class-level overview, then Raw Data for detailed validation.</li>
                <li>Review student annotation asterisks (*) before exporting reports.</li>
              </ul>
            ) : (
              <ul className="text-sm text-gray-700 space-y-2">
                <li>Start in HeatMap to understand current conditions.</li>
                <li>Use Raw Data to review measurements and add responsible edit notes.</li>
                <li>Use Analysis to summarize trends and add reflection insights.</li>
              </ul>
            )}
          </div>
        </div>

        {/* Settings Sections */}
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
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {isTeacherRole ? 'Instructor / staff ID' : 'Student ID'}
                </label>
                <input
                  type="text"
                  value={
                    isTeacherRole
                      ? viewerProfile.studentId || filters.studentId || me?.user?.email || '—'
                      : filters.studentId
                  }
                  disabled
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-500 cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {isTeacherRole ? 'Shown for your records; edit placement in Manage Classes for students.' : 'Student ID cannot be changed'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
                <input
                  type="email"
                  value={me?.user?.email || ''}
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
                    setPasswordEmail(me?.user?.email || '');
                    setShowPasswordModal(true);
                  }}
                  className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  Change Password
                </button>
              </div>
            </div>
          </div>

          {/* Group Members */}
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
            <div className="flex items-center gap-3 mb-6">
              <div className={`w-10 h-10 ${theme.bg} rounded-lg flex items-center justify-center`}>
                <User className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">
                {(userRole === 'teacher') ? 'Class Members' : 'Group Members'}
              </h3>
            </div>

            {/* Instructor */}
            <div className="mb-6 pb-6 border-b border-gray-200">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Instructor</p>
              <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-purple-50 to-white rounded-lg border border-purple-200">
                <User className="w-6 h-6 text-purple-600 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">
                    {instructor.name || viewerProfile.instructor || filters.instructor || '—'}
                  </p>
                  <p className="text-sm text-gray-600">{instructor.role}</p>
                </div>
                <span className="text-xs text-gray-500 font-mono">{instructor.id || '—'}</span>
              </div>
            </div>

            {/* Students */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Students by Period and Group
              </p>
              <div className="space-y-4">
                {Object.keys(groupedStructure).map((bucket) => (
                  <div key={bucket}>
                    <p className="text-xs font-bold text-gray-500 mb-2">{bucket}</p>
                    <div className="space-y-2">
                      {groupedStructure[bucket].map((member, idx) => (
                        <div key={`${bucket}-${idx}`} className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors">
                          <div 
                            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm"
                            style={{ background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.primary}CC 100%)` }}
                          >
                            {member.name.charAt(0)}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{member.name}</p>
                            <p className="text-sm text-gray-600">{member.role}</p>
                          </div>
                          <span className="text-xs text-gray-500 font-mono">{member.id}</span>
                          {member.id === filters.studentId && (
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                              You
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* About */}
          <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-6 shadow-lg border border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 mb-4">About Air Story</h3>
            <div className="space-y-3 text-sm text-gray-600">
              <p>
                <strong className="text-gray-900">Version:</strong> 1.0.0
              </p>
              <p>
                <strong className="text-gray-900">Last Updated:</strong> November 2025
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

      {/* Edit Profile Modal */}
      {isEditing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={handleCancel}>
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className={`${theme.bg} text-white p-6 rounded-t-2xl flex items-center justify-between`}>
              <h3 className="text-xl font-bold">Edit Profile</h3>
              <button onClick={handleCancel} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Country</label>
                <select
                  value={tempFilters.country}
                  onChange={(e) => setTempFilters({ ...tempFilters, country: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="US">United States</option>
                  <option value="CA">Canada</option>
                  <option value="UK">United Kingdom</option>
                  <option value="AU">Australia</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">State/Province</label>
                <select
                  value={tempFilters.state}
                  onChange={(e) => setTempFilters({ ...tempFilters, state: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="PA">Pennsylvania</option>
                  <option value="NY">New York</option>
                  <option value="CA">California</option>
                  <option value="TX">Texas</option>
                  <option value="FL">Florida</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">School Code</label>
                <input
                  type="text"
                  value={tempFilters.school}
                  onChange={(e) => setTempFilters({ ...tempFilters, school: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Class (Instructor)</label>
                <input
                  type="text"
                  value={tempFilters.instructor}
                  onChange={(e) => setTempFilters({ ...tempFilters, instructor: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Period</label>
                <select
                  value={tempFilters.period || periodEditOptions[0] || 'P1'}
                  onChange={(e) => setTempFilters({ ...tempFilters, period: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {periodEditOptions.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Group</label>
                <div className="grid grid-cols-3 gap-2">
                  {groupEditNums.map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setTempFilters({ ...tempFilters, group: `G${num}` })}
                      className={`py-2 rounded-lg text-sm font-medium transition-all ${
                        tempFilters.group === `G${num}`
                          ? `${theme.bg} text-white shadow-md`
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      G{num}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {profileSaveError ? (
              <div className="px-6 pb-2">
                <p className="text-sm text-red-600">{profileSaveError}</p>
              </div>
            ) : null}
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                type="button"
                onClick={handleCancel}
                disabled={profileSaveBusy}
                className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={profileSaveBusy}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 ${theme.bg} ${theme.hover} text-white font-semibold rounded-lg transition-colors disabled:opacity-50`}
              >
                <Save className="w-4 h-4" />
                {profileSaveBusy ? 'Saving…' : 'Save Changes'}
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