import type { Project } from "./data/projects";
import { sanitizeAuditText } from "./utils/helpers";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

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

export type PredictionRow = {
  project_key: string;
  mp_name: string | null;
  state: string | null;
  constituency: string | null;
  ida: string | null;
  category: string | null;
  work_clean: string | null;
  locality: string | null;
  ward: string | null;
  block: string | null;
  recommended_date: string | null;
  status: string | null;
  ida_approval: string | null;
  source_dataset: string | null;
  allocation_amount_numeric: number;
  model_risk_score: number;
  model_risk_level: "GREEN" | "YELLOW" | "RED" | string;
  model_duplicate_score: number;
  model_financial_score: number;
  model_financial_rule_score: number;
  model_financial_isolation_score: number;
  model_split_sanction_score: number;
  model_pending_score: number;
  isolation_forest_risk_score: number;
  isolation_forest_anomaly_flag: boolean;
  model_reasons: string[];
};

type PredictionListResponse = {
  total: number;
  limit: number;
  offset: number;
  rows: PredictionRow[];
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

function projectStatusFromRisk(level: string): Project["status"] {
  const normalized = level.toUpperCase();
  if (normalized === "RED") return "HIGH RISK";
  if (normalized === "YELLOW") return "REVIEW";
  return "VERIFIED";
}

function projectAnomalyFromPrediction(row: PredictionRow): Project["anomaly"] {
  const candidates: Array<{ type: Project["anomaly"]; score: number; threshold: number }> = [
    { type: "Split Sanction", score: row.model_split_sanction_score ?? 0, threshold: 60 },
    { type: "Overpricing", score: row.model_financial_score ?? 0, threshold: 45 },
    { type: "Duplicate", score: row.model_duplicate_score ?? 0, threshold: 65 },
    { type: "Pending Approval", score: row.model_pending_score ?? 0, threshold: 1 },
  ];
  const strongest = candidates
    .filter(candidate => candidate.score >= candidate.threshold)
    .sort((a, b) => b.score - a.score)[0];
  return strongest?.type ?? "None";
}

function displayDate(value: string | null): string {
  if (!value) return "Date not provided";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function predictionToProject(row: PredictionRow): Project {
  const reasons = row.model_reasons.map(reason => sanitizeAuditText(reason)).filter(Boolean);
  const title = sanitizeAuditText(row.work_clean || "Untitled MPLADS project");
  const locality = row.locality || "Unknown locality";
  const ward = row.ward ? `Ward ${row.ward}` : "";
  const block = row.block || "";
  const state = row.state || "";
  const location = [locality, ward, block, state].filter(Boolean).join(", ");
  return {
    id: row.project_key,
    short: row.project_key.slice(-8) || "MPLADS",
    title,
    location,
    district: locality,
    constituency: row.constituency || "Unknown",
    amount: formatAmount(row.allocation_amount_numeric),
    amountNum: row.allocation_amount_numeric / 100000,
    bsr: "MPLADS model",
    bsrNum: 0,
    risk: Math.round(row.model_risk_score),
    status: projectStatusFromRisk(row.model_risk_level),
    anomaly: projectAnomalyFromPrediction(row),
    contractor: "Not provided",
    agency: row.ida || "Unknown",
    coords: "Coordinates not provided",
    submitted: displayDate(row.recommended_date),
    description: reasons.length ? reasons.join("; ") : "No major anomaly found against the MPLADS dataset.",
    duplicateScore: row.model_duplicate_score ?? 0,
    financialScore: row.model_financial_score ?? 0,
    splitSanctionScore: row.model_split_sanction_score ?? 0,
    pendingScore: row.model_pending_score ?? 0,
    reasons,
  };
}

export async function getProjects(): Promise<Project[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/predictions?limit=20000`);
  if (!response.ok) throw new Error(`Could not load MPLADS predictions (${response.status})`);
  const data = await response.json() as PredictionListResponse;
  return data.rows.map(predictionToProject);
}

export async function getPredictions({
  mp,
  limit = 500,
  dataset = "test",
  mpMatch = "contains",
}: {
  mp: string;
  limit?: number;
  dataset?: "test" | "train" | "all";
  mpMatch?: "contains" | "exact";
}): Promise<PredictionListResponse> {
  const query = new URLSearchParams({ mp, limit: String(limit), dataset, mp_match: mpMatch });
  const response = await fetch(`${API_BASE_URL}/api/v1/predictions?${query}`);
  if (!response.ok) throw new Error(`Could not load MP projects (${response.status})`);
  return await response.json() as PredictionListResponse;
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
