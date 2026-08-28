import { useState } from "react";
import type { Project, Filter } from "../data/projects";
import { riskColor } from "../utils/helpers";
import { Chip } from "../components/common/Chip";
import { Card } from "../components/common/Card";
import { RiskChip } from "../components/common/RiskChip";

// ── Home Screen ───────────────────────────────────────────────────────────────

function HomeScreen({ projects, onOpenAudit }: { projects: Project[]; onOpenAudit: (p: Project) => void }) {
  const [filter, setFilter] = useState<Filter>("All");
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("2 min ago");

  const filters: Filter[] = ["All", "Duplicates", "Overpricing", "Split Sanctions"];
  const filtered = projects.filter(p => {
    if (filter === "All") return true;
    if (filter === "Duplicates") return p.anomaly === "Duplicate";
    if (filter === "Overpricing") return p.anomaly === "Overpricing";
    if (filter === "Split Sanctions") return p.anomaly === "Split Sanction";
    return true;
  });
  const alerts = filtered.filter(p => p.status !== "VERIFIED");

  function handleRefresh() {
    setRefreshing(true);
    setTimeout(() => { setRefreshing(false); setLastUpdated("Just now"); }, 1600);
  }

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: "#F3F0F9" }}>
      {/* Top App Bar */}
      <div className="px-4 pt-2 pb-3" style={{ background: "#F3F0F9" }}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-medium" style={{ color: "#49454F" }}>MPLADS AI-GUARDIAN</div>
            <div className="text-2xl font-semibold" style={{ fontFamily: "'Google Sans Display', sans-serif", color: "#1C1B1F" }}>Dashboard</div>
          </div>
          <button onClick={handleRefresh} className="w-10 h-10 rounded-full flex items-center justify-center md-ripple" style={{ background: "#ECE6F0" }}>
            <svg className={`w-5 h-5 ${refreshing ? "animate-spin" : ""}`} viewBox="0 0 24 24" fill="#49454F">
              <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
            </svg>
          </button>
        </div>
        {/* AI Status banner */}
        <div className="mt-3 rounded-2xl px-4 py-3 flex items-center gap-3" style={{ background: "#1C1B1F" }}>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 animate-pulse-glow" style={{ background: "#10B981" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/></svg>
          </div>
          <div className="flex-1">
            <div className="text-xs font-bold" style={{ color: "#FFFFFF" }}>AI Gateway Active</div>
            <div className="text-[10px]" style={{ color: "rgba(255,255,255,0.6)" }}>{refreshing ? "Refreshing AI intelligence..." : `Last sync ${lastUpdated}`}</div>
          </div>
          <div className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "#10B981", color: "#FFFFFF" }}>ONLINE</div>
        </div>
      </div>

      {/* KPI Cards — horizontal scroll */}
      <div className="flex gap-3 px-4 overflow-x-auto pb-1">
        {[
          { label: "Funds Processed", value: "₹50.4 Cr", icon: "💰", bg: "#E8E7FF", text: "#1A006E" },
          { label: "Active Proposals", value: "45", icon: "📋", bg: "#D4F8E8", text: "#002116" },
          { label: "Anomaly Alerts", value: "8 Red · 4 Amb", icon: "⚠️", bg: "#FFDAD6", text: "#410002" },
          { label: "Tax Savings Est.", value: "₹3.2 Cr", icon: "🛡️", bg: "#FFF8E1", text: "#341100" },
        ].map(k => (
          <div key={k.label} className="shrink-0 w-36 rounded-3xl p-4 elev-1" style={{ background: k.bg }}>
            <div className="text-xl mb-2">{k.icon}</div>
            <div className="text-[10px] font-medium mb-0.5" style={{ color: k.text, opacity: 0.7 }}>{k.label}</div>
            <div className="text-sm font-black" style={{ color: k.text }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 px-4 mt-4 overflow-x-auto pb-1">
        {filters.map(f => <Chip key={f} label={f} active={filter === f} onClick={() => setFilter(f)} />)}
      </div>

      {/* Risk Map card */}
      <div className="px-4 mt-4">
        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold" style={{ fontFamily: "'Google Sans', sans-serif", color: "#1C1B1F" }}>Risk Intelligence Map</div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full" style={{ background: "#ECE6F0", color: "#49454F" }}>Mumbai</span>
            </div>
            <div className="relative rounded-2xl overflow-hidden" style={{ height: 180, background: "#0F172A" }}>
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 300 180">
                <defs>
                  <pattern id="g2" width="20" height="20" patternUnits="userSpaceOnUse">
                    <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1E293B" strokeWidth="0.5"/>
                  </pattern>
                </defs>
                <rect width="300" height="180" fill="url(#g2)"/>
                <path d="M50,20 L120,25 L140,70 L120,120 L70,130 L30,110 L25,60 Z" fill="none" stroke="#334155" strokeWidth="1.5"/>
                <path d="M120,25 L170,40 L175,85 L140,100 L120,120 Z" fill="none" stroke="#334155" strokeWidth="1"/>
                <ellipse cx="195" cy="120" rx="30" ry="45" fill="#0F172A" stroke="#1E3A5F" strokeWidth="1"/>
                <text x="184" y="125" fill="#1E3A5F" fontSize="7" fontFamily="Roboto">Arabian Sea</text>
                <text x="60" y="75" fill="#475569" fontSize="8" fontFamily="Roboto">Kurla</text>
                <text x="85" y="45" fill="#475569" fontSize="8" fontFamily="Roboto">Andheri</text>
                <text x="120" y="65" fill="#475569" fontSize="8" fontFamily="Roboto">Chembur</text>
                <text x="38" y="100" fill="#475569" fontSize="8" fontFamily="Roboto">Dharavi</text>
              </svg>
              {/* Map pins */}
              {[
                { p: filtered.find(p=>p.id==="MPLADS-2026-TRAP-001"), x:"40%", y:"40%" },
                { p: filtered.find(p=>p.id==="MPLADS-2026-TRAP-002"), x:"43%", y:"44%" },
                { p: filtered.find(p=>p.id==="MPLADS-2026-TRAP-003"), x:"58%", y:"55%" },
                { p: filtered.find(p=>p.id==="MPLADS-2026-TRAP-004"), x:"63%", y:"32%" },
                { p: filtered.find(p=>p.id==="MPLADS-2026-BASE-001"), x:"28%", y:"65%" },
                { p: filtered.find(p=>p.id==="MPLADS-2026-BASE-002"), x:"52%", y:"20%" },
              ].map(({ p, x, y }) => p ? (
                <button key={p.id} onClick={() => onOpenAudit(p)} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: x, top: y }}>
                  <div className="w-4 h-4 rounded-full border-2 border-white shadow-lg transition-transform active:scale-125" style={{ background: riskColor(p.risk).dot }} />
                </button>
              ) : null)}
              {/* Legend */}
              <div className="absolute bottom-2 left-2 flex gap-2 rounded-xl px-2.5 py-1.5" style={{ background: "rgba(15,23,42,0.85)" }}>
                {[["#10B981","Safe"],["#F59E0B","Review"],["#B3261E","High"]].map(([c,l]) => (
                  <div key={l} className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full" style={{ background: c }}/>
                    <span className="text-[9px]" style={{ color: "rgba(255,255,255,0.7)" }}>{l}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Alert Feed */}
      <div className="px-4 mt-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold" style={{ fontFamily: "'Google Sans', sans-serif", color: "#1C1B1F" }}>Live Alert Feed</div>
          <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "#FFDAD6", color: "#B3261E" }}>{alerts.length} active</span>
        </div>
        <div className="space-y-2">
          {alerts.length === 0 ? (
            <Card><div className="p-8 text-center text-sm" style={{ color: "#49454F" }}>✓ No alerts for selected filter</div></Card>
          ) : alerts.map(p => (
            <Card key={p.id}>
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 text-sm font-black" style={{ background: riskColor(p.risk).bg, color: riskColor(p.risk).dot }}>
                    {p.risk}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold truncate" style={{ color: "#1C1B1F" }}>{p.title}</span>
                      <RiskChip status={p.status} />
                    </div>
                    <div className="text-[10px] font-mono mt-0.5" style={{ color: "#79747E" }}>{p.id}</div>
                    <div className="text-xs mt-0.5" style={{ color: "#49454F" }}>{p.anomaly} Detection · {p.amount}</div>
                  </div>
                </div>
                <button
                  onClick={() => onOpenAudit(p)}
                  className="mt-3 w-full h-9 rounded-2xl text-xs font-semibold md-ripple transition-colors"
                  style={{ background: "#E8E7FF", color: "#1A006E" }}
                >
                  Inspect AI Audit
                </button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

export { HomeScreen };
