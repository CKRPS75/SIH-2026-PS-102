import { useState } from "react";
import type { Project } from "../../data/projects";
import { riskColor } from "../../utils/helpers";

// ── Risk Audit Bottom Sheet ───────────────────────────────────────────────────

type AuditTab = "overview" | "duplicate" | "cost" | "vendor";
type ModalAction = null | "approved" | "field" | "freeze-confirm" | "frozen";

function RiskAuditSheet({ project, onClose }: { project: Project; onClose: () => void }) {
  const [tab, setTab] = useState<AuditTab>("overview");
  const [action, setAction] = useState<ModalAction>(null);
  const rc = riskColor(project.risk);
  const duplicateScore = project.duplicateScore ?? (project.anomaly === "Duplicate" ? project.risk : 0);
  const financialScore = project.financialScore ?? (project.anomaly === "Overpricing" ? project.risk : 0);
  const splitScore = project.splitSanctionScore ?? (project.anomaly === "Split Sanction" ? project.risk : 0);
  const pendingScore = project.pendingScore ?? (project.anomaly === "Pending Approval" ? 45 : 0);
  const explanation = project.description || "No detailed explanation is available for this project.";

  const tabs: { key: AuditTab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "duplicate", label: "Duplicate" },
    { key: "cost", label: "Cost" },
    { key: "vendor", label: "Vendors" },
  ];

  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-end animate-fade-in" style={{ background: "rgba(0,0,0,0.5)" }} onClick={onClose}>
      <div className="rounded-t-[28px] flex flex-col max-h-[92%] animate-slide-up" style={{ background: "#FFFBFE" }} onClick={(e) => e.stopPropagation()}>
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2 shrink-0">
          <div className="w-8 h-1 rounded-full" style={{ background: "#CAC4D0" }} />
        </div>

        {/* Header */}
        <div className="px-5 pb-3 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[10px] font-mono" style={{ color: "#49454F" }}>{project.id}</div>
              <div className="text-lg font-semibold mt-0.5" style={{ fontFamily: "'Google Sans', sans-serif", color: "#1C1B1F" }}>{project.title}</div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center md-ripple" style={{ background: "#ECE6F0" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#49454F"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
            </button>
          </div>

          {/* Risk score */}
          <div className="mt-3 rounded-2xl p-4 flex items-center gap-4" style={{ background: rc.bg }}>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0" style={{ background: rc.dot }}>
              <span className="text-white text-xl font-black">{project.risk}</span>
            </div>
            <div className="flex-1">
              <div className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: rc.text }}>
                {project.status} · {project.risk}/100
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.1)" }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${project.risk}%`, background: rc.dot }} />
              </div>
              <div className="flex justify-between text-[9px] mt-1 font-medium" style={{ color: rc.text, opacity: 0.7 }}>
                <span>LOW</span><span>MED</span><span>HIGH</span><span>CRIT</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs — MD3 scrollable */}
        <div className="flex border-b shrink-0 overflow-x-auto" style={{ borderColor: "#CAC4D0" }}>
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="flex-1 py-3 text-xs font-semibold transition-colors relative shrink-0 md-ripple"
              style={{ color: tab === t.key ? "#4F46E5" : "#49454F" }}
            >
              {t.label}
              {tab === t.key && <div className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full" style={{ background: "#4F46E5" }} />}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="overflow-y-auto flex-1 p-5 space-y-3">
          {tab === "overview" && (
            <>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { l: "Duplicate", v: duplicateScore >= 65 ? `${Math.round(duplicateScore)}%` : "Clear", danger: duplicateScore >= 65 },
                  { l: "Financial", v: financialScore >= 45 ? `${Math.round(financialScore)}%` : "Normal", danger: financialScore >= 45 },
                  { l: "Split Sanction", v: splitScore >= 60 ? `${Math.round(splitScore)}%` : "Clear", danger: splitScore >= 60 },
                  { l: "Admin Status", v: pendingScore > 0 ? "Pending" : "Clear", danger: pendingScore > 0 && project.status !== "VERIFIED" },
                ].map((f) => (
                  <div key={f.l} className="rounded-2xl p-3" style={{ background: f.danger ? "#FFDAD6" : "#D4F8E8" }}>
                    <div className="text-[10px] font-medium mb-0.5" style={{ color: f.danger ? "#410002" : "#002116", opacity: 0.7 }}>{f.l}</div>
                    <div className="text-base font-black" style={{ color: f.danger ? "#B3261E" : "#006C4C" }}>{f.v}</div>
                  </div>
                ))}
              </div>
              <div className="rounded-2xl p-4" style={{ background: "#FFF8E1" }}>
                <div className="text-xs font-semibold mb-1.5" style={{ color: "#7C4F00" }}>Why was this flagged?</div>
                <div className="text-xs leading-relaxed" style={{ color: "#49454F" }}>
                  {explanation}
                </div>
              </div>
            </>
          )}

          {tab === "duplicate" && (
            <>
              <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#49454F" }}>NLP Duplicate Detection</div>
              <div className="space-y-2">
                <div className="rounded-2xl p-4" style={{ background: "#ECE6F0" }}>
                  <div className="text-[9px] font-mono font-semibold mb-1 uppercase tracking-wider" style={{ color: "#49454F" }}>Current Proposal</div>
                  <div className="text-sm font-medium mb-1" style={{ color: "#1C1B1F" }}>{project.title}</div>
                  <div className="text-xs" style={{ color: "#49454F" }}>{project.description}</div>
                  <div className="text-[10px] font-mono mt-2" style={{ color: "#79747E" }}>{project.coords}</div>
                </div>
                <div className="rounded-2xl p-4" style={{ background: duplicateScore >= 65 ? "#FFDAD6" : "#D4F8E8" }}>
                  <div className="text-[9px] font-mono font-semibold mb-1 uppercase tracking-wider" style={{ color: duplicateScore >= 65 ? "#B3261E" : "#006C4C" }}>
                    {duplicateScore >= 65 ? "Possible Duplicate" : "No Major Duplicate"}
                  </div>
                  <div className="text-sm font-black mb-1" style={{ color: duplicateScore >= 65 ? "#B3261E" : "#006C4C" }}>{Math.round(duplicateScore)}%</div>
                  <div className="text-xs" style={{ color: duplicateScore >= 65 ? "#410002" : "#002116" }}>
                    {duplicateScore >= 65
                      ? "The project crossed the duplicate threshold using same-work or same-category matching in the same locality and ward."
                      : "This project did not cross the duplicate threshold. Low grouping counts are not treated as duplicate fraud."}
                  </div>
                </div>
              </div>
            </>
          )}

          {tab === "cost" && (
            <>
              <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#49454F" }}>Cost Inflation Engine</div>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="rounded-2xl p-4" style={{ background: "#FFDAD6" }}>
                  <div className="text-[10px] font-medium mb-0.5" style={{ color: "#B3261E" }}>Requested</div>
                  <div className="text-xl font-black" style={{ color: "#B3261E" }}>{project.amount}</div>
                </div>
                <div className="rounded-2xl p-4" style={{ background: "#D4F8E8" }}>
                  <div className="text-[10px] font-medium mb-0.5" style={{ color: "#006C4C" }}>BSR Benchmark</div>
                  <div className="text-xl font-black" style={{ color: "#006C4C" }}>{project.bsr}</div>
                </div>
              </div>
              <div className="space-y-3 rounded-2xl p-4" style={{ background: "#F3F0F9" }}>
                <div>
                  <div className="flex justify-between text-[10px] mb-1" style={{ color: "#49454F" }}><span>Requested</span><span>{project.amount}</span></div>
                  <div className="h-4 rounded-full overflow-hidden" style={{ background: "#ECE6F0" }}>
                    <div className="h-full rounded-full" style={{ background: financialScore >= 45 ? "#B3261E" : "#F59E0B", width: `${Math.max(12, Math.min(financialScore, 100))}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[10px] mb-1" style={{ color: "#49454F" }}><span>BSR</span><span>{project.bsr}</span></div>
                  <div className="h-4 rounded-full overflow-hidden" style={{ background: "#ECE6F0" }}>
                    <div className="h-full rounded-full" style={{ background: "#006C4C", width: financialScore >= 45 ? "45%" : "70%" }} />
                  </div>
                </div>
              </div>
              {financialScore >= 45 && (
                <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: "#FFDAD6" }}>
                  <span className="text-3xl font-black" style={{ color: "#B3261E" }}>{Math.round(financialScore)}%</span>
                  <div>
                    <div className="text-xs font-bold" style={{ color: "#B3261E" }}>Financial Anomaly Detected</div>
                    <div className="text-xs" style={{ color: "#410002" }}>The amount crossed the trained median-ratio threshold.</div>
                  </div>
                </div>
              )}
            </>
          )}

          {tab === "vendor" && (
            <>
              <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#49454F" }}>Vendor Cartel Graph</div>
              <div className="rounded-2xl overflow-hidden" style={{ background: "#F3F0F9" }}>
                <svg viewBox="0 0 300 200" className="w-full">
                  {[[130,60,200,100],[130,60,70,110],[130,60,200,160],[200,100,200,160],[70,110,130,160]].map(([x1,y1,x2,y2],i) => (
                    <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#CAC4D0" strokeWidth="1.5" strokeDasharray="4 2"/>
                  ))}
                  {[
                    {x:130,y:60,label:"Contractor",c:"#4F46E5"},
                    {x:200,y:100,label:"Agency",c:"#7C3AED"},
                    {x:70,y:110,label:"Project A",c:"#B3261E"},
                    {x:200,y:160,label:"Project B",c:"#B3261E"},
                    {x:130,y:160,label:"Sub-contractor",c:"#F59E0B"},
                  ].map((n,i) => (
                    <g key={i}>
                      <circle cx={n.x} cy={n.y} r={20} fill={n.c} fillOpacity={0.15} stroke={n.c} strokeWidth={1.5}/>
                      <text x={n.x} y={n.y+4} textAnchor="middle" fontSize="8" fill={n.c} fontWeight="600" fontFamily="Roboto">{n.label}</text>
                    </g>
                  ))}
                </svg>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {["Shared Contractor","Repeated Agency","Split Sanction Pattern"].map(b => (
                  <span key={b} className="text-[10px] font-medium px-2.5 py-1 rounded-full" style={{ background: "#FFEFD6", color: "#7C4F00" }}>{b}</span>
                ))}
              </div>
            </>
          )}

          {/* Action feedback */}
          {action === "approved" && <div className="rounded-2xl p-4 text-center animate-scale-in" style={{ background: "#D4F8E8" }}><div className="font-semibold text-sm" style={{ color: "#006C4C" }}>✓ Approved & Fast-Tracked</div><div className="text-xs mt-1" style={{ color: "#49454F" }}>PFMS disbursement queue updated.</div></div>}
          {action === "field" && <div className="rounded-2xl p-4 text-center animate-scale-in" style={{ background: "#FFEFD6" }}><div className="font-semibold text-sm" style={{ color: "#7C4F00" }}>Field Inspection Requested</div><div className="text-xs mt-1" style={{ color: "#49454F" }}>Assigned to nearest field officer team.</div></div>}
          {action === "freeze-confirm" && (
            <div className="rounded-2xl p-4 animate-scale-in" style={{ background: "#FFDAD6" }}>
              <div className="font-semibold text-sm mb-3" style={{ color: "#B3261E" }}>Freeze payment for this project?</div>
              <div className="flex gap-2">
                <button onClick={() => setAction(null)} className="flex-1 h-10 rounded-xl text-sm font-medium md-ripple" style={{ background: "#ECE6F0", color: "#49454F" }}>Cancel</button>
                <button onClick={() => setAction("frozen")} className="flex-1 h-10 rounded-xl text-sm font-semibold md-ripple" style={{ background: "#B3261E", color: "#FFFFFF" }}>Confirm Freeze</button>
              </div>
            </div>
          )}
          {action === "frozen" && <div className="rounded-2xl p-4 text-center animate-scale-in" style={{ background: "#FFDAD6" }}><div className="font-semibold text-sm" style={{ color: "#B3261E" }}>🔒 Payment Frozen</div><div className="text-xs mt-1" style={{ color: "#410002" }}>PFMS disbursement suspended.</div></div>}
        </div>

        {/* Action buttons */}
        {!action && (
          <div className="p-4 pt-0 flex gap-2 shrink-0">
            <button onClick={() => setAction("approved")} className="flex-1 h-10 rounded-xl text-xs font-semibold md-ripple" style={{ background: "#D4F8E8", color: "#006C4C" }}>Approve</button>
            <button onClick={() => setAction("field")} className="flex-1 h-10 rounded-xl text-xs font-semibold md-ripple" style={{ background: "#FFEFD6", color: "#7C4F00" }}>Field Audit</button>
            <button onClick={() => setAction("freeze-confirm")} className="flex-1 h-10 rounded-xl text-xs font-semibold md-ripple" style={{ background: "#FFDAD6", color: "#B3261E" }}>Suspend</button>
          </div>
        )}
        <div className="h-4 shrink-0" />
      </div>
    </div>
  );
}

export { RiskAuditSheet };
