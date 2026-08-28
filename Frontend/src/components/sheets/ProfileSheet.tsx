import { BottomSheet } from "../common/BottomSheet";

// ── Profile Sheet ─────────────────────────────────────────────────────────────

function ProfileSheet({ onClose }: { onClose: () => void }) {
  const items = [
    { label: "Profile", icon: "👤" },
    { label: "Preferences", icon: "⚙️" },
    { label: "Audit Logs", icon: "📋" },
    { label: "Sign Out", icon: "🚪", danger: true },
  ];
  return (
    <BottomSheet onClose={onClose}>
      <div className="px-5 pb-2">
        <div className="flex items-center gap-4 pb-4">
          <div className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold text-white" style={{ background: "#4F46E5" }}>GO</div>
          <div>
            <div className="font-semibold" style={{ color: "#1C1B1F" }}>Government Officer</div>
            <div className="text-xs" style={{ color: "#49454F" }}>MPLADS Audit Officer</div>
            <div className="text-[10px] mt-0.5 font-mono" style={{ color: "#79747E" }}>gov.officer@mplads.gov.in</div>
          </div>
        </div>
        <div className="h-px mb-2" style={{ background: "#ECE6F0" }} />
      </div>
      <div className="px-3 pb-6 space-y-1">
        {items.map(it => (
          <button key={it.label} onClick={onClose} className="w-full flex items-center gap-4 px-4 py-3 rounded-3xl state-hover-onsurf">
            <span className="text-lg">{it.icon}</span>
            <span className="text-sm font-medium" style={{ color: it.danger ? "#B3261E" : "#1C1B1F" }}>{it.label}</span>
          </button>
        ))}
      </div>
    </BottomSheet>
  );
}

export { ProfileSheet };
