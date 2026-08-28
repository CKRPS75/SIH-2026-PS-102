import { useState, useEffect } from "react";

// ── Android Status Bar ────────────────────────────────────────────────────────

function StatusBar({ light = false }: { light?: boolean }) {
  const [time, setTime] = useState(() => new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false }));
  useEffect(() => {
    const iv = setInterval(() => setTime(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false })), 10000);
    return () => clearInterval(iv);
  }, []);
  const c = light ? "text-white" : "text-[#1C1B1F]";
  return (
    <div className={`flex items-center justify-between px-4 pt-2 pb-1 text-[11px] font-medium ${c} shrink-0`} style={{ fontFamily: "Roboto, sans-serif" }}>
      <span>{time}</span>
      <div className="flex items-center gap-1.5">
        {/* Signal */}
        <svg width="14" height="10" viewBox="0 0 14 10" fill="currentColor">
          <rect x="0" y="7" width="2" height="3" rx="0.5" opacity="1"/>
          <rect x="3" y="5" width="2" height="5" rx="0.5" opacity="1"/>
          <rect x="6" y="3" width="2" height="7" rx="0.5" opacity="1"/>
          <rect x="9" y="1" width="2" height="9" rx="0.5" opacity="1"/>
          <rect x="12" y="0" width="2" height="10" rx="0.5" opacity="0.3"/>
        </svg>
        {/* WiFi */}
        <svg width="14" height="10" viewBox="0 0 14 10" fill="currentColor">
          <path d="M7 8.5a1 1 0 100-2 1 1 0 000 2z"/>
          <path d="M4.5 6.5a3.5 3.5 0 015 0" strokeWidth="1.2" stroke="currentColor" fill="none" strokeLinecap="round"/>
          <path d="M2 4.2a6.5 6.5 0 0110 0" strokeWidth="1.2" stroke="currentColor" fill="none" strokeLinecap="round"/>
        </svg>
        {/* Battery */}
        <svg width="20" height="11" viewBox="0 0 20 11" fill="currentColor">
          <rect x="0.5" y="0.5" width="16" height="10" rx="2" stroke="currentColor" strokeWidth="1" fill="none"/>
          <rect x="17.5" y="3" width="2" height="5" rx="1" fill="currentColor" opacity="0.5"/>
          <rect x="2" y="2" width="11" height="7" rx="1" fill="currentColor"/>
        </svg>
      </div>
    </div>
  );
}

export { StatusBar };
