import type { Tab } from "../../data/projects";

// ── Bottom Navigation Bar ─────────────────────────────────────────────────────

function BottomNav({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const items: { key: Tab; label: string; icon: (active: boolean) => React.ReactNode }[] = [
    {
      key: "home", label: "Dashboard",
      icon: (a) => <svg width="22" height="22" viewBox="0 0 24 24" fill={a ? "#4F46E5" : "#49454F"}><path d={a ? "M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" : "M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8h5z"}/></svg>
    },
    {
      key: "audits", label: "AI Audits",
      icon: (a) => <svg width="22" height="22" viewBox="0 0 24 24" fill={a ? "#4F46E5" : "#49454F"}><path d={a ? "M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" : "M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"}/></svg>
    },
    {
      key: "judge", label: "Evaluate",
      icon: (a) => <svg width="22" height="22" viewBox="0 0 24 24" fill={a ? "#4F46E5" : "#49454F"}><path d={a ? "M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" : "M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"}/></svg>
    },
    {
      key: "field", label: "Field",
      icon: (a) => <svg width="22" height="22" viewBox="0 0 24 24" fill={a ? "#4F46E5" : "#49454F"}><path d={a ? "M17 1.01L7 1c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99zM17 19H7V5h10v14z" : "M17 1.01L7 1c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99zM17 19H7V5h10v14z"}/></svg>
    },
  ];

  return (
    <div className="shrink-0 flex items-stretch" style={{ background: "#FFFBFE", borderTop: "1px solid #E7E0EC" }}>
      {items.map(item => (
        <button
          key={item.key}
          onClick={() => setTab(item.key)}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 relative md-ripple"
        >
          {/* Active indicator pill */}
          {tab === item.key && (
            <div className="absolute top-1.5 w-14 h-8 rounded-full" style={{ background: "#E8E7FF" }} />
          )}
          <div className="relative z-10">{item.icon(tab === item.key)}</div>
          <span className="text-[10px] font-medium relative z-10" style={{ color: tab === item.key ? "#4F46E5" : "#49454F" }}>{item.label}</span>
        </button>
      ))}
    </div>
  );
}

export { BottomNav };
