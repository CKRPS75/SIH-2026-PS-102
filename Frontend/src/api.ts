import { PROJECTS, type Project } from "./data/projects";

const API_BASE_URL = "http://127.0.0.1:8000";

export type RiskEvaluation = {
  project_key: string;
  flag: "GREEN" | "YELLOW" | "RED";
  flag_color: string;
  rating: number;
  risk_score: number;
  comment: string;
  reason_description: string;
  reasons: string[];
  component_scores: Record<string, number>;
  median_context: Record<string, number>;
  ratio_context: Record<string, number>;
  references: Record<string, EvaluationReference[]>;
};

type EvaluationReference = {
  project_key: string;
  work_clean: string;
  amount: number;
  state: string | null;
  constituency: string | null;
  locality: string | null;
  ward: string | null;
  recommended_date: string | null;
  source_dataset: string;
  match_type: string;
};

function formatAmount(amount: number): string {
  return `₹${(amount / 100000).toFixed(1)}L`;
}

export async function getProjects(): Promise<Project[]> {
  return PROJECTS;
}

export async function evaluateProposal(input: {
  project_key: string;
  mp_name: string;
  state: string;
  constituency: string;
  ida: string;
  category: string;
  work_clean: string;
  locality: string;
  ward?: string;
  block: string;
  recommended_date: string;
  sanction_date?: string;
  status: string;
  ida_approval: string;
  allocation_amount_numeric: number;
}): Promise<{ project: Project; evaluation: RiskEvaluation }> {
  const evaluateResponse = await fetch(`${API_BASE_URL}/api/v1/evaluate-json`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!evaluateResponse.ok) throw new Error(`Could not evaluate proposal (${evaluateResponse.status})`);
  const evaluation = await evaluateResponse.json() as RiskEvaluation;
  const risk = Math.round(evaluation.risk_score);
  const scores = evaluation.component_scores;
  const anomalyScores = [
    { type: "Split Sanction" as const, score: scores.split_sanction ?? 0, threshold: 60 },
    { type: "Overpricing" as const, score: scores.financial ?? 0, threshold: 45 },
    { type: "Duplicate" as const, score: scores.duplicate ?? 0, threshold: 65 },
  ];
  const strongestAnomaly = anomalyScores
    .filter((item) => item.score >= item.threshold)
    .sort((a, b) => b.score - a.score)[0];
  const anomaly = strongestAnomaly?.type ?? "None";

  return {
    project: {
      id: evaluation.project_key,
      short: evaluation.project_key.slice(-8),
      title: input.work_clean,
      location: [input.locality, input.ward ? `Ward ${input.ward}` : "", input.block, input.state].filter(Boolean).join(", "),
      district: input.locality || "Unknown",
      constituency: input.constituency || "Unknown",
      amount: formatAmount(input.allocation_amount_numeric),
      amountNum: input.allocation_amount_numeric / 100000,
      bsr: "N/A",
      bsrNum: 0,
      risk,
      status: evaluation.flag === "RED" ? "HIGH RISK" : evaluation.flag === "YELLOW" ? "REVIEW" : "VERIFIED",
      anomaly,
      contractor: "Not provided",
      agency: input.ida || "Unknown",
      coords: "Not provided",
      submitted: "Just now",
      description: evaluation.reason_description,
      duplicateScore: evaluation.component_scores.duplicate ?? 0,
      financialScore: evaluation.component_scores.financial ?? 0,
      splitSanctionScore: evaluation.component_scores.split_sanction ?? 0,
      pendingScore: evaluation.component_scores.pending ?? 0,
      reasons: evaluation.reasons,
    },
    evaluation,
  };
}
