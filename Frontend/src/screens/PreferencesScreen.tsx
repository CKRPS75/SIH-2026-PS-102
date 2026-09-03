import { useState } from "react";
import { getPreferences, savePreferences, resetPreferences } from "../data/auth";
import type { Preferences } from "../data/auth";
import { Card } from "../components/common/Card";

// ── Preferences Screen ────────────────────────────────────────────────────────

interface PreferencesScreenProps {
  onClose: () => void;
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="relative shrink-0 rounded-full transition-colors"
      style={{
        width: 44,
        height: 24,
        background: value ? "#4F46E5" : "#CAC4D0",
      }}
    >
      <div
        className="absolute top-1 rounded-full bg-white transition-all"
        style={{
          width: 16,
          height: 16,
          left: value ? 24 : 4,
        }}
      />
    </button>
  );
}

export function PreferencesScreen({ onClose }: PreferencesScreenProps) {
  const [prefs, setPrefs] = useState<Preferences>(getPreferences);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    savePreferences(prefs);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function handleReset() {
    resetPreferences();
    setPrefs(getPreferences());
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function set<K extends keyof Preferences>(key: K, value: Preferences[K]) {
    setPrefs((p) => ({ ...p, [key]: value }));
  }

  return (
    <div className="flex h-full flex-col animate-fade-in" style={{ background: "#F3F0F9" }}>

      {saved && (
        <div className="mx-4 mt-3 px-4 py-2.5 rounded-2xl text-xs font-medium flex items-center gap-2 animate-scale-in" style={{ background: "#D4F8E8", color: "#006C4C" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
          Preferences saved!
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-4 max-w-3xl">
        {/* Appearance */}
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest mb-2 px-1" style={{ color: "#79747E" }}>Appearance</div>
          <Card>
            <div className="p-4 space-y-3">
              <div className="text-xs font-medium mb-1" style={{ color: "#49454F" }}>Theme</div>
              <div className="flex gap-2">
                {(["light", "system", "dark"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => set("theme", t)}
                    className="flex-1 py-2 rounded-2xl text-xs font-semibold capitalize md-ripple"
                    style={{
                      background: prefs.theme === t ? "#4F46E5" : "#F3F0F9",
                      color: prefs.theme === t ? "#FFFFFF" : "#49454F",
                      border: prefs.theme === t ? "none" : "1px solid #CAC4D0",
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* Notifications */}
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest mb-2 px-1" style={{ color: "#79747E" }}>Notifications</div>
          <Card>
            <div className="p-4 space-y-0">
              {([
                ["notifAuditAlerts", "Audit Alerts"],
                ["notifHighRisk", "High-Risk Project Alerts"],
                ["notifFieldAudit", "Field Audit Notifications"],
                ["notifSystem", "System Notifications"],
              ] as [keyof Preferences, string][]).map(([key, label], i) => (
                <div key={key}>
                  {i > 0 && <div className="h-px my-3" style={{ background: "#ECE6F0" }} />}
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm" style={{ color: "#1C1B1F" }}>{label}</span>
                    <Toggle value={prefs[key] as boolean} onChange={(v) => set(key, v as Preferences[typeof key])} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Audit Preferences */}
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest mb-2 px-1" style={{ color: "#79747E" }}>Audit Preferences</div>
          <Card>
            <div className="p-4 space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm" style={{ color: "#1C1B1F" }}>Risk Threshold</span>
                  <span className="text-xs font-semibold font-mono" style={{ color: "#4F46E5" }}>{prefs.riskThreshold}</span>
                </div>
                <input
                  type="range"
                  min={20}
                  max={90}
                  step={5}
                  value={prefs.riskThreshold}
                  onChange={(e) => set("riskThreshold", Number(e.target.value))}
                  className="w-full"
                  style={{ accentColor: "#4F46E5" }}
                />
                <div className="flex justify-between text-[10px]" style={{ color: "#79747E" }}>
                  <span>Low (20)</span><span>High (90)</span>
                </div>
              </div>

              <div className="h-px" style={{ background: "#ECE6F0" }} />

              <div>
                <div className="text-sm mb-2" style={{ color: "#1C1B1F" }}>Alert Sensitivity</div>
                <div className="flex gap-2">
                  {(["low", "medium", "high"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => set("auditSensitivity", s)}
                      className="flex-1 py-2 rounded-2xl text-xs font-semibold capitalize md-ripple"
                      style={{
                        background: prefs.auditSensitivity === s ? "#4F46E5" : "#F3F0F9",
                        color: prefs.auditSensitivity === s ? "#FFFFFF" : "#49454F",
                        border: prefs.auditSensitivity === s ? "none" : "1px solid #CAC4D0",
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pb-4">
          <button
            onClick={handleReset}
            className="flex-1 h-12 rounded-3xl text-sm font-semibold md-ripple"
            style={{ background: "#ECE6F0", color: "#1C1B1F" }}
          >
            Reset to Default
          </button>
          <button
            onClick={handleSave}
            className="flex-1 h-12 rounded-3xl text-sm font-semibold text-white md-ripple"
            style={{ background: "#4F46E5" }}
          >
            Save Preferences
          </button>
        </div>
      </div>
    </div>
  );
}

