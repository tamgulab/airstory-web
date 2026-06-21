import React, { useCallback, useEffect, useState, useRef } from "react";
import LandingPage from "./components/LandingPage";
import OnboardingForm from "./components/OnboardingForm";
import HeatMapDashboard from "./components/HeatMapDashboard";
import RawDataView from "./components/RawDataView";
import AnalysisView from "./components/AnalysisView";
import MyPage from "./components/MyPage";
import ManageClasses from "./components/ManageClasses";
import { MapPin, Table, BarChart3, User, LogOut, Users } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import {
  login as loginApi,
  register as registerApi,
  loginWithGoogle as loginWithGoogleApi,
  completeRegistration as completeRegistrationApi,
  getMe,
  logout as logoutApi,
  getClassStructure,
} from "./api/auth";
import { getMeasurements } from "./api/data";
import {
  setImportedMeasurements,
  clearImportedMeasurements,
} from "./utils/importedData";
import { workspaceMeasurementsToDisplayRows } from "./utils/measurementRows";

// Metric configurations with colors
// Using a colorblind-friendly palette with similar blue/teal tones
// Distinguishable by saturation and lightness rather than hue
const METRIC_THEMES = {
  pm25: {
    label: 'PM 2.5',
    unit: 'µg/m³',
    key: 'pm25',
    primary: '#0EA5E9', // sky blue - medium saturation
    light: '#E0F2FE',
    gradient: 'from-sky-500 to-sky-700',
    bg: 'bg-sky-600',
    hover: 'hover:bg-sky-700',
    text: 'text-sky-600',
    border: 'border-sky-200'
  },
  co: {
    label: 'CO',
    unit: 'ppm',
    key: 'co',
    primary: '#0284C7', // darker blue - higher saturation
    light: '#BAE6FD',
    gradient: 'from-sky-600 to-sky-800',
    bg: 'bg-sky-700',
    hover: 'hover:bg-sky-800',
    text: 'text-sky-700',
    border: 'border-sky-300'
  },
  temp: {
    label: 'Temperature',
    unit: '°C',
    key: 'temp',
    primary: '#06B6D4', // cyan - medium saturation
    light: '#CFFAFE',
    gradient: 'from-cyan-500 to-cyan-700',
    bg: 'bg-cyan-600',
    hover: 'hover:bg-cyan-700',
    text: 'text-cyan-600',
    border: 'border-cyan-200'
  },
  humidity: {
    label: 'Humidity',
    unit: '%',
    key: 'humidity',
    primary: '#0891B2', // teal - darker, more saturated
    light: '#A5F3FC',
    gradient: 'from-cyan-600 to-cyan-800',
    bg: 'bg-cyan-700',
    hover: 'hover:bg-cyan-800',
    text: 'text-cyan-700',
    border: 'border-cyan-300'
  }
};


