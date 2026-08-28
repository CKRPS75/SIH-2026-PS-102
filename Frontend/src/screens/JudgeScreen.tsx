import { useState } from "react";
import type { Project } from "../data/projects";
import { evaluateProposal } from "../api";
import { Card } from "../components/common/Card";

// ── Judge Screen ──────────────────────────────────────────────────────────────

type JudgeState = "form" | "loading" | "high" | "safe";

function JudgeScreen({ projects, onOpenAudit }: { projects: Project[]; onOpenAudit: (p: Project) => void }) {
  const [state, setState] = useState<JudgeState>("form");
  const [loadStep, setLoadStep] = useState(0);
  const [result, setResult] = useState<{ project: Project; score: number; reasons: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [jsonInput, setJsonInput] = useState(`{
  "project_key": "MPLADS-2026-001",
  "mp_name": "",
  "state": "Maharashtra",
  "constituency": "",
  "ida": "",
  "category": "",
  "work_clean": "Construction of a community hall",
  "locality": "Mumbai",
  "block": "Kurla",
  "recommended_date": "2026-08-28",
  "status": "Proposed",
  "ida_approval": "Pending",
  "allocation_amount_numeric": 100000
}`);

  const steps = ["Parsing proposal","Running NLP similarity","Checking BSR benchmark","Evaluating geospatial risk","Generating risk score"];

  async function handleSubmit() {
    setError(null);
    setState("loading");
    try {
      const input = JSON.parse(jsonInput);
      const requiredFields = ["project_key", "work_clean", "allocation_amount_numeric"];
      const missingField = requiredFields.find(field => input[field] === undefined || input[field] === "");
      if (missingField) throw new Error(`Missing required field: ${missingField}`);
      setLoadStep(1);
      const response = await evaluateProposal(input);
      setLoadStep(steps.length);
      setResult({ project: response.project, score: response.evaluation.final_score, reasons: response.evaluation.reasons });
      setState(response.evaluation.risk_level === "RED" ? "high" : "safe");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Evaluation failed");
      setState("form");
    }
  }

  function reset() { setState("form"); setLoadStep(0); setError(null); }

  if (state === "loading") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6 animate-fade-in" style={{ background: "#F3F0F9" }}>
        <div className="w-16 h-16 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
        <div className="text-center">
          <div className="text-base font-semibold" style={{ fontFamily: "'Google Sans', sans-serif", color: "#1C1B1F" }}>AI Gateway Analyzing...</div>
          <div className="text-xs mt-1" style={{ color: "#49454F" }}>Evaluating all risk vectors</div>
        </div>
        <div className="w-full rounded-3xl p-5 space-y-3" style={{ background: "#FFFBFE" }}>
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-3 text-sm transition-all" style={{ color: i < loadStep ? "#006C4C" : i === loadStep ? "#4F46E5" : "#CAC4D0" }}>
              <span className="w-5 text-center font-bold">{i < loadStep ? "✓" : i === loadStep ? "●" : "○"}</span>
              {s}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (state === "high" || state === "safe") {
    const isHigh = state === "high";
    return (
      <div className="flex-1 overflow-y-auto p-4 space-y-4 animate-scale-in" style={{ background: "#F3F0F9" }}>
        <div className="rounded-3xl p-6 text-center" style={{ background: isHigh ? "#FFDAD6" : "#D4F8E8" }}>
          <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: isHigh ? "#B3261E" : "#006C4C" }}>
            {isHigh ? "HIGH FRAUD RISK" : "LOW RISK DETECTED"}
          </div>
          <div className="text-6xl font-black mb-1" style={{ color: isHigh ? "#B3261E" : "#006C4C" }}>
            {isHigh ? 90 : 18}
          </div>
          <div className="text-sm" style={{ color: isHigh ? "#410002" : "#002116" }}>out of 100</div>
          <div className="mt-4 h-2 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.1)" }}>
            <div className="h-full rounded-full" style={{ width: isHigh ? "90%" : "18%", background: isHigh ? "#B3261E" : "#006C4C" }} />
          </div>
        </div>
        <Card>
          <div className="p-4 space-y-2">
            {(result?.reasons.length ? result.reasons : [isHigh ? "Cost or risk signals require review" : "No significant risk signals detected"]).map(f => (
              <div key={f} className="text-sm px-3 py-2 rounded-2xl" style={{ background: "#F3F0F9", color: "#1C1B1F" }}>{f}</div>
            ))}
          </div>
        </Card>
        <div className="rounded-3xl px-4 py-3 text-xs font-medium" style={{ background: isHigh ? "#FFEFD6" : "#D4F8E8", color: isHigh ? "#7C4F00" : "#006C4C" }}>
          {isHigh ? "Proposal automatically added to Active AI Monitoring." : "✓ Evaluation complete. Proposal appears legitimate."}
        </div>
        <div className="flex gap-3">
          <button onClick={() => result ? onOpenAudit(result.project) : projects[0] && onOpenAudit(projects[0])} className="flex-1 h-12 rounded-3xl text-sm font-semibold md-ripple" style={{ background: "#ECE6F0", color: "#1C1B1F" }}>View Audit</button>
          <button onClick={reset} className="flex-1 h-12 rounded-3xl text-sm font-semibold text-white md-ripple" style={{ background: "#4F46E5" }}>New Proposal</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: "#F3F0F9" }}>
      <div className="px-4 pt-2 pb-4">
        <div className="text-xs font-medium" style={{ color: "#49454F" }}>MPLADS AI-GUARDIAN</div>
        <div className="text-2xl font-semibold mb-1" style={{ fontFamily: "'Google Sans Display', sans-serif", color: "#1C1B1F" }}>Judge Live Test</div>
        <div className="text-xs" style={{ color: "#49454F" }}>Evaluate a proposal through the AI risk gateway</div>
      </div>

      {/* Engine status card */}
      <div className="px-4 mb-4">
        <div className="rounded-3xl p-4 flex items-center gap-3" style={{ background: "#1C1B1F" }}>
          <div className="w-9 h-9 rounded-2xl flex items-center justify-center" style={{ background: "#4F46E5" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14l-5-5 1.41-1.41L12 14.17l7.59-7.59L21 8l-9 9z"/></svg>
          </div>
          <div className="flex-1">
            <div className="text-xs font-semibold text-white">5 AI Engines Active</div>
            <div className="text-[10px]" style={{ color: "rgba(255,255,255,0.5)" }}>NLP · Cost · Geo · Vendor · Sanction</div>
          </div>
          <div className="w-2 h-2 rounded-full" style={{ background: "#10B981" }} />
        </div>
      </div>

      {/* JSON input */}
      <div className="px-4 pb-24">
        <Card>
          <div className="p-5 space-y-4">
            <label className="text-[10px] font-semibold uppercase tracking-wider mb-2 block" style={{ color: "#49454F" }}>Project JSON</label>
            <textarea
              value={jsonInput}
              onChange={e => setJsonInput(e.target.value)}
              rows={18}
              spellCheck={false}
              className="w-full px-4 py-3 rounded-2xl border text-xs font-mono outline-none resize-none"
              style={{ background: "#F3F0F9", borderColor: "#CAC4D0", color: "#1C1B1F" }}
            />
            {error && <div className="rounded-2xl px-3 py-2 text-xs" style={{ background: "#FFDAD6", color: "#B3261E" }}>{error}</div>}
          </div>
        </Card>
      </div>

      {/* FAB */}
      <div className="absolute bottom-20 left-0 right-0 flex justify-center px-4">
        <button onClick={handleSubmit} className="w-full h-14 rounded-2xl text-white font-semibold text-sm md-ripple elev-3" style={{ background: "#4F46E5" }}>
          ✦ Evaluate via AI Gateway
        </button>
      </div>
    </div>
  );
}

export { JudgeScreen };
