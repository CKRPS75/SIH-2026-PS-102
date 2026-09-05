// ── Auth / User Data ──────────────────────────────────────────────────────────
// Isolated mock auth layer — swap out for real backend later.

const AUTH_KEY = "mplads-auth";
const PREFS_KEY = "mplads-preferences";
const LOGS_KEY = "mplads-audit-logs";
const READ_NOTIFICATIONS_KEY = "mplads-read-notifications";

export type OfficerProfile = {
  name: string;
  email: string;
  officerId: string;
  department: string;
  role: string;
  status: string;
  lastLogin: string;
};

export type Preferences = {
  theme: "light" | "dark" | "system";
  notifAuditAlerts: boolean;
  notifHighRisk: boolean;
  notifFieldAudit: boolean;
  notifSystem: boolean;
  riskThreshold: number;
  auditSensitivity: "low" | "medium" | "high";
};

export type AuditLogEntry = {
  id: string;
  date: string;
  time: string;
  action: string;
  projectId?: string;
  projectName?: string;
  riskLevel?: "HIGH RISK" | "REVIEW" | "VERIFIED" | null;
  officer: string;
  status: "Success" | "Failed" | "Pending";
};

const DEFAULT_PROFILE: OfficerProfile = {
  name: "Government Officer",
  email: "gov.officer@mplads.gov.in",
  officerId: "MPLADS-OFF-204",
  department: "Ministry of Statistics & Programme Implementation",
  role: "MPLADS Audit Officer",
  status: "Active",
  lastLogin: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
};

const DEFAULT_PREFS: Preferences = {
  theme: "light",
  notifAuditAlerts: true,
  notifHighRisk: true,
  notifFieldAudit: true,
  notifSystem: false,
  riskThreshold: 60,
  auditSensitivity: "medium",
};

let systemThemeQuery: MediaQueryList | null = null;
let systemThemeListener: ((event: MediaQueryListEvent) => void) | null = null;

function getEffectiveTheme(theme: Preferences["theme"]): "light" | "dark" {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return theme;
}

export function applyTheme(theme: Preferences["theme"]): void {
  const root = document.documentElement;
  const setTheme = (preference: Preferences["theme"]) => {
    root.dataset.themePreference = preference;
    root.dataset.theme = getEffectiveTheme(preference);
    root.style.colorScheme = getEffectiveTheme(preference);
  };

  if (systemThemeQuery && systemThemeListener) {
    systemThemeQuery.removeEventListener("change", systemThemeListener);
  }
  systemThemeQuery = null;
  systemThemeListener = null;

  setTheme(theme);
  if (theme === "system") {
    systemThemeQuery = window.matchMedia("(prefers-color-scheme: dark)");
    systemThemeListener = () => setTheme("system");
    systemThemeQuery.addEventListener("change", systemThemeListener);
  }
}

const SEED_LOGS: AuditLogEntry[] = [
  { id: "L001", date: "2026-08-29", time: "14:32", action: "User signed in", officer: "MPLADS-OFF-204", status: "Success" },
  { id: "L002", date: "2026-08-29", time: "14:35", action: "Risk assessment viewed", projectId: "TEST-0001", projectName: "Improvement of electricity distribution infrastructure", riskLevel: "HIGH RISK", officer: "MPLADS-OFF-204", status: "Success" },
  { id: "L003", date: "2026-08-29", time: "14:40", action: "Field Audit opened", projectId: "TEST-0001", projectName: "Improvement of electricity distribution infrastructure", riskLevel: "HIGH RISK", officer: "MPLADS-OFF-204", status: "Success" },
  { id: "L004", date: "2026-08-29", time: "15:10", action: "Project evaluated", projectId: "TEST-0002", projectName: "Road construction and widening", riskLevel: "REVIEW", officer: "MPLADS-OFF-204", status: "Success" },
  { id: "L005", date: "2026-08-29", time: "15:45", action: "Field Audit completed", projectId: "TEST-0001", projectName: "Improvement of electricity distribution infrastructure", riskLevel: "HIGH RISK", officer: "MPLADS-OFF-204", status: "Success" },
  { id: "L006", date: "2026-08-28", time: "10:00", action: "User signed in", officer: "MPLADS-OFF-204", status: "Success" },
  { id: "L007", date: "2026-08-28", time: "10:05", action: "Risk assessment viewed", projectId: "TEST-0003", projectName: "Construction of community hall", riskLevel: "VERIFIED", officer: "MPLADS-OFF-204", status: "Success" },
  { id: "L008", date: "2026-08-28", time: "10:30", action: "Project flagged", projectId: "TEST-0004", projectName: "Drinking water supply scheme", riskLevel: "HIGH RISK", officer: "MPLADS-OFF-204", status: "Success" },
  { id: "L009", date: "2026-08-28", time: "11:00", action: "Project approved", projectId: "TEST-0003", projectName: "Construction of community hall", riskLevel: "VERIFIED", officer: "MPLADS-OFF-204", status: "Success" },
  { id: "L010", date: "2026-08-27", time: "09:15", action: "User signed in", officer: "MPLADS-OFF-204", status: "Success" },
  { id: "L011", date: "2026-08-27", time: "09:20", action: "Site evidence captured", projectId: "TEST-0005", projectName: "Solar street light installation", riskLevel: "REVIEW", officer: "MPLADS-OFF-204", status: "Success" },
  { id: "L012", date: "2026-08-27", time: "10:00", action: "Project rejected", projectId: "TEST-0006", projectName: "Construction of parking area", riskLevel: "HIGH RISK", officer: "MPLADS-OFF-204", status: "Success" },
  { id: "L013", date: "2026-08-26", time: "14:00", action: "User signed in", officer: "MPLADS-OFF-204", status: "Success" },
  { id: "L014", date: "2026-08-26", time: "14:30", action: "Preferences updated", officer: "MPLADS-OFF-204", status: "Success" },
  { id: "L015", date: "2026-08-25", time: "11:00", action: "User signed out", officer: "MPLADS-OFF-204", status: "Success" },
];

