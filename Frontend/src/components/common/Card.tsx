// ── MD3 Card ──────────────────────────────────────────────────────────────────

function Card({ children, className = "", onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`rounded-3xl ${className} ${onClick ? "md-ripple cursor-pointer active:scale-[0.98] transition-transform" : ""}`}
      style={{ background: "var(--theme-surface)" }}
    >
      {children}
    </div>
  );
}

export { Card };
