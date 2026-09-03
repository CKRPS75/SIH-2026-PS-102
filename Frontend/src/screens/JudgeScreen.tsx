import { useState } from "react";
import type { Project } from "../data/projects";
import { evaluateProposal, type RiskEvaluation } from "../api";
import { Card } from "../components/common/Card";
import { sanitizeAuditText } from "../utils/helpers";

// ── Judge Screen ──────────────────────────────────────────────────────────────

type JudgeState = "form" | "loading" | "result";

function referenceDisplayKey(ref: {
  work_clean: string;
}): string {
  return sanitizeAuditText(ref.work_clean).trim().toLowerCase();
}

function JudgeScreen({ projects, onOpenAudit }: { projects: Project[]; onOpenAudit: (p: Project) => void }) {
  const [state, setState] = useState<JudgeState>("form");
  const [loadStep, setLoadStep] = useState(0);
  const [result, setResult] = useState<{ project: Project; evaluation: RiskEvaluation } | null>(null);
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
  "ward": "L",
  "block": "Kurla",
  "recommended_date": "2026-08-28",
  "sanction_date": "",
  "status": "Proposed",
  "ida_approval": "Pending",
  "allocation_amount_numeric": 100000
}`);

  const steps = ["Reading proposal","Checking locality and ward","Comparing past costs","Finding split proposal groups","Generating risk rating"];

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
      setResult(response);
      setState("result");
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

  if (state === "result" && result) {
    const evaluation = result.evaluation;
    const scores = evaluation.component_scores;
    const flagBg = evaluation.flag === "RED" ? "#FFDAD6" : evaluation.flag === "YELLOW" ? "#FFEFD6" : "#D4F8E8";
    const flagText = evaluation.flag === "RED" ? "#B3261E" : evaluation.flag === "YELLOW" ? "#7C4F00" : "#006C4C";
    const visibleScores: Array<[string, number]> = [
      ["Duplicate", scores.duplicate ?? 0],
      ["Financial", scores.financial ?? 0],
      ["Split Sanction", scores.split_sanction ?? 0],
    ];
    const seenReferenceKeys = new Set<string>();
    const references = Object.entries(evaluation.references)
      .flatMap(([group, refs]) =>
        refs
          .filter(ref => ref.source_dataset === "training" || ref.source_dataset === "mplads_test" || ref.source_dataset === "MPLADS")
          .map(ref => ({ ...ref, group }))
      )
      .filter(ref => {
        const key = referenceDisplayKey(ref);
        if (seenReferenceKeys.has(key)) return false;
        seenReferenceKeys.add(key);
        return true;
      });
    const groupLabel: Record<string, string> = {
      financial: "Financial comparison",
      duplicates: "Duplicate comparison",
      split_sanctions: "Split sanction comparison",
    };
    return (
      <div className="flex-1 overflow-y-auto p-4 space-y-4 animate-scale-in" style={{ background: "#F3F0F9" }}>
        <div className="rounded-3xl p-5 space-y-4" style={{ background: flagBg }}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: flagText }}>Flag</div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full border-2 border-white shadow-sm" style={{ background: evaluation.flag_color }} />
                <span className="text-xl font-black" style={{ color: flagText }}>{evaluation.flag}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: flagText }}>Rating</div>
              <div className="text-4xl font-black" style={{ color: flagText }}>{evaluation.rating.toFixed(1)}</div>
              <div className="text-xs" style={{ color: flagText }}>out of 10</div>
            </div>
          </div>
        </div>

        <Card>
          <div className="p-4 space-y-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "#49454F" }}>Comment</div>
              <div className="text-sm leading-relaxed" style={{ color: "#1C1B1F" }}>{sanitizeAuditText(evaluation.comment)}</div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "#49454F" }}>Reason/Description</div>
              <div className="text-xs leading-relaxed whitespace-pre-line" style={{ color: "#49454F" }}>{sanitizeAuditText(evaluation.reason_description)}</div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-4 space-y-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#49454F" }}>Component Scores</div>
            {visibleScores.map(([name, score]) => (
              <div key={name}>
                <div className="flex justify-between text-[10px] mb-1" style={{ color: "#49454F" }}><span>{name}</span><span>{score.toFixed(1)}</span></div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: "#ECE6F0" }}>
                  <div className="h-full rounded-full" style={{ width: `${Math.min(score, 100)}%`, background: score >= 65 ? "#B3261E" : score >= 45 ? "#F59E0B" : "#10B981" }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {references.length > 0 && (
          <Card>
            <div className="p-4 space-y-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#49454F" }}>MPLADS Reference Records</div>
              {references.slice(0, 8).map((ref, index) => (
                <div key={`${ref.group}-${index}`} className="rounded-2xl px-3 py-2" style={{ background: "#F3F0F9" }}>
                  <div className="text-[10px] font-semibold" style={{ color: "#79747E" }}>
                    Compared record {index + 1} · {groupLabel[ref.group] ?? "Reference comparison"}
                  </div>
                  <div className="text-xs font-semibold truncate" style={{ color: "#1C1B1F" }}>{sanitizeAuditText(ref.work_clean)}</div>
                  <div className="text-[10px]" style={{ color: "#49454F" }}>{ref.locality || "Unknown locality"} · Ward {ref.ward || "Unknown"} · Rs {(ref.amount / 100000).toFixed(1)}L</div>
                </div>
              ))}
            </div>
          </Card>
        )}

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
