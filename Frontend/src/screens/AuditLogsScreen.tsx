import { useState, useMemo } from "react";
import { getLogs } from "../data/auth";
import type { AuditLogEntry } from "../data/auth";
import { Card } from "../components/common/Card";

// ── Audit Logs Screen ─────────────────────────────────────────────────────────

interface AuditLogsScreenProps {
  onClose: () => void;
}

const ACTION_FILTER_OPTIONS = [
  "All",
  "User signed in",
  "User signed out",
  "Risk assessment viewed",
  "Field Audit opened",
  "Field Audit completed",
  "Project evaluated",
  "Project flagged",
  "Project approved",
  "Project rejected",
  "Site evidence captured",
  "Profile updated",
  "Preferences updated",
  "Preferences reset to default",
];

const RISK_BADGE: Record<string, { bg: string; color: string }> = {
  "HIGH RISK": { bg: "#FFDAD6", color: "#B3261E" },
  "REVIEW": { bg: "#FFEFD6", color: "#7C4F00" },
  "VERIFIED": { bg: "#D4F8E8", color: "#006C4C" },
};

const PAGE_SIZE = 8;

export function AuditLogsScreen({ onClose }: AuditLogsScreenProps) {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("All");
  const [riskFilter, setRiskFilter] = useState("All");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  const allLogs = getLogs();

  const filtered = useMemo(() => {
    let logs = [...allLogs];

    if (search.trim()) {
      const q = search.toLowerCase();
      logs = logs.filter(
        (l) =>
          l.action.toLowerCase().includes(q) ||
          (l.projectId?.toLowerCase().includes(q) ?? false) ||
          (l.projectName?.toLowerCase().includes(q) ?? false)
      );
    }
    if (actionFilter !== "All") {
      logs = logs.filter((l) => l.action === actionFilter);
    }
    if (riskFilter !== "All") {
      logs = logs.filter((l) => l.riskLevel === riskFilter);
    }
    logs.sort((a, b) => {
      const aKey = `${a.date}T${a.time}`;
      const bKey = `${b.date}T${b.time}`;
      return sort === "newest" ? bKey.localeCompare(aKey) : aKey.localeCompare(bKey);
    });
    return logs;
  }, [allLogs, search, actionFilter, riskFilter, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageLogs = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function resetFilters() {
    setSearch("");
    setActionFilter("All");
    setRiskFilter("All");
    setSort("newest");
    setPage(1);
  }

  return (
    <div className="absolute inset-0 z-50 flex flex-col animate-scale-in" style={{ background: "#F3F0F9" }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 shrink-0" style={{ background: "#FFFBFE", borderBottom: "1px solid #ECE6F0" }}>
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full flex items-center justify-center md-ripple"
          style={{ color: "#49454F" }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
          </svg>
        </button>
        <div className="text-base font-semibold flex-1" style={{ color: "#1C1B1F", fontFamily: "'Google Sans', sans-serif" }}>
          Audit Logs
        </div>
        <button
          onClick={() => setShowFilters((v) => !v)}
          className="w-9 h-9 rounded-full flex items-center justify-center md-ripple"
          style={{ background: showFilters ? "#E8E7FF" : "transparent", color: showFilters ? "#4F46E5" : "#49454F" }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M4.25 5.61C6.27 8.2 10 13 10 13v6c0 .55.45 1 1 1h2c.55 0 1-.45 1-1v-6s3.72-4.8 5.74-7.39A.998.998 0 0018.95 4H5.04a1 1 0 00-.79 1.61z" />
          </svg>
        </button>
      </div>

      {/* Search */}
      <div className="px-4 pt-3 shrink-0">
        <div className="flex items-center gap-2 px-3 rounded-2xl" style={{ background: "#FFFBFE", border: "1px solid #CAC4D0" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#79747E">
            <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search logs..."
            className="flex-1 py-2.5 text-xs outline-none bg-transparent"
            style={{ color: "#1C1B1F" }}
          />
          {search && (
            <button onClick={() => setSearch("")} style={{ color: "#79747E" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="px-4 pt-3 space-y-2 shrink-0 animate-fade-in">
          {/* Sort */}
          <div className="flex gap-2">
            {(["newest", "oldest"] as const).map((s) => (
              <button
                key={s}
                onClick={() => { setSort(s); setPage(1); }}
                className="flex-1 py-1.5 rounded-2xl text-xs font-semibold capitalize md-ripple"
                style={{
                  background: sort === s ? "#4F46E5" : "#ECE6F0",
                  color: sort === s ? "#FFFFFF" : "#49454F",
                }}
              >
                {s === "newest" ? "Newest First" : "Oldest First"}
              </button>
            ))}
          </div>
          {/* Risk filter */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {["All", "HIGH RISK", "REVIEW", "VERIFIED"].map((r) => (
              <button
                key={r}
                onClick={() => { setRiskFilter(r); setPage(1); }}
                className="shrink-0 px-3 py-1 rounded-full text-[10px] font-semibold md-ripple"
                style={{
                  background: riskFilter === r ? "#4F46E5" : (RISK_BADGE[r]?.bg ?? "#ECE6F0"),
                  color: riskFilter === r ? "#FFFFFF" : (RISK_BADGE[r]?.color ?? "#49454F"),
                }}
              >
                {r}
              </button>
            ))}
          </div>
          <button onClick={resetFilters} className="text-[10px] font-medium" style={{ color: "#4F46E5" }}>
            Reset Filters
          </button>
        </div>
      )}

      {/* Logs */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {/* Count */}
        <div className="text-[10px] font-medium px-1" style={{ color: "#79747E" }}>
          {filtered.length} {filtered.length === 1 ? "entry" : "entries"} · Page {page} of {totalPages}
        </div>

        {pageLogs.length === 0 && (
          <Card>
            <div className="p-8 text-center text-sm" style={{ color: "#79747E" }}>
              No log entries match your filters.
            </div>
          </Card>
        )}

        {pageLogs.map((log) => (
          <LogEntry key={log.id} log={log} />
        ))}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex gap-2 pt-1 pb-4">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex-1 h-10 rounded-2xl text-xs font-semibold md-ripple"
              style={{ background: "#ECE6F0", color: page === 1 ? "#CAC4D0" : "#1C1B1F" }}
            >
              ← Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="flex-1 h-10 rounded-2xl text-xs font-semibold md-ripple"
              style={{ background: "#ECE6F0", color: page === totalPages ? "#CAC4D0" : "#1C1B1F" }}
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function LogEntry({ log }: { log: AuditLogEntry }) {
  const isSignIn = log.action.includes("signed in") || log.action.includes("signed out");
  const iconColor = isSignIn ? "#4F46E5" : log.riskLevel === "HIGH RISK" ? "#B3261E" : log.riskLevel === "REVIEW" ? "#7C4F00" : "#006C4C";

  return (
    <Card>
      <div className="p-3.5 flex items-start gap-3">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5"
          style={{ background: `${iconColor}18` }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill={iconColor}>
            {isSignIn ? (
              <path d="M11 7L9.6 8.4l2.6 2.6H2v2h10.2l-2.6 2.6L11 17l5-5-5-5zm9 12h-8v2h8c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-8v2h8v14z" />
            ) : (
              <path d="M12 2l-5.5 9h11L12 2zm0 3.84L14.93 10H9.07L12 5.84zM17.5 13c-2.49 0-4.5 2.01-4.5 4.5S15.01 22 17.5 22s4.5-2.01 4.5-4.5S19.99 13 17.5 13zm0 7c-1.38 0-2.5-1.12-2.5-2.5S16.12 15 17.5 15s2.5 1.12 2.5 2.5S18.88 20 17.5 20zM3 21.5h8v-8H3v8zm2-6h4v4H5v-4z" />
            )}
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs font-semibold leading-tight" style={{ color: "#1C1B1F" }}>
              {log.action}
            </span>
            {log.riskLevel && (
              <span
                className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                style={{ background: RISK_BADGE[log.riskLevel]?.bg, color: RISK_BADGE[log.riskLevel]?.color }}
              >
                {log.riskLevel}
              </span>
            )}
          </div>
          {log.projectId && (
            <div className="text-[10px] font-mono mt-0.5 truncate" style={{ color: "#4F46E5" }}>
              {log.projectId}
            </div>
          )}
          {log.projectName && (
            <div className="text-[10px] mt-0.5 truncate" style={{ color: "#49454F" }}>
              {log.projectName}
            </div>
          )}
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[9px] font-mono" style={{ color: "#79747E" }}>
              {log.date} · {log.time}
            </span>
            <span className="text-[9px] font-mono" style={{ color: "#79747E" }}>
              {log.officer}
            </span>
            <span
              className="text-[9px] font-semibold"
              style={{ color: log.status === "Success" ? "#006C4C" : log.status === "Failed" ? "#B3261E" : "#7C4F00" }}
            >
              {log.status}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}

