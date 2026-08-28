import type { Project } from "../../data/projects";
import { statusLabel } from "../../utils/helpers";

// ── Risk Chip ─────────────────────────────────────────────────────────────────

function RiskChip({ status }: { status: Project["status"] }) {
  const s = statusLabel(status);
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: s.bg, color: s.text }}>
      {status}
    </span>
  );
}

export { RiskChip };
