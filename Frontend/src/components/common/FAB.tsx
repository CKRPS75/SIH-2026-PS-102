// ── MD3 FAB ───────────────────────────────────────────────────────────────────

function FAB({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-4 h-14 rounded-2xl md-ripple elev-3 transition-transform active:scale-95"
      style={{ background: "#E8E7FF", color: "#1A006E" }}
    >
      {icon}
      <span className="text-sm font-semibold">{label}</span>
    </button>
  );
}

export { FAB };
