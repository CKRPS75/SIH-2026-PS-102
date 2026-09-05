import { memo, useEffect, useMemo, useState, type FormEvent } from "react";
import type { Project, Filter } from "../data/projects";
import { getMockLiveAlerts, getPredictions, getStateAnomalyRates, type PredictionRow, type StateAnomalyRateRow } from "../api";
import { riskColor } from "../utils/helpers";
import { Chip } from "../components/common/Chip";
import { Card } from "../components/common/Card";
import { RiskChip } from "../components/common/RiskChip";
import { RiskIntelligenceMap } from "../components/common/RiskIntelligenceMap";

// ── Home Screen ───────────────────────────────────────────────────────────────

type RiskBucket = {
  label: string;
  min: number;
  max: number;
  color: string;
};

type AllocationBucket = {
  label: string;
  min: number;
  max: number;
};

type DashboardKpiCard = {
  label: string;
  value: string;
  caption?: string;
  icon: string;
  bg: string;
  text: string;
};

type AlertSection = {
  key: Project["status"];
  title: string;
  caption: string;
  bg: string;
  text: string;
};

const RISK_BUCKETS: RiskBucket[] = [
  { label: "Very Low", min: 0, max: 2, color: "#10B981" },
  { label: "Low", min: 2, max: 4, color: "#22C55E" },
  { label: "Moderate", min: 4, max: 6, color: "#F59E0B" },
  { label: "High", min: 6, max: 8, color: "#EF4444" },
  { label: "Critical", min: 8, max: 10.01, color: "#B3261E" },
];

const ALLOCATION_BUCKETS: AllocationBucket[] = [
  { label: "Rs 0-1L", min: 0, max: 100000 },
  { label: "Rs 1L-2L", min: 100000, max: 200000 },
  { label: "Rs 2L-5L", min: 200000, max: 500000 },
  { label: "Rs 5L-10L", min: 500000, max: 1000000 },
  { label: "Rs 10L-25L", min: 1000000, max: 2500000 },
  { label: "Rs 25L-50L", min: 2500000, max: 5000000 },
  { label: "Rs 50L-1Cr", min: 5000000, max: 10000000 },
  { label: "> Rs 1Cr", min: 10000000, max: Infinity },
];

const ALERT_SECTIONS: AlertSection[] = [
  { key: "HIGH RISK", title: "Red", caption: "High risk mock cases", bg: "#FFDAD6", text: "#B3261E" },
  { key: "REVIEW", title: "Yellow", caption: "Mock cases needing review", bg: "#FFEFD6", text: "#7C4F00" },
  { key: "VERIFIED", title: "Green", caption: "Mock cases cleared by logic", bg: "#D4F8E8", text: "#006C4C" },
];

function amountToRupees(project: Project): number {
  return project.amountNum * 100000;
}

