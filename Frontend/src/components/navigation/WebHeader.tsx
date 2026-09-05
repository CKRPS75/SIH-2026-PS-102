import { useRef, useState, useEffect } from "react";
import { getProfile } from "../../data/auth";
import type { SidebarDestination } from "./Sidebar";

interface WebHeaderProps {
  title: string;
  onMenu: () => void;
  onNotifications: () => void;
  onNavigate: (destination: SidebarDestination) => void;
  onSignOut: () => void;
  notificationsUnread?: boolean;
}

function WebHeader({ title, onMenu, onNotifications, onNavigate, onSignOut, notificationsUnread = true }: WebHeaderProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const profile = getProfile();

  useEffect(() => {
    function closeMenu(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", closeMenu);
    return () => document.removeEventListener("mousedown", closeMenu);
  }, []);

  function navigate(destination: SidebarDestination) {
    setOpen(false);
    onNavigate(destination);
  }

  return (
    <header className="web-header">
      <div className="header-leading">
        <button className="icon-button menu-button" onClick={onMenu} aria-label="Toggle navigation"><span>☰</span></button>
        <div className="breadcrumb"><span>Workspace</span><b>/</b><strong>{title}</strong></div>
      </div>
      <div className="header-actions">
        <div className="gateway-status"><span className="status-dot" /> AI Gateway Active</div>
        <button className="icon-button notification-button" onClick={onNotifications} aria-label="Notifications">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22a2.3 2.3 0 0 0 2.2-2h-4.4A2.3 2.3 0 0 0 12 22zm7-5v-5a7 7 0 0 0-5.5-6.8V4a1.5 1.5 0 0 0-3 0v1.2A7 7 0 0 0 5 12v5l-2 2v1h18v-1l-2-2z" /></svg>{notificationsUnread && <i />}
        </button>
        <div className="profile-menu-wrap" ref={menuRef}>
          <button className="profile-trigger" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
            <span className="avatar">GO</span><span className="profile-copy"><strong>{profile.name}</strong><small>{profile.role}</small></span><span className="chevron">⌄</span>
          </button>
          {open && <div className="profile-menu">
            <div className="profile-menu-heading"><span className="avatar avatar-large">GO</span><div><strong>{profile.name}</strong><small>{profile.email}</small></div></div>
            <button onClick={() => navigate("profile")}>Profile</button>
            <button onClick={() => navigate("preferences")}>Preferences</button>
            <button onClick={() => navigate("auditlogs")}>Audit Logs</button>
            <button className="menu-danger" onClick={() => { setOpen(false); onSignOut(); }}>Sign Out</button>
          </div>}
        </div>
      </div>
    </header>
  );
}

export { WebHeader };