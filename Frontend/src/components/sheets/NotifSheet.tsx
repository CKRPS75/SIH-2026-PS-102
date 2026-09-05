import { useEffect, useState } from "react";
import { getMockLiveAlerts, type PredictionRow } from "../../api";
import { getLogs, getPreferences, getReadNotificationIds, markNotificationsRead, type AuditLogEntry } from "../../data/auth";
import type { Project } from "../../data/projects";
import { BottomSheet } from "../common/BottomSheet";

type NotificationItem = {
  id: string;
  dot: string;
  title: string;
  sub: string;
  destination: "audits" | "field" | "auditlogs";
};

function predictionNotification(row: Project | PredictionRow): NotificationItem {
  const isPrediction = "model_risk_level" in row;
  const status = isPrediction ? row.model_risk_level : row.status;
  const anomaly = isPrediction ? row.model_reasons[0] : row.anomaly;
  const title = status === "RED" || status === "HIGH RISK"
    ? "Critical anomaly detected"
    : anomaly === "Overpricing"
      ? "BSR inflation detected"
      : anomaly === "Split Sanction"
        ? "Split sanction warning"
        : "High-risk project detected";
  const id = isPrediction ? row.project_key : row.id;
  const label = isPrediction ? row.work_clean || row.project_key : row.title;
  return { id: `project:${id}:${title}`, dot: title === "High-risk project detected" ? "#F59E0B" : "#B3261E", title, sub: `${label} · recent`, destination: "audits" };
}

function logNotification(log: AuditLogEntry): NotificationItem {
  const title = log.action === "Field Audit completed" || log.action === "Site evidence captured"
    ? "Field audit submitted"
    : log.action === "Project evaluated"
      ? "Audit completed"
      : log.action;
  return { id: `log:${log.id}`, dot: log.status === "Failed" ? "#B3261E" : "#F59E0B", title, sub: `${log.projectName || log.officer} · ${log.date}`, destination: log.action.toLowerCase().includes("field") ? "field" : "auditlogs" };
}

// ── Notification Sheet ────────────────────────────────────────────────────────

function NotifSheet({ onClose, onNavigate, onMarkAllRead }: { onClose: () => void; onNavigate?: (destination: "audits" | "field" | "auditlogs") => void; onMarkAllRead?: () => void }) {
  const [notifs, setNotifs] = useState<NotificationItem[]>([]);
  const [readIds, setReadIds] = useState<string[]>(getReadNotificationIds);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const preferences = getPreferences();
    const logs = preferences.notifAuditAlerts
      ? getLogs().slice(0, 3).filter(log => preferences.notifFieldAudit || !log.action.toLowerCase().includes("field")).map(logNotification)
      : [];
    setNotifs(logs);
    setLoading(false);

    if (preferences.notifHighRisk) {
      getMockLiveAlerts(3).then(alertProjects => {
        if (!active) return;
        const alerts = alertProjects.map(predictionNotification);
        setNotifs(current => [...alerts, ...current].slice(0, 6));
      }).catch(() => {
        // Local audit notifications remain visible when the live-alert API is unavailable.
      });
    }
    return () => { active = false; };
  }, []);

  function markAllAsRead() {
    const ids = notifs.map(notification => notification.id);
    markNotificationsRead(ids);
    setReadIds(current => [...new Set([...current, ...ids])]);
    onMarkAllRead?.();
  }

  return (
    <BottomSheet onClose={onClose} title="Notifications">
      <div className="px-5 pb-2 flex justify-end">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            markAllAsRead();
          }}
          className="text-xs font-semibold"
          style={{ color: "#4F46E5" }}
        >
          Mark all as read
        </button>
      </div>
      <div className="px-3 pb-6 space-y-1">
        {loading && <div className="px-3 py-3 text-xs" style={{ color: "#79747E" }}>Loading notifications...</div>}
        {!loading && notifs.length === 0 && <div className="px-3 py-3 text-xs" style={{ color: "#79747E" }}>No notifications available.</div>}
        {notifs.map(n => (
          <div key={n.id} onClick={() => { markNotificationsRead([n.id]); setReadIds(current => current.includes(n.id) ? current : [...current, n.id]); onNavigate?.(n.destination); onClose(); }} className="flex gap-3 px-3 py-3 rounded-3xl state-hover-onsurf cursor-pointer" style={{ opacity: readIds.includes(n.id) ? 0.62 : 1 }}>
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0" style={{ background: n.dot + "20" }}>
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: n.dot }} />
            </div>
            <div>
              <div className="text-sm font-medium" style={{ color: "#1C1B1F" }}>{n.title}</div>
              <div className="text-xs" style={{ color: "#79747E" }}>{n.sub}</div>
            </div>
          </div>
        ))}
      </div>
    </BottomSheet>
  );
}

export { NotifSheet };
