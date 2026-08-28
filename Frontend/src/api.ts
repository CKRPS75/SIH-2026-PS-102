import type { Project } from "./data/projects";

const API_BASE_URL = "http://127.0.0.1:8000";

type PredictionRow = {
  project_key: string;
  state: string | null;
  constituency: string | null;
  ida: string | null;
  work_clean: string | null;
  locality: string | null;
  recommended_date: string | null;
  allocation_amount_numeric: number;
  model_risk_score: number;
  model_risk_level: string;
  model_duplicate_score: number;
  model_financial_score: number;
  model_split_sanction_score: number;
  model_reasons: string[];
};

type PredictionResponse = {
  rows: PredictionRow[];
};

type RiskEvaluation = {
  project_id: string;
  final_score: number;
  risk_level: string;
  reasons: string[];
};

function formatAmount(amount: number): string {
  return `₹${(amount / 100000).toFixed(1)}L`;
}

function mapPrediction(row: PredictionRow): Project {
  const risk = Math.round(row.model_risk_score);
  const status = row.model_risk_level === "RED"
    ? "HIGH RISK"
    : row.model_risk_level === "YELLOW" ? "REVIEW" : "VERIFIED";
  const anomaly = row.model_duplicate_score > 0
    ? "Duplicate"
    : row.model_split_sanction_score > 0
      ? "Split Sanction"
      : row.model_financial_score > 0 ? "Overpricing" : "None";

  return {
    id: row.project_key,
    short: row.project_key.slice(0, 8).toUpperCase(),
    title: row.work_clean || "Untitled project",
    location: [row.locality, row.state].filter(Boolean).join(", ") || "Location unavailable",
    district: row.locality || "Unknown",
    constituency: row.constituency || "Unknown",
    amount: formatAmount(row.allocation_amount_numeric),
    amountNum: row.allocation_amount_numeric / 100000,
    bsr: "N/A",
    bsrNum: 0,
    risk,
    status,
    anomaly,
    contractor: "Unavailable",
    agency: row.ida || "Unavailable",
    coords: "Unavailable",
    submitted: row.recommended_date || "Unavailable",
    description: row.model_reasons.join("; ") || row.work_clean || "No description available.",
  };
}

export async function getProjects(): Promise<Project[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/predictions?limit=100`);
  if (!response.ok) throw new Error(`Backend request failed (${response.status})`);
  const data = await response.json() as PredictionResponse;
  return data.rows.map(mapPrediction);
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
  block: string;
  recommended_date: string;
  status: string;
  ida_approval: string;
  allocation_amount_numeric: number;
}): Promise<{ project: Project; evaluation: RiskEvaluation }> {
  const createResponse = await fetch(`${API_BASE_URL}/api/v1/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      external_work_id: input.project_key,
      title: input.work_clean,
      description: `${input.category} project in ${input.locality}, ${input.block}`,
      district: input.locality || "Unknown",
      state: input.state,
      estimated_cost: input.allocation_amount_numeric,
      award_date: input.recommended_date || null,
      agency: { name: input.ida || "Unknown", state: input.state },
      contractor: { legal_name: "Not provided" },
      location: { lat: 0, lng: 0 },
      cost_items: [{
        item_code: "BSR-CHECK",
        description: input.category || input.work_clean,
        quantity: 1,
        unit: "project",
        proposed_rate: input.allocation_amount_numeric,
      }],
      source: "FRONTEND_JUDGE",
    }),
  });
  if (!createResponse.ok) throw new Error(`Could not create proposal (${createResponse.status})`);
  const created = await createResponse.json() as { id: string };

  const preprocessResponse = await fetch(`${API_BASE_URL}/api/v1/projects/${created.id}/preprocess`, { method: "POST" });
  if (!preprocessResponse.ok) throw new Error(`Could not preprocess proposal (${preprocessResponse.status})`);

  const evaluateResponse = await fetch(`${API_BASE_URL}/api/v1/projects/${created.id}/evaluate`, { method: "POST" });
  if (!evaluateResponse.ok) throw new Error(`Could not evaluate proposal (${evaluateResponse.status})`);
  const evaluation = await evaluateResponse.json() as RiskEvaluation;
  const risk = Math.round(evaluation.final_score);

  return {
    project: {
      id: created.id,
      short: created.id,
      title: input.work_clean,
      location: [input.locality, input.block, input.state].filter(Boolean).join(", "),
      district: input.locality || "Unknown",
      constituency: input.constituency || "Unknown",
      amount: formatAmount(input.allocation_amount_numeric),
      amountNum: input.allocation_amount_numeric / 100000,
      bsr: "N/A",
      bsrNum: 0,
      risk,
      status: evaluation.risk_level === "RED" ? "HIGH RISK" : evaluation.risk_level === "YELLOW" ? "REVIEW" : "VERIFIED",
      anomaly: evaluation.reasons[0]?.toLowerCase().includes("duplicate") ? "Duplicate" : "None",
      contractor: "Not provided",
      agency: input.ida || "Unknown",
      coords: "Not provided",
      submitted: "Just now",
      description: `${input.category} · ${input.status} · IDA approval: ${input.ida_approval}`,
    },
    evaluation,
  };
}