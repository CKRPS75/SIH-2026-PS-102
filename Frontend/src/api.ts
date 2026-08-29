import { PROJECTS, type Project } from "./data/projects";
import { sanitizeAuditText } from "./utils/helpers";

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

export type EvaluationReference = {
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
  similarity?: number | null;
};

export type DuplicateProjectPair = {
  pair_label: string;
  first_work: string;
  second_work: string;
  first_amount: number;
  second_amount: number;
  first_date: string | null;
  second_date: string | null;
  similarity: number;
};

export type DuplicateLocationRow = {
  location_key: string;
  state: string;
  constituency: string;
  locality: string;
  ward: string;
  total_project_count: number;
  duplicate_candidate_project_count: number;
  duplicate_pair_count: number;
  duplicate_rate: number;
  average_similarity: number;
  maximum_similarity: number;
  flagged_allocation_amount: number;
  confidence: "HIGH" | "LOW";
  embedding_backend: string;
  pairs: DuplicateProjectPair[];
};

export type DuplicateLocationAnalyticsResponse = {
  total_locations: number;
  similarity_threshold: number;
  min_projects_for_confidence: number;
  rows: DuplicateLocationRow[];
};

function formatAmount(amount: number): string {
  return `₹${(amount / 100000).toFixed(1)}L`;
}

export async function getProjects(): Promise<Project[]> {
  return PROJECTS;
}

export async function getDuplicateLocations(limit = 10): Promise<DuplicateLocationAnalyticsResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/analytics/duplicates/locations?limit=${limit}`);
  if (!response.ok) throw new Error(`Could not load duplicate-location analytics (${response.status})`);
  return await response.json() as DuplicateLocationAnalyticsResponse;
}

export async function getDuplicateLocationDetail(locationKey: string): Promise<DuplicateLocationRow> {
  const response = await fetch(`${API_BASE_URL}/api/v1/analytics/duplicates/locations/${encodeURIComponent(locationKey)}`);
  if (!response.ok) throw new Error(`Could not load duplicate-location detail (${response.status})`);
  return await response.json() as DuplicateLocationRow;
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
  const safeEvaluation: RiskEvaluation = {
    ...evaluation,
    comment: sanitizeAuditText(evaluation.comment),
    reason_description: sanitizeAuditText(evaluation.reason_description),
    reasons: evaluation.reasons.map(reason => sanitizeAuditText(reason)),
  };
  const risk = Math.round(safeEvaluation.risk_score);
  const scores = safeEvaluation.component_scores;
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
      id: safeEvaluation.project_key,
      short: "Live case",
      title: input.work_clean,
      location: [input.locality, input.ward ? `Ward ${input.ward}` : "", input.block, input.state].filter(Boolean).join(", "),
      district: input.locality || "Unknown",
      constituency: input.constituency || "Unknown",
      amount: formatAmount(input.allocation_amount_numeric),
      amountNum: input.allocation_amount_numeric / 100000,
      bsr: "N/A",
      bsrNum: 0,
      risk,
      status: safeEvaluation.flag === "RED" ? "HIGH RISK" : safeEvaluation.flag === "YELLOW" ? "REVIEW" : "VERIFIED",
      anomaly,
      contractor: "Not provided",
      agency: input.ida || "Unknown",
      coords: "Not provided",
      submitted: "Just now",
      description: safeEvaluation.reason_description,
      duplicateScore: safeEvaluation.component_scores.duplicate ?? 0,
      financialScore: safeEvaluation.component_scores.financial ?? 0,
      splitSanctionScore: safeEvaluation.component_scores.split_sanction ?? 0,
      pendingScore: safeEvaluation.component_scores.pending ?? 0,
      reasons: safeEvaluation.reasons,
    },
    evaluation: safeEvaluation,
  };
}
