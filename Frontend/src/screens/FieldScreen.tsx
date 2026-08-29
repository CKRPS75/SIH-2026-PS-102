import { useMemo, useState } from "react";
import { Card } from "../components/common/Card";
import type { Project } from "../data/projects";

// ── Field Screen ──────────────────────────────────────────────────────────────

type FieldState = "project" | "camera" | "captured" | "exif" | "verified" | "pfms";

function FieldScreen({ assignments }: { assignments: Project[] }) {
  const [state, setState] = useState<FieldState>("project");
  const [exifStep, setExifStep] = useState(0);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(assignments[0]?.id ?? null);

  const selectedProject = useMemo(() => {
    return assignments.find(project => project.id === selectedProjectId) ?? assignments[0] ?? null;
  }, [assignments, selectedProjectId]);

  const exifSteps = ["GPS Coordinates", "Timestamp", "Device ID", "Image Integrity"];

  function handleBeginVerification(project: Project) {
    setSelectedProjectId(project.id);
    setExifStep(0);
    setState("camera");
  }

  function handleExtract() {
    setState("exif");
    let step = 0;
    const interval = window.setInterval(() => {
      step += 1;
      setExifStep(step);
      if (step >= exifSteps.length) {
        window.clearInterval(interval);
        window.setTimeout(() => setState("verified"), 600);
      }
    }, 500);
  }

  function resetToQueue() {
    setExifStep(0);
    setState("project");
  }

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: "#F3F0F9" }}>
      <div className="px-4 pt-2 pb-4">
        <div className="text-xs font-medium" style={{ color: "#49454F" }}>MPLADS AI-GUARDIAN</div>
        <div className="text-2xl font-semibold" style={{ fontFamily: "'Google Sans Display', sans-serif", color: "#1C1B1F" }}>Field Inspector</div>
        <div className="text-xs mt-1" style={{ color: "#79747E" }}>{assignments.length} assigned field {assignments.length === 1 ? "case" : "cases"}</div>
      </div>

      {state === "project" && (
        <div className="px-4 space-y-3 animate-scale-in">
          {assignments.length === 0 && (
            <Card>
              <div className="p-6 text-center space-y-2">
                <div className="text-sm font-semibold" style={{ color: "#1C1B1F" }}>No Field Cases Assigned</div>
                <div className="text-xs leading-relaxed" style={{ color: "#49454F" }}>
                  Open an AI Audit case and click Field Audit to add it to this queue.
                </div>
              </div>
            </Card>
          )}

          {assignments.map(project => (
            <Card key={project.id}>
              <div className="p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ background: project.status === "HIGH RISK" ? "#FFDAD6" : "#FFEFD6" }}>
                    <span className="text-lg font-black" style={{ color: project.status === "HIGH RISK" ? "#B3261E" : "#7C4F00" }}>{project.risk}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate" style={{ color: "#1C1B1F" }}>{project.title}</div>
                    <div className="text-[10px] font-mono" style={{ color: "#79747E" }}>{project.id}</div>
                  </div>
                </div>
                <div className="h-px" style={{ background: "#ECE6F0" }} />
                {[
                  { l: "Location", v: project.location },
                  { l: "Constituency", v: project.constituency },
                  { l: "Amount", v: project.amount },
                  { l: "Agency", v: project.agency },
                  { l: "Anomaly", v: project.anomaly },
                ].map(row => (
                  <div key={row.l} className="flex items-start justify-between gap-2">
                    <span className="text-[10px] font-medium shrink-0" style={{ color: "#79747E" }}>{row.l}</span>
                    <span className="text-xs font-medium text-right" style={{ color: "#1C1B1F" }}>{row.v}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full" style={{ background: "#FFEFD6", color: "#7C4F00" }}>Awaiting Field Verification</span>
                  <button onClick={() => handleBeginVerification(project)} className="h-9 px-4 rounded-full text-xs font-semibold text-white md-ripple" style={{ background: "#4F46E5" }}>
                    Begin
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {state !== "project" && !selectedProject && (
        <div className="px-4">
          <Card>
            <div className="p-6 text-center text-sm" style={{ color: "#49454F" }}>No field case selected.</div>
          </Card>
        </div>
      )}

      {state === "camera" && selectedProject && (
        <div className="px-4 space-y-4 animate-scale-in">
          <button onClick={resetToQueue} className="flex items-center gap-2 text-sm font-medium" style={{ color: "#4F46E5" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
            Back to queue
          </button>
          <Card>
            <div className="p-4">
              <div className="text-[10px] font-mono" style={{ color: "#79747E" }}>{selectedProject.id}</div>
              <div className="text-sm font-semibold mt-1" style={{ color: "#1C1B1F" }}>{selectedProject.title}</div>
              <div className="text-xs mt-1" style={{ color: "#49454F" }}>{selectedProject.location}</div>
            </div>
          </Card>
          <div className="rounded-3xl overflow-hidden" style={{ background: "#1C1B1F", height: 280 }}>
            <div className="h-full flex flex-col items-center justify-center gap-4">
              <div className="w-24 h-24 rounded-full flex items-center justify-center" style={{ border: "2px dashed #49454F" }}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="#49454F">
                  <path d="M12 15.2a3.2 3.2 0 100-6.4 3.2 3.2 0 000 6.4z"/>
                  <path d="M9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/>
                </svg>
              </div>
              <div className="text-sm font-semibold" style={{ color: "#FFFBFE" }}>Capture Site Evidence</div>
              <div className="text-xs" style={{ color: "#79747E" }}>Point camera at the approved project site</div>
            </div>
          </div>
          <button onClick={() => setState("captured")} className="w-full h-14 rounded-3xl text-sm font-semibold text-white md-ripple" style={{ background: "#4F46E5" }}>
            Take Photo
          </button>
        </div>
      )}

      {state === "captured" && selectedProject && (
        <div className="px-4 space-y-4 animate-scale-in">
          <Card>
            <div className="p-4">
              <div className="text-[10px] font-mono" style={{ color: "#79747E" }}>{selectedProject.id}</div>
              <div className="text-sm font-semibold mt-1" style={{ color: "#1C1B1F" }}>{selectedProject.title}</div>
            </div>
          </Card>
          <div className="rounded-3xl overflow-hidden" style={{ background: "#1C1B1F", height: 240 }}>
            <div className="h-full flex flex-col items-center justify-center gap-3">
              <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl" style={{ background: "#006C4C", color: "#FFFFFF" }}>✓</div>
              <div className="text-sm font-semibold" style={{ color: "#10B981" }}>Photo Captured</div>
              <div className="text-xs" style={{ color: "#79747E" }}>Field evidence ready for metadata extraction</div>
            </div>
          </div>
          <button onClick={handleExtract} className="w-full h-14 rounded-3xl text-sm font-semibold text-white md-ripple" style={{ background: "#4F46E5" }}>
            Extract EXIF Metadata
          </button>
        </div>
      )}

      {state === "exif" && selectedProject && (
        <div className="px-4 space-y-4 animate-fade-in">
          <Card>
            <div className="p-5">
              <div className="text-[10px] font-mono mb-1" style={{ color: "#79747E" }}>{selectedProject.id}</div>
              <div className="text-sm font-semibold mb-4" style={{ color: "#1C1B1F" }}>Extracting Metadata...</div>
              <div className="space-y-3">
                {exifSteps.map((step, index) => (
                  <div key={step} className="flex items-center gap-3 text-sm transition-all" style={{ color: index < exifStep ? "#006C4C" : "#CAC4D0" }}>
                    <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: index < exifStep ? "#D4F8E8" : "#ECE6F0" }}>
                      <span className="text-xs font-bold" style={{ color: index < exifStep ? "#006C4C" : "#CAC4D0" }}>{index < exifStep ? "✓" : index + 1}</span>
                    </div>
                    {step}
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      )}

      {state === "verified" && selectedProject && (
        <div className="px-4 space-y-3 animate-scale-in">
          <div className="rounded-3xl p-5" style={{ background: "#D4F8E8" }}>
            <div className="text-center mb-4">
              <div className="text-base font-bold" style={{ color: "#006C4C" }}>EXIF Location Verified</div>
              <div className="text-xs mt-1" style={{ color: "#49454F" }}>{selectedProject.location}</div>
              <span className="inline-block mt-2 text-[10px] font-bold px-3 py-1 rounded-full" style={{ background: "#006C4C", color: "#FFFFFF" }}>VERIFIED</span>
            </div>
          </div>
          <Card>
            <div className="p-4 space-y-2 font-mono">
              {[
                { l: "Project", v: selectedProject.id, vColor: "#4F46E5" },
                { l: "Approved", v: selectedProject.coords, vColor: "#1C1B1F" },
                { l: "Distance", v: "Within accepted site radius", vColor: "#006C4C" },
                { l: "Device", v: "FIELD-DEVICE-204", vColor: "#1C1B1F" },
              ].map(row => (
                <div key={row.l} className="flex justify-between gap-3">
                  <span className="text-[10px]" style={{ color: "#79747E" }}>{row.l}</span>
                  <span className="text-[10px] font-semibold text-right" style={{ color: row.vColor }}>{row.v}</span>
                </div>
              ))}
            </div>
          </Card>
          <button onClick={() => setState("pfms")} className="w-full h-14 rounded-3xl text-sm font-semibold text-white md-ripple" style={{ background: "#006C4C" }}>
            Verify & Trigger PFMS Payment Release
          </button>
        </div>
      )}

      {state === "pfms" && selectedProject && (
        <div className="px-4 space-y-4 animate-scale-in">
          <div className="rounded-3xl p-8 text-center" style={{ background: "#D4F8E8" }}>
            <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center text-2xl" style={{ background: "#006C4C", color: "#FFFFFF" }}>✓</div>
            <div className="text-base font-bold mb-1" style={{ color: "#006C4C" }}>Verification Complete</div>
            <div className="text-sm font-semibold" style={{ color: "#1C1B1F" }}>{selectedProject.id}</div>
            <div className="text-xs mt-1" style={{ color: "#49454F" }}>PFMS payment release triggered for the selected field case.</div>
          </div>
          <Card>
            <div className="p-4 space-y-2 font-mono">
              {[
                { l: "Reference", v: `PFMS-${selectedProject.short}`, vc: "#4F46E5" },
                { l: "Amount", v: selectedProject.amount, vc: "#1C1B1F" },
                { l: "Status", v: "RELEASED", vc: "#006C4C" },
                { l: "Project", v: selectedProject.id, vc: "#1C1B1F" },
              ].map(row => (
                <div key={row.l} className="flex justify-between gap-3">
                  <span className="text-[10px]" style={{ color: "#79747E" }}>{row.l}</span>
                  <span className="text-[10px] font-bold text-right" style={{ color: row.vc }}>{row.v}</span>
                </div>
              ))}
            </div>
          </Card>
          <button onClick={resetToQueue} className="w-full h-12 rounded-3xl text-sm font-medium md-ripple" style={{ background: "#ECE6F0", color: "#1C1B1F" }}>
            Back to Field Queue
          </button>
        </div>
      )}
    </div>
  );
}

export { FieldScreen };