function amountLabelFromRupees(amount: number): string {
  if (amount >= 10000000) return `Rs ${(amount / 10000000).toFixed(1)}Cr`;
  return `Rs ${(amount / 100000).toFixed(1)}L`;
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

function projectRiskScore(project: Project): number {
  return project.risk / 10;
}

function isAnomalousProject(project: Project): boolean {
  return project.status !== "VERIFIED";
}

function stateFromLocation(project: Project): string {
  const parts = project.location.split(",");
  return parts[parts.length - 1]?.trim() || "Unknown";
}

function HomeScreen({ projects, onOpenAudit }: { projects: Project[]; onOpenAudit: (p: Project) => void }) {
  const [filter, setFilter] = useState<Filter>("All");
  const [riskBucketFilter, setRiskBucketFilter] = useState<string | null>(null);
  const [allocationBucketFilter, setAllocationBucketFilter] = useState<string | null>(null);
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("2 min ago");
  const [dashboardSection, setDashboardSection] = useState<"statistics" | "alerts">("statistics");
  const [mpQuery, setMpQuery] = useState("");
  const [searchedMp, setSearchedMp] = useState("");
  const [mpProjects, setMpProjects] = useState<PredictionRow[]>([]);
  const [mpProjectTotal, setMpProjectTotal] = useState(0);
  const [mpSearchError, setMpSearchError] = useState<string | null>(null);
  const [isMpSearchLoading, setIsMpSearchLoading] = useState(false);
  const [stateRateRows, setStateRateRows] = useState<StateAnomalyRateRow[]>([]);
  const [stateRateError, setStateRateError] = useState<string | null>(null);
  const [mockAlertProjects, setMockAlertProjects] = useState<Project[]>([]);
  const [mockAlertError, setMockAlertError] = useState<string | null>(null);
  const [mockAlertsLoading, setMockAlertsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getStateAnomalyRates(10)
      .then(response => {
        if (!cancelled) {
          setStateRateRows(response.rows);
          setStateRateError(null);
        }
      })
      .catch(error => {
        if (!cancelled) {
          setStateRateRows([]);
          setStateRateError(error instanceof Error ? error.message : "Could not load state rates");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setMockAlertsLoading(true);
    getMockLiveAlerts()
      .then(records => {
        if (!cancelled) {
          setMockAlertProjects(records);
          setMockAlertError(null);
        }
      })
      .catch(error => {
        if (!cancelled) {
          setMockAlertProjects([]);
          setMockAlertError(error instanceof Error ? error.message : "Could not load mock live alerts");
        }
      })
      .finally(() => {
        if (!cancelled) setMockAlertsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filters: Filter[] = ["All", "Duplicates", "Overpricing", "Split Sanctions"];
  const riskBucketStats = useMemo(() => RISK_BUCKETS.map(bucket => {
    const bucketProjects = projects.filter(project => {
      const score = projectRiskScore(project);
      return score >= bucket.min && score < bucket.max;
    });
    const allocationAmount = bucketProjects.reduce((sum, project) => sum + amountToRupees(project), 0);
    return {
      ...bucket,
      projectCount: bucketProjects.length,
      percentage: projects.length ? (bucketProjects.length / projects.length) * 100 : 0,
      allocationAmount,
    };
  }), [projects]);
  const nonZeroRiskCards: DashboardKpiCard[] = riskBucketStats
    .filter(bucket => bucket.projectCount > 0)
    .map(bucket => ({
      label: `${bucket.label} Risk`,
      value: `${bucket.projectCount}`,
      caption: amountLabelFromRupees(bucket.allocationAmount),
      icon: bucket.label.charAt(0),
      bg: bucket.label === "Critical" ? "#FCE8E6" : bucket.label === "High" ? "#FFDAD6" : bucket.label === "Moderate" ? "#FFF8E1" : "#D4F8E8",
      text: bucket.color,
  }));
  const dashboardKpiCards: DashboardKpiCard[] = [
    { label: "Total Projects", value: `${projects.length}`, caption: "Full MPLADS dataset", icon: "T", bg: "#E8E7FF", text: "#1A006E" },
    ...nonZeroRiskCards,
  ];

  const allocationStats = useMemo(() => {
    const validAllocationProjects = projects.filter(project => amountToRupees(project) >= 0);
    const allocationValues = validAllocationProjects.map(amountToRupees);
    const allocationBucketStats = ALLOCATION_BUCKETS.map(bucket => {
      const bucketProjects = validAllocationProjects.filter(project => {
        const amount = amountToRupees(project);
        return amount >= bucket.min && amount < bucket.max;
      });
      return {
        ...bucket,
        projectCount: bucketProjects.length,
        percentage: validAllocationProjects.length ? (bucketProjects.length / validAllocationProjects.length) * 100 : 0,
        totalAllocation: bucketProjects.reduce((sum, project) => sum + amountToRupees(project), 0),
      };
    });
    return {
      allocationBucketStats,
      maxAllocationBucketCount: Math.max(...allocationBucketStats.map(bucket => bucket.projectCount), 1),
      medianAllocation: percentile(allocationValues, 50),
      p90Allocation: percentile(allocationValues, 90),
      p95Allocation: percentile(allocationValues, 95),
      meanAllocation: allocationValues.length ? allocationValues.reduce((sum, amount) => sum + amount, 0) / allocationValues.length : 0,
      maxAllocation: Math.max(...allocationValues, 0),
    };
  }, [projects]);
  const { allocationBucketStats, maxAllocationBucketCount, medianAllocation, p90Allocation, p95Allocation, meanAllocation, maxAllocation } = allocationStats;
  const allocationSummaryCards: Array<{ label: string; value: number; emphasize: boolean }> = [
    { label: "Median", value: medianAllocation, emphasize: true },
    { label: "Mean", value: meanAllocation, emphasize: false },
    { label: "P90", value: p90Allocation, emphasize: false },
    { label: "P95", value: p95Allocation, emphasize: false },
    { label: "Max", value: maxAllocation, emphasize: false },
  ];

  const stateStats = useMemo(() => Object.values(
    projects.reduce<Record<string, {
      key: string;
      state: string;
      totalProjects: number;
      totalAllocation: number;
      anomalousProjects: number;
      duplicateCandidates: number;
      financialAnomalies: number;
      splitSanctionProjects: number;
      highRiskProjects: number;
      criticalRiskProjects: number;
      riskScoreTotal: number;
      projects: Project[];
    }>>((acc, project) => {
      const state = stateFromLocation(project);
      const key = state;
      const current = acc[key] ?? {
        key,
        state,
        totalProjects: 0,
        totalAllocation: 0,
        anomalousProjects: 0,
        duplicateCandidates: 0,
        financialAnomalies: 0,
        splitSanctionProjects: 0,
        highRiskProjects: 0,
        criticalRiskProjects: 0,
        riskScoreTotal: 0,
        projects: [],
      };
      current.totalProjects += 1;
      current.totalAllocation += amountToRupees(project);
      current.anomalousProjects += isAnomalousProject(project) ? 1 : 0;
      current.duplicateCandidates += project.duplicateScore >= 65 || project.anomaly === "Duplicate" ? 1 : 0;
      current.financialAnomalies += project.financialScore >= 45 || project.anomaly === "Overpricing" ? 1 : 0;
      current.splitSanctionProjects += project.splitSanctionScore >= 60 || project.anomaly === "Split Sanction" ? 1 : 0;
      current.highRiskProjects += projectRiskScore(project) >= 6 && projectRiskScore(project) < 8 ? 1 : 0;
      current.criticalRiskProjects += projectRiskScore(project) >= 8 ? 1 : 0;
      current.riskScoreTotal += projectRiskScore(project);
      current.projects.push(project);
      acc[key] = current;
      return acc;
    }, {})
  ).map(row => ({
    ...row,
    anomalyRate: row.totalProjects ? (row.anomalousProjects / row.totalProjects) * 100 : 0,
    averageRiskScore: row.totalProjects ? row.riskScoreTotal / row.totalProjects : 0,
    confidence: row.totalProjects >= 10 ? "High" : "Low Sample Confidence",
  })), [projects]);
  const stateStatsByKey = new Map(stateStats.map(row => [row.key, row]));
  const fallbackStates = stateStats
    .filter(row => row.totalProjects >= 10)
    .sort((a, b) => b.anomalyRate - a.anomalyRate || b.totalProjects - a.totalProjects)
    .slice(0, 10);
  const displayedStates = stateRateRows.length
    ? stateRateRows.map(row => {
      const key = row.state;
      const localStats = stateStatsByKey.get(key);
      return {
        key,
        state: row.state,
        totalProjects: row.total_case_count,
        totalAllocation: row.total_allocation_amount,
        anomalousProjects: row.anomalous_case_count,
        duplicateCandidates: row.duplicate_count,
        financialAnomalies: row.financial_anomaly_count,
        splitSanctionProjects: row.split_sanction_count,
        highRiskProjects: localStats?.highRiskProjects ?? 0,
        criticalRiskProjects: localStats?.criticalRiskProjects ?? 0,
        riskScoreTotal: localStats?.riskScoreTotal ?? 0,
        projects: localStats?.projects ?? [],
        anomalyRate: row.anomaly_rate,
        averageRiskScore: row.mean_model_risk_score / 10,
        confidence: row.total_case_count >= 10 ? "High" : "Low Sample Confidence",
      };
    })
    : fallbackStates.length
    ? fallbackStates
    : stateStats.sort((a, b) => b.anomalyRate - a.anomalyRate).slice(0, 10);
  const selectedStateStats = selectedState
    ? displayedStates.find(row => row.key === selectedState)
      ?? stateStats.find(row => row.key === selectedState)
      ?? null
    : null;

  const filtered = useMemo(() => projects.filter(p => {
    if (filter === "All") return true;
    if (filter === "Duplicates") return p.anomaly === "Duplicate";
    if (filter === "Overpricing") return p.anomaly === "Overpricing";
    if (filter === "Split Sanctions") return p.anomaly === "Split Sanction";
    return true;
  }).filter(project => {
    if (!riskBucketFilter) return true;
    const bucket = RISK_BUCKETS.find(item => item.label === riskBucketFilter);
    if (!bucket) return true;
    const score = projectRiskScore(project);
    return score >= bucket.min && score < bucket.max;
  }).filter(project => {
    if (!allocationBucketFilter) return true;
    const bucket = ALLOCATION_BUCKETS.find(item => item.label === allocationBucketFilter);
    if (!bucket) return true;
    const amount = amountToRupees(project);
    return amount >= bucket.min && amount < bucket.max;
  }), [projects, filter, riskBucketFilter, allocationBucketFilter]);
  const alertCount = mockAlertProjects.length;
  const alertGroups = useMemo(() => ALERT_SECTIONS.map(section => ({
    ...section,
    projects: mockAlertProjects.filter(project => project.status === section.key),
  })), [mockAlertProjects]);
  const mapPositions = [
    { x: "40%", y: "40%" },
    { x: "43%", y: "44%" },
    { x: "58%", y: "55%" },
    { x: "63%", y: "32%" },
    { x: "28%", y: "65%" },
    { x: "52%", y: "20%" },
  ];

  function handleRefresh() {
    setRefreshing(true);
    setTimeout(() => { setRefreshing(false); setLastUpdated("Just now"); }, 1600);
  }

  async function handleMpSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const mpName = mpQuery.trim();
    if (!mpName) return;

    setIsMpSearchLoading(true);
    setMpSearchError(null);
    setSearchedMp(mpName);
    try {
      const response = await getPredictions({ mp: mpName, dataset: "all", mpMatch: "exact" });
      setMpProjects(response.rows);
      setMpProjectTotal(response.total);
    } catch (searchError) {
      setMpProjects([]);
      setMpProjectTotal(0);
      setMpSearchError(searchError instanceof Error ? searchError.message : "Could not load MP projects");
    } finally {
      setIsMpSearchLoading(false);
    }
  }

  return (
    <div className="dashboard-screen flex-1 overflow-y-auto" style={{ background: "#F3F0F9" }}>
      {/* Top App Bar */}
      <div className="px-4 pt-2 pb-3" style={{ background: "#F3F0F9" }}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-medium" style={{ color: "#49454F" }}>MPLADS AI-GUARDIAN</div>
            <div className="text-2xl font-semibold" style={{ fontFamily: "'Google Sans Display', sans-serif", color: "#1C1B1F" }}>Dashboard</div>
          </div>
          <button onClick={handleRefresh} className="w-10 h-10 rounded-full flex items-center justify-center md-ripple" style={{ background: "#ECE6F0" }}>
            <svg className={`w-5 h-5 ${refreshing ? "animate-spin" : ""}`} viewBox="0 0 24 24" fill="#49454F">
              <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
            </svg>
          </button>
        </div>
        {/* AI Status banner */}
        <div className="mt-3 rounded-2xl px-4 py-3 flex items-center gap-3" style={{ background: "#1C1B1F" }}>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 animate-pulse-glow" style={{ background: "#10B981" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/></svg>
          </div>
          <div className="flex-1">
            <div className="text-xs font-bold" style={{ color: "#FFFFFF" }}>AI Gateway Active</div>
            <div className="text-[10px]" style={{ color: "rgba(255,255,255,0.6)" }}>{refreshing ? "Refreshing AI intelligence..." : `Last sync ${lastUpdated}`}</div>
          </div>
          <div className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "#10B981", color: "#FFFFFF" }}>ONLINE</div>
        </div>
      </div>

      {/* KPI Cards — horizontal scroll */}
      <div className="flex gap-3 px-4 overflow-x-auto pb-1">
        {dashboardKpiCards.map(k => (
          <div key={k.label} className="shrink-0 w-36 rounded-3xl p-4 elev-1" style={{ background: k.bg }}>
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-black mb-2" style={{ background: "rgba(255,255,255,0.7)", color: k.text }}>{k.icon}</div>
            <div className="text-[10px] font-medium mb-0.5" style={{ color: k.text, opacity: 0.7 }}>{k.label}</div>
            <div className="text-sm font-black" style={{ color: k.text }}>{k.value}</div>
            {k.caption && <div className="text-[9px] mt-0.5 truncate" style={{ color: k.text, opacity: 0.72 }}>{k.caption}</div>}
          </div>
        ))}
      </div>

      <div className="px-4 mt-5">
        <div className="grid grid-cols-2 gap-2 rounded-2xl p-1" style={{ background: "#ECE6F0" }}>
          <button
            onClick={() => setDashboardSection("statistics")}
            className="h-9 rounded-xl text-xs font-semibold md-ripple"
            style={{ background: dashboardSection === "statistics" ? "#FFFBFE" : "transparent", color: "#1C1B1F" }}
          >
            Statistics
          </button>
          <button
            onClick={() => setDashboardSection("alerts")}
            className="h-9 rounded-xl text-xs font-semibold md-ripple"
            style={{ background: dashboardSection === "alerts" ? "#FFFBFE" : "transparent", color: "#1C1B1F" }}
          >
            Live Alert Feed{alertCount ? ` (${alertCount})` : ""}
          </button>
        </div>
      </div>

      {dashboardSection === "statistics" && <>
      <div className="px-4 mt-4">
        <Card>
          <div className="p-4 space-y-4">
            <div>
              <div className="text-sm font-semibold" style={{ fontFamily: "'Google Sans', sans-serif", color: "#1C1B1F" }}>MP Project Allocation</div>
              <div className="text-xs mt-1" style={{ color: "#49454F" }}>Exact MP-name search across the full MPLADS model dataset</div>
            </div>
            <form onSubmit={handleMpSearch}>
              <input
                value={mpQuery}
                onChange={event => setMpQuery(event.target.value)}
                placeholder="Enter MP name and press Enter"
                aria-label="MP name"
                className="w-full h-11 rounded-xl border px-3 text-sm outline-none"
                style={{ background: "#FFFBFE", borderColor: "#CAC4D0", color: "#1C1B1F" }}
              />
            </form>
            {isMpSearchLoading && <div className="text-xs" style={{ color: "#49454F" }}>Loading projects...</div>}
            {mpSearchError && <div className="text-xs" style={{ color: "#B3261E" }}>{mpSearchError}</div>}
            {!isMpSearchLoading && searchedMp && !mpSearchError && mpProjects.length === 0 && (
              <div className="text-xs" style={{ color: "#49454F" }}>No scored MPLADS projects found for {searchedMp}.</div>
            )}
            {mpProjects.length > 0 && (() => {
              const chartProjects = [...mpProjects]
                .sort((first, second) => second.allocation_amount_numeric - first.allocation_amount_numeric)
                .slice(0, 12);
              const maximumAmount = Math.max(...chartProjects.map(project => project.allocation_amount_numeric), 1);
              return (
                <div className="space-y-2">
                  <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#49454F" }}>
                    {mpProjects[0]?.mp_name || searchedMp} · {mpProjectTotal} project rows
                  </div>
                  {chartProjects.map(project => (
                    <div key={project.project_key} className="grid grid-cols-[minmax(0,1fr)_56px] gap-3 items-center">
                      <div className="min-w-0">
                        <div className="text-[10px] font-semibold truncate" title={project.work_clean || "Untitled project"} style={{ color: "#1C1B1F" }}>
                          {project.work_clean || "Untitled project"}
                        </div>
                        <div className="mt-1 h-3 rounded-full overflow-hidden" style={{ background: "#F3F0F9" }}>
                          <div className="h-full rounded-full" style={{ width: `${Math.max(4, (project.allocation_amount_numeric / maximumAmount) * 100)}%`, background: "#4F46E5" }} />
                        </div>
                      </div>
                      <div className="text-right text-[10px] font-semibold" style={{ color: "#1A006E" }}>
                        {amountLabelFromRupees(project.allocation_amount_numeric)}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </Card>
      </div>

      {/* Overall risk distribution */}
      <div className="px-4 mt-4">
        <Card>
          <div className="p-4 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold" style={{ fontFamily: "'Google Sans', sans-serif", color: "#1C1B1F" }}>Overall Project Risk Distribution</div>
                <div className="text-xs mt-1" style={{ color: "#49454F" }}>Anomaly Risk Score buckets from full MPLADS reference records</div>
              </div>
              {riskBucketFilter && (
                <button onClick={() => setRiskBucketFilter(null)} className="text-[10px] font-semibold px-2 py-1 rounded-full md-ripple" style={{ background: "#ECE6F0", color: "#49454F" }}>Clear</button>
              )}
            </div>

            <div className="space-y-2">
              {riskBucketStats.map(bucket => (
                <button
                  key={bucket.label}
                  onClick={() => setRiskBucketFilter(riskBucketFilter === bucket.label ? null : bucket.label)}
                  title={`${bucket.label}: ${bucket.projectCount} projects, ${bucket.percentage.toFixed(1)}%, ${amountLabelFromRupees(bucket.allocationAmount)}`}
                    className="risk-distribution-row w-full text-left grid grid-cols-[74px_1fr_62px] items-center gap-2 rounded-2xl p-2 md-ripple"
                  style={{ background: riskBucketFilter === bucket.label ? "#E8E7FF" : "#FFFFFF" }}
                >
                  <div>
                    <div className="text-[10px] font-semibold" style={{ color: "#1C1B1F" }}>{bucket.label}</div>
                    <div className="text-[9px]" style={{ color: "#79747E" }}>{bucket.min.toFixed(0)}-{bucket.max > 10 ? "10" : bucket.max.toFixed(0)}</div>
                  </div>
                  <div className="h-7 rounded-xl overflow-hidden" style={{ background: "#F3F0F9" }}>
                    <div className="h-full rounded-xl" style={{ width: `${Math.max(4, bucket.percentage)}%`, background: bucket.color, opacity: bucket.projectCount ? 1 : 0.16 }} />
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-black" style={{ color: bucket.color }}>{bucket.percentage.toFixed(1)}%</div>
                    <div className="text-[9px]" style={{ color: "#79747E" }}>{bucket.projectCount} cases</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* State anomaly ranking */}
      <div className="px-4 mt-4">
        <Card>
          <div className="p-4 space-y-4">
            <div>
              <div className="text-sm font-semibold" style={{ fontFamily: "'Google Sans', sans-serif", color: "#1C1B1F" }}>Top States by Anomaly Rate</div>
              <div className="text-xs mt-1" style={{ color: "#49454F" }}>Percentage = anomalous MPLADS cases / total MPLADS projects in that state</div>
              {stateRateError && (
                <div className="text-[10px] mt-1" style={{ color: "#7C4F00" }}>Using local fallback because backend rate API did not respond.</div>
              )}
            </div>
            <div className="space-y-2">
              {displayedStates.map(row => (
                <button
                  key={row.key}
                  onClick={() => setSelectedState(selectedState === row.key ? null : row.key)}
                  title={`${row.state}: ${row.anomalousProjects} anomaly candidates from ${row.totalProjects} MPLADS projects`}
                  className="state-anomaly-row w-full text-left grid grid-cols-[104px_1fr_52px] items-center gap-2 rounded-2xl p-2 md-ripple"
                  style={{ background: selectedState === row.key ? "#E8E7FF" : "#FFFFFF" }}
                >
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold truncate" style={{ color: "#1C1B1F" }}>{row.state}</div>
                    <div className="text-[9px] truncate" style={{ color: "#79747E" }}>MPLADS state total</div>
                  </div>
                  <div className="h-7 rounded-xl overflow-hidden" style={{ background: "#F3F0F9" }}>
                    <div className="h-full rounded-xl" style={{ width: `${Math.max(5, row.anomalyRate)}%`, background: row.anomalyRate >= 50 ? "#B3261E" : "#F59E0B" }} />
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-black" style={{ color: row.anomalyRate >= 50 ? "#B3261E" : "#7C4F00" }}>{row.anomalyRate.toFixed(1)}%</div>
                    <div className="text-[9px]" style={{ color: "#79747E" }}>{row.anomalousProjects}/{row.totalProjects}</div>
                  </div>
                </button>
              ))}
            </div>
            {selectedStateStats && (
              <div className="rounded-2xl p-3 space-y-3" style={{ background: "#F3F0F9" }}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold" style={{ color: "#1C1B1F" }}>{selectedStateStats.state}</div>
                    <div className="text-[10px]" style={{ color: "#49454F" }}>{selectedStateStats.anomalousProjects}/{selectedStateStats.totalProjects} anomalous MPLADS projects · {selectedStateStats.confidence}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-semibold" style={{ color: "#49454F" }}>Average Risk</div>
                    <div className="text-sm font-black" style={{ color: "#B3261E" }}>{selectedStateStats.averageRiskScore.toFixed(1)}/10</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    ["Duplicates", selectedStateStats.duplicateCandidates],
                    ["Financial", selectedStateStats.financialAnomalies],
                    ["Split", selectedStateStats.splitSanctionProjects],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl p-2" style={{ background: "#FFFFFF" }}>
                      <div className="text-[9px]" style={{ color: "#79747E" }}>{label}</div>
                      <div className="text-sm font-black" style={{ color: "#1C1B1F" }}>{value}</div>
                    </div>
                  ))}
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#49454F" }}>Top Suspicious Projects</div>
                  {selectedStateStats.projects
                    .filter(isAnomalousProject)
                    .sort((a, b) => b.risk - a.risk)
                    .slice(0, 3)
                    .map(project => (
                      <button key={project.id} onClick={() => onOpenAudit(project)} className="w-full text-left rounded-xl px-3 py-2 md-ripple" style={{ background: "#FFFFFF" }}>
                        <div className="text-[10px] font-semibold truncate" style={{ color: "#1C1B1F" }}>{project.title}</div>
                        <div className="text-[9px]" style={{ color: "#79747E" }}>{project.anomaly} · {project.risk / 10}/10 · {project.amount}</div>
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Allocation distribution */}
      <div className="px-4 mt-4">
        <Card>
          <div className="p-4 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold" style={{ fontFamily: "'Google Sans', sans-serif", color: "#1C1B1F" }}>Distribution of MPLADS Project Allocations</div>
                <div className="text-xs mt-1" style={{ color: "#49454F" }}>Shows cost spread only; large projects are not automatically fraud</div>
              </div>
              {allocationBucketFilter && (
                <button onClick={() => setAllocationBucketFilter(null)} className="text-[10px] font-semibold px-2 py-1 rounded-full md-ripple" style={{ background: "#ECE6F0", color: "#49454F" }}>Clear</button>
              )}
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {allocationSummaryCards.map(({ label, value, emphasize }) => (
                <div key={label} className="rounded-xl p-2" style={{ background: emphasize ? "#E8E7FF" : "#F3F0F9" }}>
                  <div className="text-[8px] font-semibold" style={{ color: emphasize ? "#1A006E" : "#79747E" }}>{label}</div>
                  <div className="text-[10px] font-black" style={{ color: emphasize ? "#1A006E" : "#1C1B1F" }}>{amountLabelFromRupees(value)}</div>
                </div>
              ))}
            </div>
            <div className="h-40 flex items-end gap-1.5 pt-2">
              {allocationBucketStats.map(bucket => (
                <button
                  key={bucket.label}
                  onClick={() => setAllocationBucketFilter(allocationBucketFilter === bucket.label ? null : bucket.label)}
                  title={`${bucket.label}: ${bucket.projectCount} projects, ${bucket.percentage.toFixed(1)}%, ${amountLabelFromRupees(bucket.totalAllocation)}`}
                  className="flex-1 h-full flex flex-col justify-end items-center gap-1 md-ripple"
                >
                  <div className="text-[9px] font-semibold" style={{ color: allocationBucketFilter === bucket.label ? "#1A006E" : "#49454F" }}>{bucket.projectCount}</div>
                  <div
                    className="w-full rounded-t-xl"
                    style={{
                      height: `${Math.max(8, (bucket.projectCount / maxAllocationBucketCount) * 100)}%`,
                      background: allocationBucketFilter === bucket.label ? "#1A006E" : "#4F46E5",
                      opacity: bucket.projectCount ? 1 : 0.18,
                    }}
                  />
                  <div className="text-[8px] text-center leading-tight" style={{ color: "#49454F" }}>{bucket.label.replace("Rs ", "")}</div>
                </button>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 px-4 mt-4 overflow-x-auto pb-1">
        {filters.map(f => <Chip key={f} label={f} active={filter === f} onClick={() => setFilter(f)} />)}
      </div>

      {/* Risk Map card */}
      <div className="px-4 mt-4">
        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold" style={{ fontFamily: "'Google Sans', sans-serif", color: "#1C1B1F" }}>Risk Intelligence Map</div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full" style={{ background: "#ECE6F0", color: "#49454F" }}>Mumbai</span>
            </div>
            <RiskIntelligenceMap projects={filtered} onOpenAudit={onOpenAudit} />
          </div>
        </Card>
      </div>

      </>}

      {dashboardSection === "alerts" && <div className="px-4 mt-4 mb-4">
        {/* Alert Feed */}
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold" style={{ fontFamily: "'Google Sans', sans-serif", color: "#1C1B1F" }}>Live Alert Feed</div>
          <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "#E8E7FF", color: "#1A006E" }}>Mock data scored live</span>
        </div>
        {mockAlertsLoading && <Card><div className="p-8 text-center text-sm" style={{ color: "#49454F" }}>Scoring mock records...</div></Card>}
        {mockAlertError && <Card><div className="p-4 text-xs" style={{ color: "#B3261E" }}>{mockAlertError}</div></Card>}
        {!mockAlertsLoading && !mockAlertError && (
          <div className="max-h-[68vh] overflow-y-auto pr-1 space-y-4">
            {alertGroups.map(section => (
              <Card key={section.key}>
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-black" style={{ color: section.text }}>{section.title}</div>
                      <div className="text-[10px]" style={{ color: "#49454F" }}>{section.caption}</div>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-1 rounded-full" style={{ background: section.bg, color: section.text }}>
                      {section.projects.length}
                    </span>
                  </div>

                  <div className="max-h-80 overflow-y-auto pr-1 space-y-2">
                    {section.projects.length === 0 ? (
                      <div className="rounded-2xl p-4 text-xs text-center" style={{ background: "#F3F0F9", color: "#49454F" }}>
                        No {section.title.toLowerCase()} mock cases.
                      </div>
                    ) : section.projects.map(p => (
                      <div key={p.id} className="rounded-2xl p-3" style={{ background: "#F3F0F9" }}>
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 text-sm font-black" style={{ background: riskColor(p.risk).bg, color: riskColor(p.risk).dot }}>
                            {p.risk}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold truncate" style={{ color: "#1C1B1F" }}>{p.title}</span>
                              <RiskChip status={p.status} />
                            </div>
                            <div className="text-[10px] font-mono mt-0.5" style={{ color: "#79747E" }}>{p.id}</div>
                            <div className="text-xs mt-0.5" style={{ color: "#49454F" }}>{p.amount} · {p.anomaly}</div>
                          </div>
                        </div>
                        <button
                          onClick={() => onOpenAudit(p)}
                          className="mt-3 w-full h-9 rounded-2xl text-xs font-semibold md-ripple transition-colors"
                          style={{ background: "#E8E7FF", color: "#1A006E" }}
                        >
                          Inspect AI Audit
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>}
    </div>
  );
}

const MemoizedHomeScreen = memo(HomeScreen);

export { MemoizedHomeScreen as HomeScreen };
