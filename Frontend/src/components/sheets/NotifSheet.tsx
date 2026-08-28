import { BottomSheet } from "../common/BottomSheet";

// ── Notification Sheet ────────────────────────────────────────────────────────

function NotifSheet({ onClose }: { onClose: () => void }) {
  const notifs = [
    { dot: "#B3261E", title: "Critical anomaly detected", sub: "Community Hall Kurla · just now" },
    { dot: "#B3261E", title: "BSR inflation detected", sub: "Solar Street Lights Chembur · 5m ago" },
    { dot: "#F59E0B", title: "Split sanction warning", sub: "Paver Block Footpath · 12m ago" },
  ];
  return (
    <BottomSheet onClose={onClose} title="Notifications">
      <div className="px-5 pb-2 flex justify-end">
        <button className="text-xs font-semibold" style={{ color: "#4F46E5" }}>Mark all as read</button>
      </div>
      <div className="px-3 pb-6 space-y-1">
        {notifs.map((n, i) => (
          <div key={i} className="flex gap-3 px-3 py-3 rounded-3xl state-hover-onsurf cursor-pointer">
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
