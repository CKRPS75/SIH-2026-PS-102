// ── MD3 Chip ─────────────────────────────────────────────────────────────────

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="shrink-0 flex items-center gap-1.5 px-3 h-8 rounded-full text-xs font-medium transition-all md-ripple"
      style={{
        background: active ? "#4F46E5" : "#ECE6F0",
        color: active ? "#FFFFFF" : "#49454F",
        border: active ? "1.5px solid #4F46E5" : "1.5px solid #CAC4D0",
      }}
    >
      {active && <span>✓</span>}
      {label}
    </button>
  );
}

export { Chip };
