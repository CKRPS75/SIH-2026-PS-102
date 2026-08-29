import { useEffect, useState } from "react";
import type { Project } from "../data/projects";
import {
  getDuplicateLocationDetail,
  getDuplicateLocations,
  type DuplicateLocationRow,
} from "../api";
import { riskColor, sanitizeAuditText } from "../utils/helpers";
import { Chip } from "../components/common/Chip";
import { Card } from "../components/common/Card";
import { RiskChip } from "../components/common/RiskChip";

// ── Audits Screen ─────────────────────────────────────────────────────────────

function amountLabel(amount: number): string {
  if (amount >= 10000000) return `Rs ${(amount / 10000000).toFixed(1)}Cr`;
  return `Rs ${(amount / 100000).toFixed(1)}L`;
}

function DuplicateLocationAnalyticsCard() {
  const [locations, setLocations] = useState<DuplicateLocationRow[]>([]);
  const [selected, setSelected] = useState<DuplicateLocationRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const maxRate = Math.max(...locations.map(row => row.duplicate_rate), 1);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getDuplicateLocations(8)
      .then(result => {
        if (!active) return;
        setLocations(result.rows);
        setSelected(result.rows[0] ?? null);
        setError(null);
      })
      .catch(requestError => {
        if (!active) return;
        setError(requestError instanceof Error ? requestError.message : "Could not load duplicate analytics");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  async function handleSelect(location: DuplicateLocationRow) {
    setSelected(location);
    setDetailLoading(true);
    try {
      const detail = await getDuplicateLocationDetail(location.location_key);
      setSelected(detail);
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not load matched pairs");
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <div className="px-4 mb-4">
      <Card>
        <div className="p-4 space-y-4">
          <div>
            <div className="text-sm font-semibold" style={{ fontFamily: "'Google Sans', sans-serif", color: "#1C1B1F" }}>Duplicate Location Analytics</div>
            <div className="text-xs mt-1" style={{ color: "#49454F" }}>Locations ranked by duplicate rate. Groups under 5 projects are kept out of this chart.</div>
          </div>

          {loading && <div className="text-xs" style={{ color: "#49454F" }}>Loading location groups...</div>}
          {error && <div className="rounded-2xl px-3 py-2 text-xs" style={{ background: "#FFDAD6", color: "#B3261E" }}>{error}</div>}

          {!loading && !error && locations.length === 0 && (
            <div className="rounded-2xl px-3 py-3 text-xs" style={{ background: "#F3F0F9", color: "#49454F" }}>
              No high-confidence duplicate location group was found.
            </div>
          )}

          {locations.length > 0 && (
            <div className="space-y-2">
              {locations.map(location => {
                const active = selected?.location_key === location.location_key;
                return (
                  <button
                    key={location.location_key}
                    onClick={() => handleSelect(location)}
                    className="w-full text-left rounded-2xl p-3 md-ripple"
                    style={{ background: active ? "#E8E7FF" : "#F3F0F9" }}
                  >
                    <div className="grid grid-cols-[92px_1fr_48px] items-center gap-2">
                      <div className="min-w-0">
                        <div className="text-[10px] font-semibold truncate" style={{ color: "#1C1B1F" }}>{location.locality}</div>
                        <div className="text-[9px] truncate" style={{ color: "#79747E" }}>Ward {location.ward} · {location.constituency}</div>
                      </div>
                      <div className="h-7 rounded-xl overflow-hidden" style={{ background: "#ECE6F0" }}>
                        <div
                          className="h-full rounded-xl"
                          style={{
                            width: `${Math.max(5, (location.duplicate_rate / maxRate) * 100)}%`,
                            background: location.duplicate_rate >= 70 ? "#B3261E" : "#F59E0B",
                          }}
                        />
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-black" style={{ color: location.duplicate_rate >= 70 ? "#B3261E" : "#7C4F00" }}>{location.duplicate_rate.toFixed(0)}%</div>
                        <div className="text-[9px]" style={{ color: "#79747E" }}>{location.duplicate_pair_count} pairs</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {selected && (
            <div className="rounded-2xl p-3 space-y-3" style={{ background: "#FFFBFE", border: "1px solid #ECE6F0" }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold" style={{ color: "#1C1B1F" }}>{selected.locality} · Ward {selected.ward}</div>
                  <div className="text-[10px]" style={{ color: "#49454F" }}>
                    {selected.duplicate_candidate_project_count} of {selected.total_project_count} projects flagged · Max similarity {(selected.maximum_similarity * 100).toFixed(0)}%
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-semibold" style={{ color: "#49454F" }}>Flagged value</div>
                  <div className="text-xs font-black" style={{ color: "#B3261E" }}>{amountLabel(selected.flagged_allocation_amount)}</div>
                </div>
              </div>

              {detailLoading && <div className="text-xs" style={{ color: "#49454F" }}>Loading matched pairs...</div>}

              <div className="space-y-2">
                {selected.pairs.slice(0, 5).map(pair => (
                  <div key={pair.pair_label} className="rounded-2xl p-3" style={{ background: "#F3F0F9" }}>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="text-[10px] font-semibold" style={{ color: "#49454F" }}>{pair.pair_label}</div>
                      <div className="text-xs font-black" style={{ color: "#B3261E" }}>{(pair.similarity * 100).toFixed(0)}% similar</div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="text-[10px]" style={{ color: "#1C1B1F" }}>
                        <div className="font-semibold truncate">{sanitizeAuditText(pair.first_work)}</div>
                        <div style={{ color: "#79747E" }}>{amountLabel(pair.first_amount)}</div>
                      </div>
                      <div className="text-[10px]" style={{ color: "#1C1B1F" }}>
                        <div className="font-semibold truncate">{sanitizeAuditText(pair.second_work)}</div>
                        <div style={{ color: "#79747E" }}>{amountLabel(pair.second_amount)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function AuditsScreen({ projects, onOpenAudit }: { projects: Project[]; onOpenAudit: (p: Project) => void }) {
  const [search, setSearch] = useState("");
  const [statusF, setStatusF] = useState("All");

  const filtered = projects.filter(p => {
    const ms = p.title.toLowerCase().includes(search.toLowerCase()) || p.id.toLowerCase().includes(search.toLowerCase());
    const mf = statusF === "All" || p.status === statusF;
    return ms && mf;
  });

  const summary = [
    { label: "Critical", value: projects.filter(p=>p.status==="HIGH RISK").length, bg: "#FFDAD6", text: "#B3261E" },
    { label: "Review", value: projects.filter(p=>p.status==="REVIEW").length, bg: "#FFEFD6", text: "#7C4F00" },
    { label: "Verified", value: projects.filter(p=>p.status==="VERIFIED").length, bg: "#D4F8E8", text: "#006C4C" },
    { label: "Total", value: projects.length, bg: "#E8E7FF", text: "#1A006E" },
  ];

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

      <DuplicateLocationAnalyticsCard />

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

export { AuditsScreen };
