import type { Tab } from "../../data/projects";

type SidebarDestination = Tab | "profile" | "preferences" | "auditlogs";

interface SidebarProps {
  active: SidebarDestination;
  collapsed: boolean;
  disabled?: boolean;
  onNavigate: (destination: SidebarDestination) => void;
  onSignOut: () => void;
}

const icons: Record<string, string> = {
  home: "M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-8.5z",
  audits: "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm2 4v2h10V7H7zm0 4v2h7v-2H7zm0 4v2h10v-2H7z",
  judge: "M12 2 4 5.5v5.3c0 5 3.4 9.6 8 11.2 4.6-1.6 8-6.2 8-11.2V5.5L12 2zm0 4.2 5 2.2v2.4c0 3.5-2.1 6.9-5 8.4-2.9-1.5-5-4.9-5-8.4V8.4l5-2.2z",
  field: "M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm2 3v10h8V5H8zm2 13h4v2h-4v-2z",
  profile: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-4.4 0-8 2.2-8 5v1h16v-1c0-2.8-3.6-5-8-5z",
  preferences: "M19.4 13a7.8 7.8 0 0 0 0-2l2-1.5-2-3.5-2.4 1a7.3 7.3 0 0 0-1.7-1L15 3h-6l-.3 3a7.3 7.3 0 0 0-1.7 1l-2.4-1-2 3.5L4.6 11a7.8 7.8 0 0 0 0 2l-2 1.5 2 3.5 2.4-1a7.3 7.3 0 0 0 1.7 1L9 21h6l.3-3a7.3 7.3 0 0 0 1.7-1l2.4 1 2-3.5-2-1.5zM12 15a3 3 0 1 1 0-6 3 3 0 0 1 0 6z",
  auditlogs: "M6 2h9l4 4v16H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm8 1v4h4M8 11h8M8 15h8M8 19h5",
};

function Sidebar({ active, collapsed, disabled = false, onNavigate, onSignOut }: SidebarProps) {
  const mainItems: { key: Tab; label: string }[] = [
    { key: "home", label: "Dashboard" },
    { key: "audits", label: "AI Audit" },
    { key: "judge", label: "Evaluate" },
    { key: "field", label: "Field Audit" },
  ];
  const accountItems: { key: SidebarDestination; label: string }[] = [
    { key: "profile", label: "Profile" },
    { key: "preferences", label: "Preferences" },
    { key: "auditlogs", label: "Audit Logs" },
  ];

  const item = (entry: { key: SidebarDestination; label: string }) => (
    <button
      key={entry.key}
      onClick={() => onNavigate(entry.key)}
      disabled={disabled}
      title={collapsed ? entry.label : undefined}
      className={`sidebar-item ${active === entry.key ? "sidebar-item-active" : ""}`}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d={icons[entry.key]} /></svg>
      {!collapsed && <span>{entry.label}</span>}
    </button>
  );

  return (
    <aside className={`app-sidebar ${collapsed ? "app-sidebar-collapsed" : ""}`}>
      <div className="sidebar-brand">
        <div className="brand-mark">AG</div>
        {!collapsed && <div><strong>MPLADS</strong><span>AI-GUARDIAN</span></div>}
      </div>
      <div className="sidebar-group-label">{!collapsed && "MAIN NAVIGATION"}</div>
      <nav className="sidebar-nav">{mainItems.map(item)}</nav>
      <div className="sidebar-group-label account-label">{!collapsed && "ACCOUNT"}</div>
      <nav className="sidebar-nav">{accountItems.map(item)}</nav>
      <div className="sidebar-spacer" />
      <button className="sidebar-item sidebar-signout" onClick={onSignOut} disabled={disabled} title={collapsed ? "Sign Out" : undefined}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 17l1.4-1.4-2.6-2.6H20v-2H8.8l2.6-2.6L10 7l-5 5 5 5zm9-14h-7v2h7v14h-7v2h7a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z" /></svg>
        {!collapsed && <span>Sign Out</span>}
      </button>
      {!collapsed && <div className="sidebar-footer">Secure government workspace<br /><span>AI Gateway v2.4</span></div>}
    </aside>
  );
}

export { Sidebar };
export type { SidebarDestination };