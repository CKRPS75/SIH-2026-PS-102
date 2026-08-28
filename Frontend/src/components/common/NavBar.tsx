// ── Android Nav Bar ───────────────────────────────────────────────────────────

function NavBar({ light = false }: { light?: boolean }) {
  const c = light ? "text-white/60" : "text-[#49454F]";
  return (
    <div className={`flex items-center justify-around px-8 py-2 shrink-0 ${c}`}>
      {/* Back */}
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
      {/* Home pill */}
      <div className="w-10 h-1.5 rounded-full bg-current opacity-60" />
      {/* Recents */}
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M3 5v14h18V5H3zm16 12H5V7h14v10z" opacity="0.7"/></svg>
    </div>
  );
}

export { NavBar };
