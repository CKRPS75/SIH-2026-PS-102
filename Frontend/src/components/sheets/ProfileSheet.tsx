import { useState } from "react";
import { BottomSheet } from "../common/BottomSheet";
import { getProfile } from "../../data/auth";

// ── Profile Sheet ─────────────────────────────────────────────────────────────

type ProfileNav = "profile" | "preferences" | "auditlogs" | null;

interface ProfileSheetProps {
  onClose: () => void;
  onNavigate: (to: ProfileNav) => void;
  onSignOut: () => void;
}

function ProfileSheet({ onClose, onNavigate, onSignOut }: ProfileSheetProps) {
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const profile = getProfile();

  const items: { label: string; icon: string; nav?: ProfileNav; danger?: boolean }[] = [
    { label: "Profile", icon: "👤", nav: "profile" },
    { label: "Preferences", icon: "⚙️", nav: "preferences" },
    { label: "Audit Logs", icon: "📋", nav: "auditlogs" },
    { label: "Sign Out", icon: "🚪", danger: true },
  ];

  if (confirmSignOut) {
    return (
      <BottomSheet onClose={() => setConfirmSignOut(false)}>
        <div className="px-5 pb-6 space-y-4">
          <div className="text-center space-y-2 pt-2">
            <div className="text-base font-semibold" style={{ color: "#1C1B1F" }}>
              Sign Out?
            </div>
            <div className="text-sm" style={{ color: "#49454F" }}>
              Are you sure you want to sign out of MPLADS AI-Guardian?
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setConfirmSignOut(false)}
              className="flex-1 h-12 rounded-3xl text-sm font-semibold md-ripple"
              style={{ background: "#ECE6F0", color: "#1C1B1F" }}
            >
              Cancel
            </button>
            <button
              onClick={() => { setConfirmSignOut(false); onClose(); onSignOut(); }}
              className="flex-1 h-12 rounded-3xl text-sm font-semibold text-white md-ripple"
              style={{ background: "#B3261E" }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet onClose={onClose}>
      <div className="px-5 pb-2">
        <div className="flex items-center gap-4 pb-4">
          <div className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold text-white" style={{ background: "#4F46E5" }}>GO</div>
          <div>
            <div className="font-semibold" style={{ color: "#1C1B1F" }}>{profile.name}</div>
            <div className="text-xs" style={{ color: "#49454F" }}>{profile.role}</div>
            <div className="text-[10px] mt-0.5 font-mono" style={{ color: "#79747E" }}>{profile.email}</div>
          </div>
        </div>
        <div className="h-px mb-2" style={{ background: "#ECE6F0" }} />
      </div>
      <div className="px-3 pb-6 space-y-1">
        {items.map((it) => (
          <button
            key={it.label}
            onClick={() => {
              if (it.danger) {
                setConfirmSignOut(true);
              } else if (it.nav) {
                onClose();
                onNavigate(it.nav);
              }
            }}
            className="w-full flex items-center gap-4 px-4 py-3 rounded-3xl state-hover-onsurf"
          >
            <span className="text-lg">{it.icon}</span>
            <span className="text-sm font-medium" style={{ color: it.danger ? "#B3261E" : "#1C1B1F" }}>{it.label}</span>
            {!it.danger && (
              <svg className="ml-auto" width="16" height="16" viewBox="0 0 24 24" fill="#CAC4D0">
                <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
              </svg>
            )}
          </button>
        ))}
      </div>
    </BottomSheet>
  );
}

export { ProfileSheet };
export type { ProfileNav };
