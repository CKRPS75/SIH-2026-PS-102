import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Project } from "../../data/projects";
import { riskColor } from "../../utils/helpers";

// ── Fixed Mumbai Hotspot Coordinates for Dashboard Risk Intelligence ─────────

const MUMBAI_HOTSPOTS: Array<[number, number]> = [
  [19.0726, 72.8845], // Kurla
  [19.1136, 72.8697], // Andheri
  [19.0522, 72.8995], // Chembur
  [19.0402, 72.8509], // Dharavi
  [19.0596, 72.8295], // Bandra
  [19.086, 72.909], // Ghatkopar
  [19.0178, 72.8478], // Dadar
  [19.0166, 72.8154], // Worli
  [19.1726, 72.8500], // Goregaon
  [19.2307, 72.8567], // Borivali
];

function createPinIcon(color: string) {
  return L.divIcon({
    className: "leaflet-risk-pin",
    html: `
      <div style="
        width: 18px;
        height: 18px;
        background: ${color};
        border: 2.5px solid #FFFFFF;
        border-radius: 50%;
        box-shadow: 0 2px 6px rgba(0,0,0,0.4);
        cursor: pointer;
        transition: transform 0.15s ease;
      "></div>
    `,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -10],
  });
}

function MapResizeController() {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 200);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
}

interface RiskIntelligenceMapProps {
  projects: Project[];
  onOpenAudit: (project: Project) => void;
}

export function RiskIntelligenceMap({ projects, onOpenAudit }: RiskIntelligenceMapProps) {
  const displayProjects = useMemo(() => projects.slice(0, 8), [projects]);

  return (
    <div className="relative rounded-2xl overflow-hidden shadow-sm" style={{ height: 180, background: "#0F172A" }}>
      <MapContainer
        center={[19.076, 72.8777]}
        zoom={11}
        scrollWheelZoom={false}
        attributionControl={false}
        zoomControl={false}
        style={{ height: "100%", width: "100%", zIndex: 1 }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        <MapResizeController />

        {displayProjects.map((p, index) => {
          const coords = MUMBAI_HOTSPOTS[index % MUMBAI_HOTSPOTS.length];
          const pinColor = riskColor(p.risk).dot;

          return (
            <Marker key={p.id} position={coords} icon={createPinIcon(pinColor)}>
              <Popup>
                <div style={{ padding: "3px", minWidth: "150px", maxWidth: "200px" }}>
                  <div style={{ fontSize: "9px", fontFamily: "monospace", color: "#79747E", marginBottom: "2px" }}>
                    {p.id}
                  </div>
                  <div style={{ fontSize: "11px", fontWeight: "bold", color: "#1C1B1F", lineHeight: 1.3, marginBottom: "3px" }}>
                    {p.title}
                  </div>
                  <div style={{ fontSize: "10px", color: "#49454F", marginBottom: "4px" }}>
                    {p.amount} · Risk: {p.risk}/100
                  </div>
                  <button
                    onClick={() => onOpenAudit(p)}
                    style={{
                      width: "100%",
                      padding: "4px 8px",
                      background: "#4F46E5",
                      color: "#FFFFFF",
                      fontSize: "10px",
                      fontWeight: "bold",
                      borderRadius: "6px",
                      border: "none",
                      cursor: "pointer",
                      marginTop: "2px",
                    }}
                  >
                    Inspect Audit Case
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Legend Overlay */}
      <div
        className="absolute bottom-2 left-2 z-[1000] flex gap-2 rounded-xl px-2.5 py-1.5 pointer-events-none"
        style={{ background: "rgba(15,23,42,0.85)", backdropFilter: "blur(4px)" }}
      >
        {[
          ["#10B981", "Safe"],
          ["#F59E0B", "Review"],
          ["#B3261E", "High"],
        ].map(([c, l]) => (
          <div key={l} className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ background: c }} />
            <span className="text-[9px] font-medium" style={{ color: "rgba(255,255,255,0.8)" }}>
              {l}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default RiskIntelligenceMap;