// ── Auth functions ────────────────────────────────────────────────────────────

export function isSignedIn(): boolean {
  return window.localStorage.getItem(AUTH_KEY) === "true";
}

export function signIn(email: string, _password: string): boolean {
  // In production, validate against real backend
  if (email && _password.length >= 4) {
    window.localStorage.setItem(AUTH_KEY, "true");
    addLog({ action: "User signed in", status: "Success" });
    return true;
  }
  return false;
}

export function signOut(): void {
  addLog({ action: "User signed out", status: "Success" });
  window.localStorage.removeItem(AUTH_KEY);
}

// ── Profile functions ─────────────────────────────────────────────────────────

export function getProfile(): OfficerProfile {
  try {
    const stored = window.localStorage.getItem("mplads-profile");
    return stored ? { ...DEFAULT_PROFILE, ...(JSON.parse(stored) as Partial<OfficerProfile>) } : DEFAULT_PROFILE;
  } catch {
    return DEFAULT_PROFILE;
  }
}

export function saveProfile(updates: Partial<OfficerProfile>): void {
  const current = getProfile();
  const updated = { ...current, ...updates };
  window.localStorage.setItem("mplads-profile", JSON.stringify(updated));
  addLog({ action: "Profile updated", status: "Success" });
}

// ── Preferences functions ─────────────────────────────────────────────────────

export function getPreferences(): Preferences {
  try {
    const stored = window.localStorage.getItem(PREFS_KEY);
    return stored ? { ...DEFAULT_PREFS, ...(JSON.parse(stored) as Partial<Preferences>) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePreferences(prefs: Preferences): void {
  window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  applyTheme(prefs.theme);
  addLog({ action: "Preferences updated", status: "Success" });
}

export function resetPreferences(): void {
  window.localStorage.setItem(PREFS_KEY, JSON.stringify(DEFAULT_PREFS));
  applyTheme(DEFAULT_PREFS.theme);
  addLog({ action: "Preferences reset to default", status: "Success" });
}

// ── Audit Log functions ───────────────────────────────────────────────────────

export function getLogs(): AuditLogEntry[] {
  try {
    const stored = window.localStorage.getItem(LOGS_KEY);
    return stored ? (JSON.parse(stored) as AuditLogEntry[]) : SEED_LOGS;
  } catch {
    return SEED_LOGS;
  }
}

export function getReadNotificationIds(): string[] {
  try {
    const stored = window.localStorage.getItem(READ_NOTIFICATIONS_KEY);
    return stored ? JSON.parse(stored) as string[] : [];
  } catch {
    return [];
  }
}

export function markNotificationsRead(ids: string[]): void {
  const current = new Set(getReadNotificationIds());
  ids.forEach(id => current.add(id));
  window.localStorage.setItem(READ_NOTIFICATIONS_KEY, JSON.stringify([...current]));
}

function addLog(entry: Omit<AuditLogEntry, "id" | "date" | "time" | "officer">): void {
  try {
    const logs = getLogs();
    const now = new Date();
    const newEntry: AuditLogEntry = {
      id: `L${Date.now()}`,
      date: now.toISOString().split("T")[0],
      time: now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false }),
      officer: "MPLADS-OFF-204",
      ...entry,
    };
    window.localStorage.setItem(LOGS_KEY, JSON.stringify([newEntry, ...logs]));
  } catch {
    // silently ignore
  }
}

