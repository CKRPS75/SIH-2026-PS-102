import { useState } from "react";
import type { Tab, Project } from "./data/projects";
import { StatusBar } from "./components/common/StatusBar";
import { NavBar } from "./components/common/NavBar";
import { HomeScreen } from "./screens/HomeScreen";
import { AuditsScreen } from "./screens/AuditsScreen";
import { JudgeScreen } from "./screens/JudgeScreen";
import { FieldScreen } from "./screens/FieldScreen";
import { RiskAuditSheet } from "./components/sheets/RiskAuditSheet";
import { NotifSheet } from "./components/sheets/NotifSheet";
import { ProfileSheet } from "./components/sheets/ProfileSheet";
import { BottomNav } from "./components/navigation/BottomNav";

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [tab, setTab] = useState<Tab>("home");
  const [auditProject, setAuditProject] = useState<Project | null>(null);
  const [showNotif, setShowNotif] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  return (
    <div className="min-h-full flex items-center justify-center p-4" style={{ background: "#1a1a2e" }}>
      {/* Android phone frame */}
      <div
        className="relative flex flex-col overflow-hidden"
        style={{
          width: 390,
          height: 844,
          background: "#F3F0F9",
          borderRadius: 44,
          border: "8px solid #2d2d4a",
          boxShadow: "0 0 0 1px #3d3d5c, 0 40px 120px rgba(0,0,0,0.7), inset 0 0 0 1px rgba(255,255,255,0.05)",
        }}
      >
        {/* Camera notch */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full z-30" style={{ background: "#111" }} />

        {/* Status Bar */}
        <StatusBar />

        {/* Screen content */}
        <div className="flex-1 flex flex-col overflow-hidden relative" style={{ background: "#F3F0F9" }}>
          {/* Top App Bar actions — overlaid */}
          <div className="absolute top-0 right-3 z-20 flex items-center gap-1 py-2">
            <button onClick={() => { setShowNotif(true); setShowProfile(false); }} className="w-9 h-9 rounded-full flex items-center justify-center state-hover-onsurf relative">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#49454F"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full" style={{ background: "#B3261E", border: "1.5px solid #F3F0F9" }} />
            </button>
            <button onClick={() => { setShowProfile(true); setShowNotif(false); }} className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs text-white" style={{ background: "#4F46E5" }}>GO</button>
          </div>

          {tab === "home" && <HomeScreen onOpenAudit={p => setAuditProject(p)} />}
          {tab === "audits" && <AuditsScreen onOpenAudit={p => setAuditProject(p)} />}
          {tab === "judge" && <JudgeScreen onOpenAudit={p => setAuditProject(p)} />}
          {tab === "field" && <FieldScreen />}

          {/* Bottom sheets */}
          {auditProject && <RiskAuditSheet project={auditProject} onClose={() => setAuditProject(null)} />}
          {showNotif && <NotifSheet onClose={() => setShowNotif(false)} />}
          {showProfile && <ProfileSheet onClose={() => setShowProfile(false)} />}
        </div>

        {/* Bottom Navigation */}
        <BottomNav tab={tab} setTab={setTab} />

        {/* Android nav bar */}
        <NavBar />
      </div>
    </div>
  );
}
