// ── MD3 Color tokens ─────────────────────────────────────────────────────────
// Primary: Indigo #4F46E5
// Surface: #FFFBFE
// Surface Container: #F3F0F9
// Surface Container High: #ECE6F0
// On Surface: #1C1B1F
// On Surface Variant: #49454F
// Outline: #79747E
// Error: #B3261E

// ── Data ─────────────────────────────────────────────────────────────────────

const PROJECTS = [
  { id:"MPLADS-2026-TRAP-001", short:"TRAP-001", title:"Community Hall Kurla", location:"Kurla, Mumbai", district:"Mumbai Suburban", constituency:"Kurla", amount:"₹15.0L", amountNum:15.0, bsr:"₹8.0L", bsrNum:8.0, risk:88, status:"HIGH RISK" as const, anomaly:"Duplicate", contractor:"M/s Sharma Constructions", agency:"MCGM", coords:"19.0728° N, 72.8826° E", submitted:"12 Aug 2026", description:"Construction of Community Hall at Kurla West for public gatherings and cultural events." },
  { id:"MPLADS-2026-TRAP-002", short:"TRAP-002", title:"Samaj Bhavan Kurla", location:"Kurla, Mumbai", district:"Mumbai Suburban", constituency:"Kurla", amount:"₹15.5L", amountNum:15.5, bsr:"₹8.0L", bsrNum:8.0, risk:85, status:"HIGH RISK" as const, anomaly:"Duplicate", contractor:"M/s Sharma Constructions", agency:"MCGM", coords:"19.0730° N, 72.8828° E", submitted:"14 Aug 2026", description:"Construction of Community Hall at Kurla East for public gatherings and social functions." },
  { id:"MPLADS-2026-TRAP-003", short:"TRAP-003", title:"Solar Street Lights Chembur", location:"Chembur, Mumbai", district:"Mumbai Suburban", constituency:"Chembur", amount:"₹35.0L", amountNum:35.0, bsr:"₹8.0L", bsrNum:8.0, risk:92, status:"HIGH RISK" as const, anomaly:"Overpricing", contractor:"M/s Sunlight Infra Ltd", agency:"MSEDCL", coords:"19.0622° N, 72.9005° E", submitted:"10 Aug 2026", description:"Installation of 80 solar-powered street lights along main roads in Chembur district." },
  { id:"MPLADS-2026-TRAP-004", short:"TRAP-004", title:"Paver Block Footpath Ph 1", location:"Ghatkopar, Mumbai", district:"Mumbai Suburban", constituency:"Ghatkopar", amount:"₹4.9L", amountNum:4.9, bsr:"₹3.2L", bsrNum:3.2, risk:58, status:"REVIEW" as const, anomaly:"Split Sanction", contractor:"M/s Patel Infra", agency:"BMC Ward L", coords:"19.0860° N, 72.9081° E", submitted:"18 Aug 2026", description:"Laying of interlocking paver blocks on footpaths along Station Road Phase 1." },
  { id:"MPLADS-2026-BASE-001", short:"BASE-001", title:"RO Water Purification Plant", location:"Dharavi, Mumbai", district:"Mumbai City", constituency:"Sion-Koliwada", amount:"₹4.5L", amountNum:4.5, bsr:"₹5.0L", bsrNum:5.0, risk:12, status:"VERIFIED" as const, anomaly:"None", contractor:"M/s AquaTech Solutions", agency:"MCGM", coords:"19.0378° N, 72.8562° E", submitted:"5 Aug 2026", description:"Installation of RO water purification plant for 500 households." },
  { id:"MPLADS-2026-BASE-002", short:"BASE-002", title:"Asphalt Road Resurfacing", location:"Andheri, Mumbai", district:"Mumbai Suburban", constituency:"Andheri East", amount:"₹18.0L", amountNum:18.0, bsr:"₹20.0L", bsrNum:20.0, risk:18, status:"VERIFIED" as const, anomaly:"None", contractor:"M/s Roadworks Maharashtra", agency:"PWD Maharashtra", coords:"19.1136° N, 72.8697° E", submitted:"2 Aug 2026", description:"Resurfacing of 2.4km arterial road with polymer-modified bitumen macadam." },
];

type Project = (typeof PROJECTS)[number];
type Tab = "home" | "audits" | "judge" | "field";
type Filter = "All" | "Duplicates" | "Overpricing" | "Split Sanctions";

export { PROJECTS };
export type { Project, Tab, Filter };
