import { memo, useMemo, useState } from "react";
import type { Project } from "../data/projects";
import { riskColor } from "../utils/helpers";
import { Chip } from "../components/common/Chip";
import { Card } from "../components/common/Card";
import { RiskChip } from "../components/common/RiskChip";

// ── Audits Screen ─────────────────────────────────────────────────────────────

function AuditsScreen({ projects, onOpenAudit }: { projects: Project[]; onOpenAudit: (p: Project) => void }) {
  const [search, setSearch] = useState("");
  const [statusF, setStatusF] = useState("All");

  const filtered = useMemo(() => projects.filter(p => {
    const ms = p.title.toLowerCase().includes(search.toLowerCase()) || p.id.toLowerCase().includes(search.toLowerCase());
    const mf = statusF === "All" || p.status === statusF;
    return ms && mf;
  }), [projects, search, statusF]);

  const summary = useMemo(() => [
    { label: "Critical", value: projects.filter(p=>p.status==="HIGH RISK").length, bg: "#FFDAD6", text: "#B3261E" },
    { label: "Review", value: projects.filter(p=>p.status==="REVIEW").length, bg: "#FFEFD6", text: "#7C4F00" },
    { label: "Verified", value: projects.filter(p=>p.status==="VERIFIED").length, bg: "#D4F8E8", text: "#006C4C" },
    { label: "Total", value: projects.length, bg: "#E8E7FF", text: "#1A006E" },
  ], [projects]);

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: "#F3F0F9" }}>
      {/* Top App Bar */}
      <div className="px-4 pt-2 pb-4" style={{ background: "#F3F0F9" }}>
        <div className="text-xs font-medium" style={{ color: "#49454F" }}>MPLADS AI-GUARDIAN</div>
        <div className="text-2xl font-semibold mb-4" style={{ fontFamily: "'Google Sans Display', sans-serif", color: "#1C1B1F" }}>AI Audit Center</div>

        {/* Summary chips */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {summary.map(s => (
            <div key={s.label} className="shrink-0 flex flex-col items-center rounded-2xl px-4 py-3 elev-1" style={{ background: s.bg }}>
              <span className="text-2xl font-black" style={{ color: s.text }}>{s.value}</span>
              <span className="text-[10px] font-medium" style={{ color: s.text, opacity: 0.8 }}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="px-4 mb-3">
        <div className="flex items-center gap-3 rounded-full px-4 h-12" style={{ background: "#ECE6F0" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#49454F"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search project ID or title..."
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: "#1C1B1F" }}
          />
        </div>
      </div>

      {/* Status filter chips */}
      <div className="flex gap-2 px-4 overflow-x-auto pb-1 mb-3">
        {["All","HIGH RISK","REVIEW","VERIFIED"].map(s => (
          <Chip key={s} label={s} active={statusF === s} onClick={() => setStatusF(s)} />
        ))}
      </div>

      {/* Project cards */}
      <div className="px-4 pb-4 space-y-2">
        {filtered.length === 0 ? (
          <Card><div className="p-8 text-center text-sm" style={{ color: "#49454F" }}>No results found.</div></Card>
        ) : filtered.map(p => (
          <Card key={p.id} onClick={() => onOpenAudit(p)}>
            <div className="p-4">
              <div className="flex items-start gap-3">
                {/* Risk circle */}
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 text-sm font-black" style={{ background: riskColor(p.risk).bg, color: riskColor(p.risk).dot }}>
                  {p.risk}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-semibold" style={{ color: "#1C1B1F" }}>{p.title}</div>
                    <RiskChip status={p.status} />
                  </div>
                  <div className="text-[10px] font-mono mt-0.5" style={{ color: "#79747E" }}>{p.id}</div>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-xs font-semibold" style={{ color: "#49454F" }}>{p.amount}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "#ECE6F0", color: "#49454F" }}>{p.anomaly}</span>
                    <span className="text-[10px]" style={{ color: "#79747E" }}>{p.location}</span>
                  </div>
                </div>
              </div>
              {/* Progress bar */}
              <div className="mt-3 h-1.5 rounded-full overflow-hidden" style={{ background: "#ECE6F0" }}>
                <div className="h-full rounded-full" style={{ width: `${p.risk}%`, background: riskColor(p.risk).dot }} />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

const MemoizedAuditsScreen = memo(AuditsScreen);

export { MemoizedAuditsScreen as AuditsScreen };
