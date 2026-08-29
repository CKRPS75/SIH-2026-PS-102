import type { Project } from "../data/projects";

// ── Helpers ───────────────────────────────────────────────────────────────────

function riskColor(risk: number) {
  if (risk >= 70) return { bg: "#FFDAD6", text: "#410002", dot: "#B3261E" };
  if (risk >= 40) return { bg: "#FFEFD6", text: "#341100", dot: "#F59E0B" };
  return { bg: "#D4F8E8", text: "#002116", dot: "#10B981" };
}

function statusLabel(status: Project["status"]) {
  if (status === "HIGH RISK") return { bg: "#FFDAD6", text: "#B3261E" };
  if (status === "REVIEW") return { bg: "#FFEFD6", text: "#7C4F00" };
  return { bg: "#D4F8E8", text: "#006C4C" };
}

function sanitizeAuditText(value: string | undefined | null): string {
  if (!value) return "";
  return value
    .replace(/\b(?:MPLADS|TEST|LIVE|PROJECT|REF|P)[-_]?[A-Z0-9][A-Z0-9-_]{2,}\b/gi, "redacted reference")
    .replace(/\b[a-f0-9]{16}\b/gi, "redacted reference")
    .replace(/\bproject[_\s-]*key\b/gi, "reference")
    .replace(/\bIsolationForest\b/g, "AI pattern model")
    .replace(/\blocality\+ward\b/gi, "same locality and ward")
    .replace(/\bsame-work-type\b/gi, "similar work type")
    .replace(/\bsame-work\b/gi, "similar work")
    .replace(/\bnear-Rs-5L\b/gi, "near-Rs 5 lakh")
    .trim();
}

export { riskColor, sanitizeAuditText, statusLabel };
