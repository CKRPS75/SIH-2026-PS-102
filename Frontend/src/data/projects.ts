type ProjectStatus = "HIGH RISK" | "REVIEW" | "VERIFIED";
type ProjectAnomaly = "Duplicate" | "Overpricing" | "Split Sanction" | "Pending Approval" | "None";

type Project = {
  id: string;
  short: string;
  title: string;
  location: string;
  district: string;
  constituency: string;
  amount: string;
  amountNum: number;
  bsr: string;
  bsrNum: number;
  risk: number;
  status: ProjectStatus;
  anomaly: ProjectAnomaly;
  contractor: string;
  agency: string;
  coords: string;
  submitted: string;
  description: string;
  duplicateScore: number;
  financialScore: number;
  splitSanctionScore: number;
  pendingScore: number;
  reasons: string[];
  sourceDataset?: string;
};

type Tab = "home" | "audits" | "judge" | "field";
type Filter = "All" | "Duplicates" | "Overpricing" | "Split Sanctions";

export type { Project, ProjectStatus, ProjectAnomaly, Tab, Filter };
