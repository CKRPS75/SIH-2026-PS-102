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

export { riskColor, statusLabel };
