import { useState } from "react";
import { Card } from "../components/common/Card";

// ── Field Screen ──────────────────────────────────────────────────────────────

type FieldState = "project" | "camera" | "captured" | "exif" | "verified" | "pfms";

function FieldScreen() {
  const [state, setState] = useState<FieldState>("project");
  const [exifStep, setExifStep] = useState(0);

  const exifSteps = ["GPS Coordinates", "Timestamp", "Device ID", "Image Integrity"];

  function handleExtract() {
    setState("exif");
    let s = 0;
    const iv = setInterval(() => { s++; setExifStep(s); if (s >= exifSteps.length) { clearInterval(iv); setTimeout(() => setState("verified"), 600); } }, 500);
  }

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: "#F3F0F9" }}>
      <div className="px-4 pt-2 pb-4">
        <div className="text-xs font-medium" style={{ color: "#49454F" }}>MPLADS AI-GUARDIAN</div>
        <div className="text-2xl font-semibold" style={{ fontFamily: "'Google Sans Display', sans-serif", color: "#1C1B1F" }}>Field Inspector</div>
      </div>

      {state === "project" && (
        <div className="px-4 space-y-3 animate-scale-in">
          <Card>
            <div className="p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "#FFDAD6" }}>
                  <span className="text-lg font-black" style={{ color: "#B3261E" }}>88</span>
                </div>
                <div>
                  <div className="font-semibold text-sm" style={{ color: "#1C1B1F" }}>Community Hall Kurla</div>
                  <div className="text-[10px] font-mono" style={{ color: "#79747E" }}>MPLADS-2026-TRAP-001</div>
                </div>
              </div>
              <div className="h-px" style={{ background: "#ECE6F0" }} />
              {[
                { l: "District", v: "Mumbai Suburban" },
                { l: "Approved Location", v: "19.0728° N, 72.8826° E" },
                { l: "Amount", v: "₹15.0L" },
                { l: "Contractor", v: "M/s Sharma Constructions" },
              ].map(r => (
                <div key={r.l} className="flex items-start justify-between gap-2">
                  <span className="text-[10px] font-medium shrink-0" style={{ color: "#79747E" }}>{r.l}</span>
                  <span className="text-xs font-medium text-right" style={{ color: "#1C1B1F" }}>{r.v}</span>
                </div>
              ))}
              <div className="pt-1">
                <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full" style={{ background: "#FFEFD6", color: "#7C4F00" }}>Awaiting Field Verification</span>
              </div>
            </div>
          </Card>
          <button onClick={() => setState("camera")} className="w-full h-14 rounded-3xl text-sm font-semibold text-white md-ripple" style={{ background: "#4F46E5" }}>
            Begin Verification
          </button>
        </div>
      )}

      {state === "camera" && (
        <div className="px-4 space-y-4 animate-scale-in">
          <button onClick={() => setState("project")} className="flex items-center gap-2 text-sm font-medium" style={{ color: "#4F46E5" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
            Back
          </button>
          <div className="rounded-3xl overflow-hidden" style={{ background: "#1C1B1F", height: 280 }}>
            <div className="h-full flex flex-col items-center justify-center gap-4">
              <div className="w-24 h-24 rounded-full flex items-center justify-center" style={{ border: "2px dashed #49454F" }}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="#49454F">
                  <path d="M12 15.2a3.2 3.2 0 100-6.4 3.2 3.2 0 000 6.4z"/>
                  <path d="M9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/>
                </svg>
              </div>
              <div className="text-sm font-semibold" style={{ color: "#FFFBFE" }}>Capture Site Evidence</div>
              <div className="text-xs" style={{ color: "#79747E" }}>Point camera at the project site</div>
            </div>
          </div>
          <button onClick={() => setState("captured")} className="w-full h-14 rounded-3xl text-sm font-semibold text-white md-ripple" style={{ background: "#4F46E5" }}>
            Take Photo
          </button>
        </div>
      )}

      {state === "captured" && (
        <div className="px-4 space-y-4 animate-scale-in">
          <div className="rounded-3xl overflow-hidden" style={{ background: "#1C1B1F", height: 240 }}>
            <div className="h-full flex flex-col items-center justify-center gap-3">
              <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl" style={{ background: "#006C4C" }}>✓</div>
              <div className="text-sm font-semibold" style={{ color: "#10B981" }}>Photo Captured</div>
              <div className="text-xs" style={{ color: "#79747E" }}>28 Aug 2026 · 11:24 AM</div>
            </div>
          </div>
          <button onClick={handleExtract} className="w-full h-14 rounded-3xl text-sm font-semibold text-white md-ripple" style={{ background: "#4F46E5" }}>
            Extract EXIF Metadata
          </button>
        </div>
      )}

      {state === "exif" && (
        <div className="px-4 space-y-4 animate-fade-in">
          <Card>
            <div className="p-5">
              <div className="text-sm font-semibold mb-4" style={{ color: "#1C1B1F" }}>Extracting Metadata...</div>
              <div className="space-y-3">
                {exifSteps.map((s, i) => (
                  <div key={s} className="flex items-center gap-3 text-sm transition-all" style={{ color: i < exifStep ? "#006C4C" : "#CAC4D0" }}>
                    <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: i < exifStep ? "#D4F8E8" : "#ECE6F0" }}>
                      <span className="text-xs font-bold" style={{ color: i < exifStep ? "#006C4C" : "#CAC4D0" }}>{i < exifStep ? "✓" : i + 1}</span>
                    </div>
                    {s}
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      )}

      {state === "verified" && (
        <div className="px-4 space-y-3 animate-scale-in">
          <div className="rounded-3xl p-5" style={{ background: "#D4F8E8" }}>
            <div className="text-center mb-4">
              <div className="text-3xl mb-2">🟢</div>
              <div className="text-base font-bold" style={{ color: "#006C4C" }}>EXIF Location Verified</div>
              <div className="text-xs mt-1" style={{ color: "#49454F" }}>Coordinates match approved site within 12m.</div>
              <span className="inline-block mt-2 text-[10px] font-bold px-3 py-1 rounded-full" style={{ background: "#006C4C", color: "#FFFFFF" }}>VERIFIED</span>
            </div>
          </div>
          <Card>
            <div className="p-4 space-y-2 font-mono">
              {[
                { l: "GPS", v: "19.0727° N · 72.8825° E", vColor: "#006C4C" },
                { l: "Distance", v: "12m from site", vColor: "#006C4C" },
                { l: "Timestamp", v: "28 Aug 2026, 11:24 AM", vColor: "#1C1B1F" },
                { l: "Device", v: "FIELD-DEVICE-204", vColor: "#1C1B1F" },
              ].map(r => (
                <div key={r.l} className="flex justify-between">
                  <span className="text-[10px]" style={{ color: "#79747E" }}>{r.l}</span>
                  <span className="text-[10px] font-semibold" style={{ color: r.vColor }}>{r.v}</span>
                </div>
              ))}
            </div>
          </Card>
          <button onClick={() => setState("pfms")} className="w-full h-14 rounded-3xl text-sm font-semibold text-white md-ripple" style={{ background: "#006C4C" }}>
            Verify & Trigger PFMS Payment Release
          </button>
        </div>
      )}

      {state === "pfms" && (
        <div className="px-4 space-y-4 animate-scale-in">
          <div className="rounded-3xl p-8 text-center" style={{ background: "#D4F8E8" }}>
            <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center text-2xl" style={{ background: "#006C4C" }}>✓</div>
            <div className="text-base font-bold mb-1" style={{ color: "#006C4C" }}>Verification Complete</div>
            <div className="text-sm font-semibold" style={{ color: "#1C1B1F" }}>PFMS Payment Release Triggered</div>
          </div>
          <Card>
            <div className="p-4 space-y-2 font-mono">
              {[
                { l: "Reference", v: "PFMS-2026-7823", vc: "#4F46E5" },
                { l: "Amount", v: "₹15.0L", vc: "#1C1B1F" },
                { l: "Status", v: "RELEASED", vc: "#006C4C" },
                { l: "Date", v: "28 Aug 2026", vc: "#1C1B1F" },
              ].map(r => (
                <div key={r.l} className="flex justify-between">
                  <span className="text-[10px]" style={{ color: "#79747E" }}>{r.l}</span>
                  <span className="text-[10px] font-bold" style={{ color: r.vc }}>{r.v}</span>
                </div>
              ))}
            </div>
          </Card>
          <button onClick={() => setState("project")} className="w-full h-12 rounded-3xl text-sm font-medium md-ripple" style={{ background: "#ECE6F0", color: "#1C1B1F" }}>
            New Verification
          </button>
        </div>
      )}
    </div>
  );
}

export { FieldScreen };
