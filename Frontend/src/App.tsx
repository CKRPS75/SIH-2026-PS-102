import { useEffect, useState } from "react";
import type { Tab, Project } from "./data/projects";
import { getProjects } from "./api";
import { isSignedIn, signOut } from "./data/auth";
import { HomeScreen } from "./screens/HomeScreen";
import { AuditsScreen } from "./screens/AuditsScreen";
import { JudgeScreen } from "./screens/JudgeScreen";
import { FieldScreen } from "./screens/FieldScreen";
import { SignInScreen } from "./screens/SignInScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { PreferencesScreen } from "./screens/PreferencesScreen";
import { AuditLogsScreen } from "./screens/AuditLogsScreen";
import { RiskAuditSheet } from "./components/sheets/RiskAuditSheet";
import { NotifSheet } from "./components/sheets/NotifSheet";
import { Sidebar } from "./components/navigation/Sidebar";
import type { SidebarDestination } from "./components/navigation/Sidebar";
import { WebHeader } from "./components/navigation/WebHeader";

// ── App ───────────────────────────────────────────────────────────────────────

const FIELD_ASSIGNMENTS_KEY = "mplads-field-assignments";

function loadFieldAssignments(): Project[] {
  try {
    const stored = window.localStorage.getItem(FIELD_ASSIGNMENTS_KEY);
    return stored ? JSON.parse(stored) as Project[] : [];
  } catch {
    return [];
  }
}

export default function App() {
  const [signedIn, setSignedIn] = useState(() => isSignedIn());
  const [tab, setTab] = useState<Tab>("home");
  const [projects, setProjects] = useState<Project[]>([]);
  const [fieldAssignments, setFieldAssignments] = useState<Project[]>(loadFieldAssignments);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [auditProject, setAuditProject] = useState<Project | null>(null);
  const [fieldProjectId, setFieldProjectId] = useState<string | null>(null);
  const [showNotif, setShowNotif] = useState(false);
  const [profileNav, setProfileNav] = useState<SidebarDestination | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  useEffect(() => {
    getProjects()
      .then(setProjects)
      .catch(requestError => setError(requestError instanceof Error ? requestError.message : "Unable to load projects"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    window.localStorage.setItem(FIELD_ASSIGNMENTS_KEY, JSON.stringify(fieldAssignments));
  }, [fieldAssignments]);

  function handleRequestFieldAudit(project: Project) {
    setFieldProjectId(project.id);
    setFieldAssignments(current => {
      if (current.some(assigned => assigned.id === project.id)) return current;
      return [project, ...current];
    });
    setTab("field");
  }

  function handleOpenAudit(project: Project) {
    setAuditProject(project);
    setProfileNav(null);
  }

  function handleOpenDashboardAudit(project: Project) {
    setTab("home");
    handleOpenAudit(project);
  }

  function handleSignOut() {
    signOut();
    setSignedIn(false);
    setProfileNav(null);
    setAuditProject(null);
  }

  function handleSignedIn() {
    setSignedIn(true);
    setTab("home");
  }

  function navigate(destination: SidebarDestination) {
    if (destination === "home" || destination === "audits" || destination === "judge" || destination === "field") {
      setTab(destination);
      setProfileNav(null);
      return;
    }
    setProfileNav(destination);
  }

  const pageTitle = profileNav === "profile" ? "Profile" : profileNav === "preferences" ? "Preferences" : profileNav === "auditlogs" ? "Audit Logs" : tab === "home" ? "Dashboard" : tab === "audits" ? "AI Audit" : tab === "judge" ? "Evaluate" : "Field Audit";

  const renderContent = () => {
    if (!signedIn) {
      return <SignInScreen onSignedIn={handleSignedIn} />;
    }
    return (
      <div className="app-content-area">
        <WebHeader title={pageTitle} onMenu={() => setSidebarCollapsed((value) => !value)} onNotifications={() => setShowNotif(true)} onNavigate={navigate} onSignOut={() => setConfirmSignOut(true)} />
        <main className="app-main">
          {loading && <div className="loading-state">Loading live predictions...</div>}
          {!loading && error && <div className="loading-state">{error}</div>}
          {!loading && !error && !profileNav && tab === "home" && <HomeScreen projects={projects} onOpenAudit={handleOpenDashboardAudit} />}
          {!loading && !error && !profileNav && tab === "audits" && <AuditsScreen projects={projects} onOpenAudit={handleOpenAudit} />}
          {!loading && !error && !profileNav && tab === "judge" && <JudgeScreen projects={projects} onOpenAudit={handleOpenAudit} />}
          {!loading && !error && !profileNav && tab === "field" && <FieldScreen assignments={fieldAssignments} selectedProjectId={fieldProjectId} />}
          {profileNav === "profile" && <ProfileScreen onClose={() => setProfileNav(null)} />}
          {profileNav === "preferences" && <PreferencesScreen onClose={() => setProfileNav(null)} />}
          {profileNav === "auditlogs" && <AuditLogsScreen onClose={() => setProfileNav(null)} />}

          {auditProject && tab === "home" && <RiskAuditSheet project={auditProject} onClose={() => setAuditProject(null)} onRequestFieldAudit={handleRequestFieldAudit} />}
          {showNotif && <NotifSheet onClose={() => setShowNotif(false)} />}
          {confirmSignOut && <div className="confirm-backdrop" onClick={() => setConfirmSignOut(false)}><div className="confirm-dialog" onClick={(event) => event.stopPropagation()}><div className="confirm-icon">!</div><h2>Sign out?</h2><p>Are you sure you want to sign out of MPLADS AI-Guardian?</p><div className="confirm-actions"><button onClick={() => setConfirmSignOut(false)}>Cancel</button><button className="danger-button" onClick={() => { setConfirmSignOut(false); handleSignOut(); }}>Sign Out</button></div></div></div>}
        </main>
      </div>
    );
  };

  return (
    <div className={`app-shell ${sidebarCollapsed ? "sidebar-is-collapsed" : ""}`}>
      {signedIn && <Sidebar active={profileNav ?? tab} collapsed={sidebarCollapsed} disabled={Boolean(auditProject && tab === "home")} onNavigate={navigate} onSignOut={() => setConfirmSignOut(true)} />}
      {renderContent()}
    </div>
  );
}