export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeSection, setActiveSection] = useState("heatmap");
  const [selectedMetric, setSelectedMetric] = useState("pm25");
  const [isPublicMode] = useState(false); // Public mode is off when we have a landing/login
  const [workspaceId, setWorkspaceId] = useState("");
  const [userRole, setUserRole] = useState("student");
  const [viewerProfile, setViewerProfile] = useState({
    displayName: "",
    school: "",
    instructor: "",
    period: "",
    group: "",
    studentId: "",
  });
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  // First-time federated (e.g. Google) sign-in: signed in to Firebase but no app account yet.
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [onboardingSubmitting, setOnboardingSubmitting] = useState(false);
  const [onboardingError, setOnboardingError] = useState("");
  const [importedDataVersion, setImportedDataVersion] = useState(0);
  /** Server profile placement snapshot; only when this changes do we overwrite student explorer filters (CSV / drill-down). */
  const lastProfileHierarchySnapRef = useRef("");
  const [filters, setFilters] = useState({
    country: "US",
    state: "PA",
    school: "",
    instructor: "",
    period: "",
    group: "",
    studentId: "",
  });
  /** Workspace class grid from API (Manage Classes); drives period/group dropdowns app-wide. */
  const [classStructure, setClassStructure] = useState(null);

  const refreshClassStructure = useCallback(async (workspaceIdOverride) => {
    const wid = workspaceIdOverride ?? workspaceId;
    if (!wid) {
      setClassStructure(null);
      return;
    }
    try {
      const s = await getClassStructure(wid);
      setClassStructure(s);
    } catch {
      setClassStructure(null);
    }
  }, [workspaceId]);

  useEffect(() => {
    refreshClassStructure();
  }, [refreshClassStructure]);

  // Restore (and track) the Firebase session. Fires on mount with the persisted user, if any,
  // and on every sign-in/sign-out. syncFromMe (gated on isLoggedIn) then hydrates the app profile.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsLoggedIn(Boolean(user));
    });
    return unsubscribe;
  }, []);

  const syncFromMe = useCallback(async () => {
    if (!isLoggedIn) return;
    try {
      const me = await getMe();
      // The user has an app account, so they're past onboarding.
      setNeedsOnboarding(false);
      const membership = me?.memberships?.[0] || null;
      const profile = me?.profile || null;
      const nextRole = membership?.role || userRole || "student";
      const isTeacherRole = nextRole === "teacher";
      // On a fresh page load there is no persisted workspace id (Firebase only restores identity),
      // so hydrate it here from the membership returned by the backend.
      if (membership?.workspace_id) setWorkspaceId(membership.workspace_id);
      setUserRole(nextRole);
      setViewerProfile((prev) => ({
        ...prev,
        displayName: me?.user?.full_name || prev.displayName,
        school: profile?.school_code || "",
        instructor: profile?.instructor || "",
        period: profile?.period || "",
        group: profile?.group_code || "",
        studentId: profile?.student_code || prev.studentId,
      }));
      if (isTeacherRole) {
        setFilters((prev) => ({
          ...prev,
          school: profile?.school_code != null && profile.school_code !== "" ? profile.school_code : prev.school,
          instructor:
            profile?.instructor != null && profile.instructor !== "" ? profile.instructor : prev.instructor,
          period: profile?.period != null && profile.period !== "" ? profile.period : prev.period,
          group: profile?.group_code != null && profile.group_code !== "" ? profile.group_code : prev.group,
        }));
      }
      if (!isTeacherRole) {
        const profileSnap = [
          profile?.school_code || "",
          profile?.instructor || "",
          profile?.period || "",
          profile?.group_code || "",
        ].join("|");
        const snapSeen = lastProfileHierarchySnapRef.current;
        const profileUnchangedOnServer =
          snapSeen !== "" && profileSnap === snapSeen;
        if (profileUnchangedOnServer) {
          setFilters((prev) => {
            const nextStudentId = profile?.student_code || prev.studentId;
            if (prev.studentId === nextStudentId) return prev;
            return { ...prev, studentId: nextStudentId };
          });
        } else {
          lastProfileHierarchySnapRef.current = profileSnap;
          setFilters((prev) => ({
            ...prev,
            school: profile?.school_code || "",
            instructor: profile?.instructor || "",
            period: profile?.period || "",
            group: profile?.group_code || "",
            studentId: profile?.student_code || prev.studentId,
          }));
        }
      }
      const wid = me?.memberships?.[0]?.workspace_id;
      if (wid) {
        try {
          const s = await getClassStructure(wid);
          setClassStructure(s);
        } catch {
          /* leave previous structure */
        }
      }
    } catch (e) {
      // A "no account" 401 means this Firebase user hasn't finished registration -> onboarding.
      // Any other error (e.g. transient network) leaves the current session state untouched.
      if (String(e?.message || "").toLowerCase().includes("no account")) {
        setNeedsOnboarding(true);
      }
    }
  }, [isLoggedIn, userRole]);

  const handleImportedDataChanged = useCallback(() => {
    setImportedDataVersion((v) => v + 1);
  }, []);

  const serverMeasurementCountRef = useRef(null);

  useEffect(() => {
    if (!isLoggedIn || !workspaceId) {
      serverMeasurementCountRef.current = null;
      return undefined;
    }
    let cancelled = false;
    async function pullWorkspaceMeasurements() {
      if (cancelled) return;
      try {
        const result = await getMeasurements(workspaceId, { limit: 10000 });
        if (cancelled) return;
        const mc = result.measurements?.length ?? 0;
        const mapped = workspaceMeasurementsToDisplayRows(result.measurements || []);
        const prev = serverMeasurementCountRef.current;

        if (mc === 0) {
          if (prev !== null && prev > 0) {
            clearImportedMeasurements();
            setImportedDataVersion((v) => v + 1);
          }
          serverMeasurementCountRef.current = 0;
          return;
        }

        if (prev === null || mc > prev) {
          serverMeasurementCountRef.current = mc;
          setImportedMeasurements(mapped);
          setImportedDataVersion((v) => v + 1);
        }
      } catch {
        // Offline: keep existing imported cache
      }
    }
    pullWorkspaceMeasurements();
    const interval = setInterval(pullWorkspaceMeasurements, 60000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isLoggedIn, workspaceId]);

  useEffect(() => {
    if (!isLoggedIn) return undefined;
    syncFromMe();
    const timer = setInterval(syncFromMe, 15000);
    const onFocus = () => syncFromMe();
    const onVisible = () => {
      if (document.visibilityState === "visible") syncFromMe();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [isLoggedIn, syncFromMe]);

  // Handle auto-login for specific user if needed, or just let the landing page handle it
  const handleLogin = async ({ email, password }) => {
    setAuthError("");
    setAuthLoading(true);
    try {
      const session = await loginApi(email, password);
      let me = null;
      try {
        me = await getMe();
      } catch {
        // Render cold starts can make /auth/me briefly fail after login.
        // Keep the user logged in using the login payload and hydrate profile later.
      }
      const membership = me?.memberships?.[0] || null;
      const profile = me?.profile || null;
      setWorkspaceId(session?.user?.workspaceId || membership?.workspace_id || "");
      setUserRole(membership?.role || "student");
      setViewerProfile({
        displayName: me?.user?.full_name || session?.user?.fullName || "",
        school: profile?.school_code || "",
        instructor: profile?.instructor || "",
        period: profile?.period || "",
        group: profile?.group_code || "",
        studentId: profile?.student_code || email.split("@")[0].toUpperCase(),
      });
      setIsLoggedIn(true);
      setActiveSection((membership?.role === "teacher") ? "manageclasses" : "heatmap");
      const school = profile?.school_code ?? "";
      const instructor = profile?.instructor ?? "";
      const period = profile?.period ?? "";
      const group = profile?.group_code ?? "";
      lastProfileHierarchySnapRef.current = [school, instructor, period, group].join("|");
      setFilters((prev) => ({
        ...prev,
        school,
        instructor,
        period,
        group,
        studentId: profile?.student_code || email.split("@")[0].toUpperCase(),
      }));
    } catch (error) {
      setAuthError(error.message || "Login failed");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setAuthError("");
    setAuthLoading(true);
    try {
      await loginWithGoogleApi();
      // onAuthStateChanged flips isLoggedIn; syncFromMe then either hydrates an existing
      // account or sets needsOnboarding for a first-time user.
    } catch (error) {
      setAuthError(error.message || "Google sign-in failed");
    } finally {
      setAuthLoading(false);
    }
  };

  // First-time federated users finish here: confirm name + role (+ join code for students).
  const handleCompleteOnboarding = async ({ fullName, role, joinCode }) => {
    setOnboardingError("");
    setOnboardingSubmitting(true);
    try {
      const cu = auth.currentUser;
      const email = cu?.email || "";
      await completeRegistrationApi({
        email,
        fullName,
        role,
        workspaceName: role === "teacher" ? `${fullName} Workspace` : "Air Story class",
        studentCode: role === "student" && email ? email.split("@")[0].toUpperCase() : "",
        joinCode: role === "student" ? joinCode : undefined,
      });
      setNeedsOnboarding(false);
      await syncFromMe();
      setActiveSection(role === "teacher" ? "manageclasses" : "heatmap");
    } catch (error) {
      setOnboardingError(error.message || "Could not finish setting up your account.");
    } finally {
      setOnboardingSubmitting(false);
    }
  };

  const handleCancelOnboarding = async () => {
    setNeedsOnboarding(false);
    setOnboardingError("");
    await handleLogout();
  };

  const handleRegister = async ({ email, password, fullName, mode, period, group, instructor, joinCode }) => {
    setAuthError("");
    setAuthLoading(true);
    try {
      // Students always join via join code only; never reuse a stale workspace id from
      // another session or the API may treat the signup inconsistently. A teacher creating
      // another account from an active session reuses the current workspace.
      const joinWorkspaceId = mode === "teacher" ? workspaceId || undefined : undefined;
      const session = await registerApi({
        email,
        password,
        fullName,
        workspaceName: mode === "student" ? "Air Story class" : `${fullName || "User"} Workspace`,
        role: mode === "teacher" ? "teacher" : "student",
        schoolCode: filters.school,
        instructor: instructor || filters.instructor,
        period: period || filters.period,
        groupCode: group || filters.group,
        studentCode: email.split("@")[0].toUpperCase(),
        joinWorkspaceId,
        joinCode: joinCode || undefined,
      });
      let me = null;
      try {
        me = await getMe();
      } catch {
        // Keep newly registered users signed in even if profile fetch is delayed.
      }
      const membership = me?.memberships?.[0] || null;
      const profile = me?.profile || null;
      setWorkspaceId(session?.user?.workspaceId || membership?.workspace_id || "");
      setUserRole(membership?.role || "student");
      setViewerProfile({
        displayName: me?.user?.full_name || session?.user?.fullName || fullName || "",
        school: profile?.school_code || "",
        instructor: profile?.instructor || "",
        period: profile?.period || "",
        group: profile?.group_code || "",
        studentId: profile?.student_code || email.split("@")[0].toUpperCase(),
      });
      setIsLoggedIn(true);
      setActiveSection((membership?.role === "teacher") ? "manageclasses" : "heatmap");
      const rs = profile?.school_code ?? "";
      const ri = profile?.instructor ?? "";
      const rp = profile?.period ?? "";
      const rg = profile?.group_code ?? "";
      lastProfileHierarchySnapRef.current = [rs, ri, rp, rg].join("|");
      setFilters((prev) => ({
        ...prev,
        school: rs,
        instructor: ri,
        period: rp,
        group: rg,
        studentId: profile?.student_code || email.split("@")[0].toUpperCase(),
      }));
    } catch (error) {
      setAuthError(error.message || "Sign up failed");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutApi();
    } catch {
      // Ignore logout API errors and still clear local UI session.
    } finally {
      lastProfileHierarchySnapRef.current = "";
      setIsLoggedIn(false);
      setWorkspaceId("");
      setUserRole("student");
      setViewerProfile({
        displayName: "",
        school: "",
        instructor: "",
        period: "",
        group: "",
        studentId: "",
      });
      setActiveSection("heatmap");
      setAuthError("");
    }
  };

  const currentTheme = METRIC_THEMES[selectedMetric];

  const handleTeacherSelectGroup = ({ period, group }) => {
    setFilters((prev) => ({
      ...prev,
      period: period || prev.period,
      group: group || prev.group,
    }));
    setActiveSection("rawdata");
  };

  const isTeacher = userRole === "teacher";

  const teacherNavInitials = () => {
    const name = (viewerProfile.displayName || "").trim();
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    if (parts.length === 1 && parts[0].length >= 2) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    if (parts.length === 1 && parts[0].length === 1) {
      return `${parts[0]}•`.toUpperCase();
    }
    return "IN";
  };

  const navItems = isTeacher
    ? [
        { id: 'manageclasses', label: 'Manage Classes', icon: Users },
        { id: 'heatmap', label: 'Heat Map', icon: MapPin },
        { id: 'rawdata', label: 'Raw Data', icon: Table },
        { id: 'analysis', label: 'Analysis', icon: BarChart3 },
        { id: 'mypage', label: 'My Page', icon: User },
      ]
    : [
        { id: 'heatmap', label: 'Heat Map', icon: MapPin },
        { id: 'rawdata', label: 'Raw Data', icon: Table },
        { id: 'analysis', label: 'Analysis', icon: BarChart3 },
        { id: 'mypage', label: 'My Page', icon: User },
      ];

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-blue-100"
           style={{
             backgroundImage: `radial-gradient(#cbd5e1 1px, transparent 1px)`,
             backgroundSize: '24px 24px'
           }}
      >
        <div className="w-full h-1.5 bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-600 sticky top-0 z-50" />
        <main className="min-h-screen flex flex-col justify-center py-12">
          <LandingPage
            onLogin={handleLogin}
            onRegister={handleRegister}
            onGoogleLogin={handleGoogleLogin}
            filters={filters}
            authError={authError}
            authLoading={authLoading}
          />
        </main>
        <footer className="py-8 text-center text-gray-400 text-sm font-bold uppercase tracking-widest">
          <p>Air Story • TAMGU LAB @TC</p>
        </footer>
      </div>
    );
  }

  if (needsOnboarding) {
    return (
      <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-blue-100"
           style={{
             backgroundImage: `radial-gradient(#cbd5e1 1px, transparent 1px)`,
             backgroundSize: '24px 24px'
           }}
      >
        <div className="w-full h-1.5 bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-600 sticky top-0 z-50" />
        <main className="min-h-screen flex flex-col justify-center py-12 px-4">
          <OnboardingForm
            defaultName={auth.currentUser?.displayName || ""}
            email={auth.currentUser?.email || ""}
            onSubmit={handleCompleteOnboarding}
            onCancel={handleCancelOnboarding}
            submitting={onboardingSubmitting}
            error={onboardingError}
          />
        </main>
        <footer className="py-8 text-center text-gray-400 text-sm font-bold uppercase tracking-widest">
          <p>Air Story • TAMGU LAB @TC</p>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation Bar */}
      <nav className="bg-white shadow-md border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between h-20">
            {/* Logo and Brand */}
            <button
              type="button"
              onClick={() => setActiveSection('heatmap')}
              className="flex items-center gap-3 focus:outline-none hover:opacity-80 transition-opacity"
              aria-label="Go to Heat Map"
            >
              <img 
                src="/logo.svg" 
                alt="AirStory"
                className="h-12 w-auto"
                onError={(e) => {
                  // Fallback to text if image fails to load
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'block';
                }}
              />
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight" style={{display: 'none'}}>
                AirStory
              </h1>
            </button>

            {/* Main Navigation */}
            <div className="flex items-center gap-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveSection(item.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                      activeSection === item.id
                        ? `bg-blue-600 text-white shadow-lg`
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="hidden md:inline">{item.label}</span>
                  </button>
                );
              })}
              
              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-red-600 hover:bg-red-50 transition-all ml-2"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
                <span className="hidden lg:inline">Logout</span>
              </button>
            </div>

            {/* User Info - Only show if not in public mode */}
            {!isPublicMode && (
              <div className="flex items-center gap-4">
                <div className="text-right hidden lg:block">
                  <p className="text-sm font-medium text-gray-900">
                    {isTeacher ? (viewerProfile.instructor || "Instructor") : (viewerProfile.studentId || filters.studentId)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {isTeacher
                      ? `${viewerProfile.school || filters.school} • Teacher Portal`
                      : `${viewerProfile.school || filters.school} - Group ${(viewerProfile.group || filters.group).replace('G', '')}`}
                  </p>
                </div>
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center border-2 border-white shadow-md">
                  <span className="text-white text-sm font-semibold">
                    {isTeacher
                      ? teacherNavInitials()
                      : (viewerProfile.studentId || filters.studentId || "STU000").slice(3)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {activeSection === 'heatmap' && (
          <HeatMapDashboard
            workspaceId={workspaceId}
            selectedMetric={selectedMetric}
            setSelectedMetric={setSelectedMetric}
            filters={filters}
            setFilters={setFilters}
            theme={currentTheme}
            metricThemes={METRIC_THEMES}
            importedDataVersion={importedDataVersion}
          />
        )}
        {activeSection === 'rawdata' && (
          <RawDataView
            workspaceId={workspaceId}
            viewerProfile={viewerProfile}
            selectedMetric={selectedMetric}
            setSelectedMetric={setSelectedMetric}
            filters={filters}
            setFilters={setFilters}
            theme={currentTheme}
            metricThemes={METRIC_THEMES}
            onImportedDataChanged={handleImportedDataChanged}
            classStructure={classStructure}
          />
        )}
        {activeSection === 'analysis' && (
          <AnalysisView
            selectedMetric={selectedMetric}
            setSelectedMetric={setSelectedMetric}
            filters={filters}
            theme={currentTheme}
            metricThemes={METRIC_THEMES}
            importedDataVersion={importedDataVersion}
            classStructure={classStructure}
          />
        )}
        {activeSection === 'mypage' && (
          <MyPage
            workspaceId={workspaceId}
            userRole={userRole}
            viewerProfile={viewerProfile}
            filters={filters}
            setFilters={setFilters}
            theme={currentTheme}
            onLogout={handleLogout}
            classStructure={classStructure}
            onProfileSaved={syncFromMe}
          />
        )}
        {activeSection === 'manageclasses' && isTeacher && (
          <ManageClasses
            workspaceId={workspaceId}
            theme={currentTheme}
            onGroupSelect={handleTeacherSelectGroup}
            viewerProfile={viewerProfile}
            onClassStructureChanged={(next) => {
              if (next && typeof next === "object") setClassStructure(next);
              else refreshClassStructure();
            }}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-20">
        <div className="max-w-7xl mx-auto px-6 py-6 text-center text-sm text-gray-600">
          <p>&copy; 2026 Air Story. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}