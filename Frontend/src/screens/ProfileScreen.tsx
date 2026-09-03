import { useState } from "react";
import { getProfile, saveProfile } from "../data/auth";
import type { OfficerProfile } from "../data/auth";
import { Card } from "../components/common/Card";

// ── Profile Screen ─────────────────────────────────────────────────────────────

interface ProfileScreenProps {
  onClose: () => void;
}

export function ProfileScreen({ onClose }: ProfileScreenProps) {
  const [profile, setProfile] = useState<OfficerProfile>(getProfile);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<OfficerProfile>(profile);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    saveProfile(draft);
    setProfile(draft);
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function handleCancel() {
    setDraft(profile);
    setEditing(false);
  }

  const rows: { l: string; key: keyof OfficerProfile; editable?: boolean }[] = [
    { l: "Officer ID", key: "officerId" },
    { l: "Role", key: "role" },
    { l: "Department", key: "department", editable: true },
    { l: "Email", key: "email", editable: true },
    { l: "Account Status", key: "status" },
    { l: "Last Login", key: "lastLogin" },
  ];

  return (
    <div className="flex h-full flex-col animate-fade-in" style={{ background: "#F3F0F9" }}>
      <div className="flex items-center justify-end px-8 pt-6">
        {!editing && <button onClick={() => { setDraft(profile); setEditing(true); }} className="h-9 px-4 rounded-lg text-xs font-semibold md-ripple" style={{ background: "#E8E7FF", color: "#4F46E5" }}>Edit Profile</button>}
      </div>

      {/* Success banner */}
      {saved && (
        <div className="mx-4 mt-3 px-4 py-2.5 rounded-2xl text-xs font-medium flex items-center gap-2 animate-scale-in" style={{ background: "#D4F8E8", color: "#006C4C" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
          Profile saved successfully!
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-8 py-4 space-y-4 max-w-3xl">
        {/* Avatar + Name */}
        <Card>
          <div className="p-5 flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-black text-white shrink-0"
              style={{ background: "#4F46E5" }}
            >
              GO
            </div>
            <div className="flex-1 min-w-0">
              {editing ? (
                <input
                  type="text"
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  className="w-full px-3 py-1.5 rounded-xl text-sm font-semibold outline-none"
                  style={{ background: "#F3F0F9", border: "1px solid #CAC4D0", color: "#1C1B1F" }}
                />
              ) : (
                <div className="text-base font-semibold" style={{ color: "#1C1B1F" }}>{profile.name}</div>
              )}
              <div className="text-xs mt-1" style={{ color: "#49454F" }}>{profile.role}</div>
              <div className="text-[10px] mt-0.5 font-mono" style={{ color: "#79747E" }}>{profile.officerId}</div>
            </div>
          </div>
        </Card>

        {/* Profile fields */}
        <Card>
          <div className="p-4 space-y-0">
            {rows.map((row, i) => (
              <div key={row.key}>
                {i > 0 && <div className="h-px my-2" style={{ background: "#ECE6F0" }} />}
                <div className="flex items-start justify-between gap-3">
                  <span className="text-[10px] font-medium shrink-0 pt-0.5" style={{ color: "#79747E" }}>{row.l}</span>
                  {editing && row.editable ? (
                    <input
                      type="text"
                      value={draft[row.key] as string}
                      onChange={(e) => setDraft((d) => ({ ...d, [row.key]: e.target.value }))}
                      className="flex-1 text-right px-2 py-1 rounded-lg text-xs outline-none"
                      style={{ background: "#F3F0F9", border: "1px solid #CAC4D0", color: "#1C1B1F" }}
                    />
                  ) : (
                    <span className="text-xs font-medium text-right" style={{ color: row.key === "status" ? "#006C4C" : "#1C1B1F" }}>
                      {profile[row.key] as string}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Action buttons when editing */}
        {editing && (
          <div className="flex gap-3">
            <button
              onClick={handleCancel}
              className="flex-1 h-12 rounded-3xl text-sm font-semibold md-ripple"
              style={{ background: "#ECE6F0", color: "#1C1B1F" }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex-1 h-12 rounded-3xl text-sm font-semibold text-white md-ripple"
              style={{ background: "#4F46E5" }}
            >
              Save Changes
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

