import React, { useCallback, useEffect, useState, useRef } from "react";
import LandingPage from "./components/LandingPage";
import InviteLanding from "./components/InviteLanding";
import OnboardingForm from "./components/OnboardingForm";
import HeatMapDashboard from "./components/HeatMapDashboard";
import RawDataView from "./components/RawDataView";
import AnalysisView from "./components/AnalysisView";
import WorkspaceView, { followAttachedNotes } from "./components/WorkspaceView";
import MyPage from "./components/MyPage";
import ManageClasses from "./components/ManageClasses";
import { MapPin, Table, BarChart3, User, LogOut, Users, LayoutGrid, Globe2, GraduationCap, ChevronDown } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import {
  login as loginApi,
  register as registerApi,
  loginWithGoogle as loginWithGoogleApi,
  completeRegistration as completeRegistrationApi,
  acceptInvitation,
  getMe,
  logout as logoutApi,
  getClassStructure,
  checkHealth,
} from "./api/auth";
import { getMeasurements } from "./api/data";
import {
  setImportedMeasurements,
  clearImportedMeasurements,
  getImportedMeasurements,
  isLocalImportCache,
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


/** Client-side "current workspace" selection; the server has no notion of one. */
const WORKSPACE_STORAGE_KEY = "airstory.currentWorkspaceId";
/** Carries an invite token through the Firebase handshake (popup, refresh, log-in-then-accept). */
const INVITE_TOKEN_STORAGE_KEY = "airstory.pendingInviteToken";
/** The nav section the user is viewing, persisted so a reload stays put instead of resetting to Heat Map. */
const ACTIVE_SECTION_STORAGE_KEY = "airstory.activeSection";

function readInviteTokenFromLocation() {
  const pathMatch = window.location.pathname.match(/^\/join\/([A-Za-z0-9_-]{20,})/);
  const queryToken = new URLSearchParams(window.location.search).get("invite");
  return pathMatch?.[1] || queryToken || "";
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  // False until Firebase reports the persisted session on reload. Until then we must not assume
  // logged-out, or the login screen flashes before the restored session arrives.
  const [authReady, setAuthReady] = useState(false);
  const [activeSection, setActiveSection] = useState(
    () => localStorage.getItem(ACTIVE_SECTION_STORAGE_KEY) || "heatmap"
  );
  // User menu (popup on the avatar). Holds account actions like My Page; more options to come.
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);
  const [selectedMetric, setSelectedMetric] = useState("pm25");
  const [isPublicMode] = useState(false); // Public mode is off when we have a landing/login
  const [workspaceId, setWorkspaceId] = useState("");
  const [userRole, setUserRole] = useState("student");
  // Sidebar hover tooltip: rendered with fixed positioning so it escapes the
  // rail's overflow-y-auto (which otherwise clips a left-full popup horizontally).
  const [workspaceTooltip, setWorkspaceTooltip] = useState(null);
  /** All workspaces the user belongs to (from /auth/me), each with its embedded profile. */
  const [memberships, setMemberships] = useState([]);
  /** Account identity + global profile from /auth/me (same in every workspace). Feeds My Page
   * directly so it renders instantly without its own network round trip. */
  const [account, setAccount] = useState(null); // { id, email, full_name }
  const [accountProfile, setAccountProfile] = useState({ display_name: "", title: "", bio: "" });
  const [pendingInviteToken, setPendingInviteToken] = useState(() => {
    const fromUrl = readInviteTokenFromLocation();
    const token = fromUrl || sessionStorage.getItem(INVITE_TOKEN_STORAGE_KEY) || "";
    if (token) sessionStorage.setItem(INVITE_TOKEN_STORAGE_KEY, token);
    // Keep the SPA on "/" — sections are state-based, and the token now lives in storage.
    if (fromUrl) window.history.replaceState({}, "", "/");
    return token;
  });
  const [inviteActionLoading, setInviteActionLoading] = useState(false);
  const [inviteActionError, setInviteActionError] = useState("");
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
  // Keep Raw Data / Heat Map mounted after first open so tab switches don't remount and look wiped.
  const [rawDataSectionMounted, setRawDataSectionMounted] = useState(false);
  const [heatMapSectionMounted, setHeatMapSectionMounted] = useState(false);
  /** CODAP-inspired Workspace tab: session-only saved charts (from Analysis's "Send to Workspace" or the builder). */
  const [workspaceItems, setWorkspaceItems] = useState([]);
  const handleAddWorkspaceItem = useCallback((item) => {
    setWorkspaceItems((prev) => {
      const index = prev.length;
      const chartCount = prev.filter((entry) => entry.kind !== "note").length;
      const layout = item.layout || {
        x: 28 + (index % 3) * 390,
        y: 28 + Math.floor(index / 3) * 330,
        width: item.kind === "note" ? 320 : 370,
        height: item.kind === "note" ? 220 : 360,
      };
      const defaults =
        item.kind === "note"
          ? { noteColor: item.noteColor || "yellow", attachedToId: item.attachedToId || null }
          : { linkColor: item.linkColor || ["sky", "violet", "emerald", "amber", "rose"][chartCount % 5] };
      return [...prev, { ...item, ...defaults, layout }].slice(-24);
    });
  }, []);
  const handleRemoveWorkspaceItem = useCallback((id) => {
    setWorkspaceItems((prev) =>
      prev
        .filter((entry) => entry.id !== id)
        .map((entry) =>
          entry.attachedToId === id ? { ...entry, attachedToId: null } : entry
        )
    );
  }, []);
  const handleUpdateWorkspaceItem = useCallback((id, patch) => {
    setWorkspaceItems((prev) => {
      const current = prev.find((item) => item.id === id);
      const next = prev.map((item) => (item.id === id ? { ...item, ...patch } : item));
      // Charts drag/resize: glue attached report notes so they follow the graph.
      if (patch.layout && current && current.kind !== 'note') {
        return followAttachedNotes(next, id, patch.layout);
      }
      return next;
    });
  }, []);
  /** Server profile placement snapshot; only when this changes do we overwrite student explorer filters (CSV / drill-down). */
  const lastProfileHierarchySnapRef = useRef("");
  const [filters, setFilters] = useState({
    country: "US",
    state: "",
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
      setAuthReady(true);
    });
    return unsubscribe;
  }, []);

  // Remember the current nav section so a reload returns here instead of resetting to Heat Map.
  useEffect(() => {
    localStorage.setItem(ACTIVE_SECTION_STORAGE_KEY, activeSection);
  }, [activeSection]);

  const clearPendingInvite = useCallback(() => {
    sessionStorage.removeItem(INVITE_TOKEN_STORAGE_KEY);
    setPendingInviteToken("");
    setInviteActionError("");
  }, []);

  /** Prefer the locally persisted workspace; else land in a class (not the Public/school views). */
  const pickMembership = (nextMemberships, preferredId) => {
    if (!nextMemberships?.length) return null;
    const storedId = preferredId || localStorage.getItem(WORKSPACE_STORAGE_KEY);
    const stored = nextMemberships.find((m) => m.workspace_id === storedId);
    if (stored) return stored;
    return nextMemberships.find((m) => (m.kind || "class") === "class") || nextMemberships[0];
  };

  const syncFromMe = useCallback(async () => {
    if (!isLoggedIn) return;
    try {
      const me = await getMe();
      // The user has an app account, so they're past onboarding.
      setNeedsOnboarding(false);
      const nextMemberships = me?.memberships || [];
      setMemberships(nextMemberships);
      // Global account data for My Page (workspace-independent).
      setAccount(me?.user || null);
      setAccountProfile(me?.profile || { display_name: "", title: "", bio: "" });
      const membership = pickMembership(nextMemberships);
      const profile = membership?.profile || null;
      // School is a per-class property (workspaces.school_id → membership.school_name), not the
      // per-workspace profile, so read it from the membership.
      const schoolName = membership?.school_name || "";
      const nextRole = membership?.role || userRole || "student";
      const isTeacherRole = nextRole === "teacher";
      // On a fresh page load there is no persisted workspace id (Firebase only restores identity),
      // so hydrate it here from the picked membership returned by the backend.
      if (membership?.workspace_id) {
        localStorage.setItem(WORKSPACE_STORAGE_KEY, membership.workspace_id);
        // Avoid re-setting the same id (re-triggers workspace data effects / looks like a data wipe).
        setWorkspaceId((prev) => (prev === membership.workspace_id ? prev : membership.workspace_id));
      }
      setUserRole(nextRole);
      setViewerProfile((prev) => {
        const next = {
          ...prev,
          displayName: me?.user?.full_name || prev.displayName,
          school: schoolName,
          instructor: profile?.instructor || "",
          period: profile?.period || "",
          group: profile?.group_code || "",
          studentId: profile?.student_code || prev.studentId,
        };
        if (
          prev.displayName === next.displayName &&
          prev.school === next.school &&
          prev.instructor === next.instructor &&
          prev.period === next.period &&
          prev.group === next.group &&
          prev.studentId === next.studentId
        ) {
          return prev;
        }
        return next;
      });
      if (isTeacherRole) {
        setFilters((prev) => {
          const instructor =
            profile?.instructor != null && profile.instructor !== "" ? profile.instructor : prev.instructor;
          const period =
            profile?.period != null && profile.period !== "" ? profile.period : prev.period;
          const group =
            profile?.group_code != null && profile.group_code !== "" ? profile.group_code : prev.group;
          if (
            prev.school === schoolName &&
            prev.instructor === instructor &&
            prev.period === period &&
            prev.group === group
          ) {
            return prev;
          }
          return { ...prev, school: schoolName, instructor, period, group };
        });
      }
      if (!isTeacherRole) {
        const profileSnap = [
          schoolName,
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
            school: schoolName,
            instructor: profile?.instructor || "",
            period: profile?.period || "",
            group: profile?.group_code || "",
            studentId: profile?.student_code || prev.studentId,
          }));
        }
      }
      const wid = membership?.workspace_id;
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

  useEffect(() => {
    if (activeSection === "rawdata") setRawDataSectionMounted(true);
    if (activeSection === "heatmap") setHeatMapSectionMounted(true);
  }, [activeSection]);

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

        // Never auto-clear the browser cache on an empty/transient API response — that made
        // Raw Data / imports look like they "wiped" after ~15–60s. Explicit Clear Data handles wipes.
        if (mc === 0 || mapped.length === 0) {
          if (prev === null) serverMeasurementCountRef.current = 0;
          return;
        }

        if (prev === null || mc > prev) {
          serverMeasurementCountRef.current = mc;
        }

        // Poll may only hydrate an empty cache. Overwriting a non-empty cache (CSV import or a
        // prior hydrate) is what made Raw Data look wiped when switching tabs / every ~60s.
        // RawDataView owns refresh after import; Clear Data + workspace switch empty the cache.
        if (isLocalImportCache()) return;
        const existing = getImportedMeasurements();
        if (existing.length > 0) return;

        setImportedMeasurements(mapped, { source: "server" });
        setImportedDataVersion((v) => v + 1);
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
      // Block sign-in entirely if the backend is unreachable, so we never enter the app shell
      // without a working API (the landing page keeps showing authError).
      const online = await checkHealth();
      if (!online) {
        throw new Error("Can't reach the server. Please check your connection and try again.");
      }
      const session = await loginApi(email, password);
      let me = null;
      try {
        me = await getMe();
      } catch {
        // Render cold starts can make /auth/me briefly fail after login.
        // Keep the user logged in using the login payload and hydrate profile later.
      }
      setMemberships(me?.memberships || []);
      const membership = pickMembership(me?.memberships, session?.user?.workspaceId);
      const profile = membership?.profile || null;
      if (membership?.workspace_id) localStorage.setItem(WORKSPACE_STORAGE_KEY, membership.workspace_id);
      setWorkspaceId(membership?.workspace_id || "");
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
      // Block sign-in entirely if the backend is unreachable, before opening the Google popup.
      const online = await checkHealth();
      if (!online) {
        throw new Error("Can't reach the server. Please check your connection and try again.");
      }
      await loginWithGoogleApi();
      // onAuthStateChanged flips isLoggedIn; syncFromMe then either hydrates an existing
      // account or sets needsOnboarding for a first-time user.
    } catch (error) {
      setAuthError(error.message || "Google sign-in failed");
    } finally {
      setAuthLoading(false);
    }
  };

  // First-time federated users finish here: confirm name + workspace name (creating) or
  // just name (joining by invitation).
  const handleCompleteOnboarding = async ({ fullName, workspaceName }) => {
    setOnboardingError("");
    setOnboardingSubmitting(true);
    try {
      const cu = auth.currentUser;
      const email = cu?.email || "";
      const inviteToken = pendingInviteToken || undefined;
      const result = await completeRegistrationApi({
        email,
        fullName,
        workspaceName: inviteToken ? undefined : (workspaceName || `${fullName} Workspace`),
        inviteToken,
      });
      if (inviteToken) clearPendingInvite();
      setNeedsOnboarding(false);
      await syncFromMe();
      setActiveSection(result?.role === "teacher" ? "manageclasses" : "heatmap");
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

  const handleRegister = async ({ email, password, fullName, workspaceName, inviteToken }) => {
    setAuthError("");
    setAuthLoading(true);
    try {
      // Block sign-up entirely if the backend is unreachable, before creating a Firebase identity.
      const online = await checkHealth();
      if (!online) {
        throw new Error("Can't reach the server. Please check your connection and try again.");
      }
      // Exactly one path: an invite token (role/workspace come from the invitation) or a
      // workspace name (create it and become its teacher). No standalone accounts.
      const usedInviteToken = inviteToken || pendingInviteToken || undefined;
      const session = await registerApi({
        email,
        password,
        fullName,
        workspaceName: usedInviteToken ? undefined : (workspaceName || `${fullName || "User"} Workspace`),
        inviteToken: usedInviteToken,
      });
      if (usedInviteToken) clearPendingInvite();
      let me = null;
      try {
        me = await getMe();
      } catch {
        // Keep newly registered users signed in even if profile fetch is delayed.
      }
      setMemberships(me?.memberships || []);
      const membership = pickMembership(me?.memberships, session?.user?.workspaceId);
      const profile = membership?.profile || null;
      const nextWorkspaceId = session?.user?.workspaceId || membership?.workspace_id || "";
      if (nextWorkspaceId) localStorage.setItem(WORKSPACE_STORAGE_KEY, nextWorkspaceId);
      setWorkspaceId(nextWorkspaceId);
      const nextRole = session?.role || membership?.role || "student";
      setUserRole(nextRole);
      setViewerProfile({
        displayName: me?.user?.full_name || session?.user?.fullName || fullName || "",
        school: profile?.school_code || "",
        instructor: profile?.instructor || "",
        period: profile?.period || "",
        group: profile?.group_code || "",
        studentId: profile?.student_code || email.split("@")[0].toUpperCase(),
      });
      setIsLoggedIn(true);
      setActiveSection(nextRole === "teacher" ? "manageclasses" : "heatmap");
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

  /** Switch the client-side current workspace; server state is untouched. */
  const switchWorkspace = (nextWorkspaceId) => {
    const membership = memberships.find((m) => m.workspace_id === nextWorkspaceId);
    if (!membership || nextWorkspaceId === workspaceId) return;
    localStorage.setItem(WORKSPACE_STORAGE_KEY, nextWorkspaceId);
    lastProfileHierarchySnapRef.current = "";
    // Drop the previous workspace's measurement cache so the polling effect repopulates cleanly.
    serverMeasurementCountRef.current = null;
    clearImportedMeasurements();
    setImportedDataVersion((v) => v + 1);
    const profile = membership.profile || null;
    const schoolName = membership.school_name || "";
    setWorkspaceId(nextWorkspaceId);
    setUserRole(membership.role);
    setViewerProfile((prev) => ({
      ...prev,
      school: schoolName,
      instructor: profile?.instructor || "",
      period: profile?.period || "",
      group: profile?.group_code || "",
      studentId: profile?.student_code || "",
    }));
    setFilters((prev) => ({
      ...prev,
      school: schoolName,
      instructor: profile?.instructor || "",
      period: profile?.period || "",
      group: profile?.group_code || "",
      studentId: profile?.student_code || "",
    }));
    setActiveSection(membership.role === "teacher" ? "manageclasses" : "heatmap");
  };

  /** Signed-in user accepts a pending invite into an additional workspace. */
  const handleAcceptInvite = async () => {
    setInviteActionError("");
    setInviteActionLoading(true);
    try {
      const result = await acceptInvitation(pendingInviteToken);
      clearPendingInvite();
      const nextWorkspaceId = result?.workspace?.id || "";
      if (nextWorkspaceId) {
        localStorage.setItem(WORKSPACE_STORAGE_KEY, nextWorkspaceId);
        lastProfileHierarchySnapRef.current = "";
        serverMeasurementCountRef.current = null;
        clearImportedMeasurements();
        setImportedDataVersion((v) => v + 1);
        setWorkspaceId(nextWorkspaceId);
        const nextRole = result?.membership?.role || "student";
        setUserRole(nextRole);
        setActiveSection(nextRole === "teacher" ? "manageclasses" : "heatmap");
      }
      await syncFromMe();
    } catch (error) {
      setInviteActionError(error.message || "Could not accept the invitation.");
    } finally {
      setInviteActionLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutApi();
    } catch {
      // Ignore logout API errors and still clear local UI session.
    } finally {
      lastProfileHierarchySnapRef.current = "";
      // The pending invite token survives logout on purpose: an invitee signed in with the
      // wrong account logs out and lands back on the invite page to continue with the right one.
      localStorage.removeItem(WORKSPACE_STORAGE_KEY);
      setMemberships([]);
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

  const [mapSchoolFocus, setMapSchoolFocus] = useState(null);

  const handleTeacherSelectGroup = ({ period, group }) => {
    setFilters((prev) => ({
      ...prev,
      period: period || prev.period,
      group: group || prev.group,
    }));
    setMapSchoolFocus(null);
    setActiveSection("rawdata");
  };

  const handleOpenSchoolRawData = ({ schoolName, schoolDataLabel }) => {
    const school = schoolName || schoolDataLabel || "";
    setFilters((prev) => ({
      ...prev,
      school,
    }));
    setMapSchoolFocus(schoolDataLabel || schoolName || null);
    setActiveSection("rawdata");
  };

  const isTeacher = userRole === "teacher";

  // The Public / per-school aggregate workspaces are read-only views over other classes' data.
  const currentMembership = memberships.find((m) => m.workspace_id === workspaceId) || null;
  const currentWorkspaceKind = currentMembership?.kind || "class";
  const isReadOnlyWorkspace = currentWorkspaceKind !== "class";
  // Full name shown on hover in the sidebar tooltip.
  const workspaceFullName = (m) => {
    if (m.kind === "public") return "Public";
    if (m.kind === "school") return m.school_name || m.workspace_name || "School";
    return m.workspace_name || "Workspace";
  };

  // Sidebar icon: vector symbols for aggregate workspaces, up to two initials for a class.
  const workspaceIcon = (m) => {
    if (m.kind === "public") return <Globe2 className="h-5 w-5" aria-hidden="true" />;
    if (m.kind === "school") return <GraduationCap className="h-5 w-5" aria-hidden="true" />;
    const name = (m.workspace_name || "").trim();
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return "WS";
  };

  // Avatar initials for the person, from the global account profile - the same in every workspace
  // (owned or not). Falls back to the account name, then the per-workspace display name.
  const accountInitials = () => {
    const name = (accountProfile.display_name || account?.full_name || viewerProfile.displayName || "").trim();
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
    return "ME";
  };

  // Close the user-avatar popup on outside click or Escape.
  useEffect(() => {
    if (!userMenuOpen) return undefined;
    const onPointerDown = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") setUserMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [userMenuOpen]);

  // Note: "My Page" lives in the user-avatar popup (see below), not the top nav.
  const navItems = isTeacher
    ? [
        { id: 'manageclasses', label: 'Manage Classes', icon: Users },
        { id: 'heatmap', label: 'Heat Map', icon: MapPin },
        { id: 'rawdata', label: 'Raw Data', icon: Table },
        { id: 'analysis', label: 'Analysis', icon: BarChart3 },
      ]
    : [
        { id: 'heatmap', label: 'Heat Map', icon: MapPin },
        { id: 'rawdata', label: 'Raw Data', icon: Table },
        { id: 'analysis', label: 'Analysis', icon: BarChart3 },
      ];

  // Wait for Firebase to report the persisted session before choosing login vs. app, so a reload
  // of a signed-in user doesn't flash the login screen while the session is still being restored.
  if (!authReady) {
    return (
      <div
        className="min-h-screen bg-slate-50 font-sans text-slate-900 flex flex-col"
        style={{
          backgroundImage: `radial-gradient(#cbd5e1 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
        }}
      >
        <div className="w-full h-1.5 bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-600" />
        <div className="flex-1 flex items-center justify-center">
          <div
            className="h-10 w-10 rounded-full border-4 border-slate-200 border-t-blue-600 animate-spin"
            role="status"
            aria-label="Loading"
          />
        </div>
      </div>
    );
  }

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
          {pendingInviteToken ? (
            <InviteLanding
              token={pendingInviteToken}
              isLoggedIn={false}
              onRegister={handleRegister}
              onLogin={handleLogin}
              onGoogleLogin={handleGoogleLogin}
              onDismiss={clearPendingInvite}
              authError={authError}
              authLoading={authLoading}
            />
          ) : (
            <LandingPage
              onLogin={handleLogin}
              onRegister={handleRegister}
              onGoogleLogin={handleGoogleLogin}
              authError={authError}
              authLoading={authLoading}
            />
          )}
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
            inviteToken={pendingInviteToken}
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

  // Signed-in user opened an invite link: offer to join the additional workspace.
  if (pendingInviteToken) {
    return (
      <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-blue-100"
           style={{
             backgroundImage: `radial-gradient(#cbd5e1 1px, transparent 1px)`,
             backgroundSize: '24px 24px'
           }}
      >
        <div className="w-full h-1.5 bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-600 sticky top-0 z-50" />
        <main className="min-h-screen flex flex-col justify-center py-12">
          <InviteLanding
            token={pendingInviteToken}
            isLoggedIn
            currentEmail={auth.currentUser?.email || ""}
            onAccept={handleAcceptInvite}
            onDismiss={clearPendingInvite}
            onLogout={handleLogout}
            authError={inviteActionError}
            authLoading={inviteActionLoading}
          />
        </main>
        <footer className="py-8 text-center text-gray-400 text-sm font-bold uppercase tracking-widest">
          <p>Air Story • TAMGU LAB @TC</p>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Slack-style vertical workspace switcher */}
      {!isPublicMode && memberships.length > 0 && (
        <aside className="sticky top-0 h-screen w-20 shrink-0 bg-slate-900 flex flex-col items-center gap-3 py-4 overflow-y-auto z-50">
          {memberships.map((m) => {
            const active = m.workspace_id === workspaceId;
            return (
              <button
                key={m.workspace_id}
                type="button"
                onClick={() => switchWorkspace(m.workspace_id)}
                className="flex items-center justify-center"
                aria-label={workspaceFullName(m)}
                aria-current={active ? "true" : undefined}
                onMouseEnter={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  setWorkspaceTooltip({
                    name: workspaceFullName(m),
                    top: r.top + r.height / 2,
                    left: r.right + 12,
                  });
                }}
                onMouseLeave={() => setWorkspaceTooltip(null)}
                onFocus={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  setWorkspaceTooltip({
                    name: workspaceFullName(m),
                    top: r.top + r.height / 2,
                    left: r.right + 12,
                  });
                }}
                onBlur={() => setWorkspaceTooltip(null)}
              >
                <span
                  className={`flex items-center justify-center w-12 h-12 rounded-full text-sm font-bold transition-all ${
                    active
                      ? "bg-blue-600 text-white ring-2 ring-white shadow-lg"
                      : "bg-slate-700 text-slate-100 hover:bg-blue-600"
                  }`}
                >
                  {workspaceIcon(m)}
                </span>
              </button>
            );
          })}
        </aside>
      )}

      {/* Sidebar hover tooltip — fixed so it escapes the rail's scroll clipping. */}
      {workspaceTooltip && (
        <span
          className="pointer-events-none fixed z-[100] -translate-y-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white shadow-lg"
          style={{ top: workspaceTooltip.top, left: workspaceTooltip.left }}
        >
          {workspaceTooltip.name}
        </span>
      )}

      {/* Right column: top nav + main content */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
      {/* Top Navigation Bar — full-width so long school names don't crush the links */}
      <nav className="bg-white shadow-md border-b border-gray-200 sticky top-0 z-40">
        <div className="w-full px-6 xl:px-10 2xl:px-14">
          <div className="flex items-center gap-4 xl:gap-8 h-20">
            {/* Logo and Brand */}
            <button
              type="button"
              onClick={() => setActiveSection('heatmap')}
              className="flex shrink-0 items-center gap-3 focus:outline-none hover:opacity-80 transition-opacity"
              aria-label="Go to Heat Map"
            >
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                AirStory
              </h1>
            </button>

            {/* Main Navigation */}
            <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5 xl:gap-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveSection(item.id)}
                    className={`flex items-center gap-2 px-3 xl:px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
                      activeSection === item.id
                        ? `bg-blue-600 text-white shadow-lg`
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    <span className="hidden md:inline">{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Account cluster: identity + logout stay together on the right */}
            <div className="flex shrink-0 items-center gap-3 xl:gap-4">
              {!isPublicMode && (
                <>
                  <div className="hidden min-w-[12rem] max-w-[16rem] text-right lg:block xl:max-w-[20rem] 2xl:max-w-[24rem]">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {isTeacher
                        ? (viewerProfile.displayName || viewerProfile.instructor || "Instructor")
                        : (viewerProfile.displayName || viewerProfile.studentId || filters.studentId || "Student")}
                    </p>
                    <p
                      className="truncate text-xs text-gray-500"
                      title={viewerProfile.school || filters.school || undefined}
                    >
                      {viewerProfile.school || filters.school || "No school assigned"}
                    </p>
                    <p className="truncate text-[11px] text-gray-400">
                      {isTeacher
                        ? "Teacher Portal"
                        : `Group ${(viewerProfile.group || filters.group || "").replace("G", "") || "—"}`}
                    </p>
                  </div>
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center border-2 border-white shadow-md shrink-0">
                    <span className="text-white text-sm font-semibold">
                      {isTeacher
                        ? teacherNavInitials()
                        : (() => {
                            const name = (viewerProfile.displayName || "").trim();
                            const parts = name.split(/\s+/).filter(Boolean);
                            if (parts.length >= 2) {
                              return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
                            }
                            if (parts.length === 1 && parts[0].length >= 2) {
                              return parts[0].slice(0, 2).toUpperCase();
                            }
                            const code = viewerProfile.studentId || filters.studentId || "ST";
                            return code.slice(0, 2).toUpperCase();
                          })()}
                    </span>
                  </div>
                </>
              )}
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 xl:px-4 py-2 rounded-lg font-medium text-red-600 hover:bg-red-50 transition-all"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
                <span className="hidden lg:inline">Logout</span>
              </button>
            </div>

            {/* User menu — click the avatar to open a popup of account options. Hidden in public mode. */}
            {!isPublicMode && (
              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setUserMenuOpen((open) => !open)}
                  className="flex items-center gap-3 rounded-full pl-2 pr-1 py-1 hover:bg-gray-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  aria-haspopup="menu"
                  aria-expanded={userMenuOpen}
                  aria-label="Account menu"
                >
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
                      {accountInitials()}
                    </span>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-gray-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                {userMenuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-lg border border-gray-200 py-1.5 z-50 animate-fade-in"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setActiveSection('mypage');
                        setUserMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
                        activeSection === 'mypage'
                          ? 'text-blue-600 bg-blue-50'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <User className="w-4 h-4" />
                      My Page
                    </button>
                    {/* Future account options go here */}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main
        className={
          activeSection === 'heatmap'
            ? 'w-full flex-1 px-3 py-3 sm:px-4'
            : activeSection === 'workspace'
              ? 'w-full flex-1 px-4 py-6'
              : 'w-full max-w-7xl mx-auto px-6 py-8'
        }
      >
        {(heatMapSectionMounted || activeSection === 'heatmap') && (
          <div
            className={activeSection === 'heatmap' ? 'block' : 'hidden'}
            aria-hidden={activeSection !== 'heatmap'}
          >
            <HeatMapDashboard
              workspaceId={workspaceId}
              workspaceKind={currentWorkspaceKind}
              schoolId={currentMembership?.school_id || null}
              selectedMetric={selectedMetric}
              setSelectedMetric={setSelectedMetric}
              filters={filters}
              setFilters={setFilters}
              theme={currentTheme}
              metricThemes={METRIC_THEMES}
              importedDataVersion={importedDataVersion}
              onOpenRawData={handleOpenSchoolRawData}
            />
          </div>
        )}
        {(rawDataSectionMounted || activeSection === 'rawdata') && (
          <div
            className={activeSection === 'rawdata' ? 'block' : 'hidden'}
            aria-hidden={activeSection !== 'rawdata'}
          >
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
              importedDataVersion={importedDataVersion}
              classStructure={classStructure}
              isReadOnly={isReadOnlyWorkspace}
              userRole={userRole}
              schoolFocus={mapSchoolFocus}
            />
          </div>
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
            onSendToWorkspace={handleAddWorkspaceItem}
            userRole={userRole}
          />
        )}
        {activeSection === 'workspace' && (
          <WorkspaceView
            filters={filters}
            theme={currentTheme}
            metricThemes={METRIC_THEMES}
            importedDataVersion={importedDataVersion}
            workspaceItems={workspaceItems}
            onAddItem={handleAddWorkspaceItem}
            onRemoveItem={handleRemoveWorkspaceItem}
            onUpdateItem={handleUpdateWorkspaceItem}
          />
        )}
        {activeSection === 'mypage' && (
          <MyPage
            theme={currentTheme}
            onLogout={handleLogout}
            memberships={memberships}
            account={account}
            profile={accountProfile}
            onProfileSaved={setAccountProfile}
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
            onSchoolChanged={syncFromMe}
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
    </div>
  );
}