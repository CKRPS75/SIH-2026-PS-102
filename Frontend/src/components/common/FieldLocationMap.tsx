import { useEffect, useState, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Project } from "../../data/projects";

// ── In-Memory Geocoding Cache & Fallback Coordinates ──────────────────────────

const KNOWN_COORDS: Record<string, [number, number]> = {
  barwani: [22.0368, 74.9032],
  ludhiana: [30.901, 75.8573],
  chikkamagaluru: [13.3153, 75.7754],
  chickmaglur: [13.3153, 75.7754],
  achabal: [33.6853, 75.2341],
  chittisinghpora: [33.7122, 75.2156],
  anantnag: [33.7311, 75.1487],
  bhavnagar: [21.7645, 72.1519],
  mahabubnagar: [16.7488, 77.9942],
  mahbubnagar: [16.7488, 77.9942],
  chhindwara: [22.0574, 78.9382],
  domchanch: [24.4667, 85.6833],
  kodarma: [24.4667, 85.6833],
  bakhtiyarpur: [25.4542, 85.5322],
  patna: [25.5941, 85.1376],
  sambalpur: [21.4669, 83.9812],
  berhampur: [19.3149, 84.7941],
  ganjam: [19.3804, 85.0504],
  bhawanipatna: [19.9075, 83.1759],
  kalahandi: [19.9075, 83.1759],
  dhanbad: [23.7957, 86.4304],
  bhimtal: [29.35, 79.55],
  nainital: [29.3919, 79.4542],
  baidyabati: [22.7933, 88.3243],
  hooghly: [22.8963, 88.3846],
  bayana: [26.9011, 77.2917],
  bharatpur: [27.217, 77.49],
  bhagalpur: [25.2425, 86.9842],
  mathura: [27.4924, 77.6737],
  dhaulpur: [26.7025, 77.8934],
  dholpur: [26.7025, 77.8934],
  bhojpur: [28.8386, 78.7733],
  moradabad: [28.8386, 78.7733],
  athni: [16.73, 75.06],
  belagavi: [15.8497, 74.4977],
  ashmuqam: [33.8642, 75.2675],
  aishmuqam: [33.8642, 75.2675],
  arani: [12.67, 79.28],
  tiruvannamalai: [12.2253, 79.0747],
  mandawa: [28.055, 75.1488],
  jhunjhunu: [28.1289, 75.3995],
  sidlaghatta: [13.39, 77.86],
  chickballapur: [13.4325, 77.7275],
  chikkaballapur: [13.4325, 77.7275],
  ghagga: [30.03, 76.15],
  patiala: [30.3398, 76.3869],
  katihar: [25.5398, 87.5724],
  purnea: [25.7771, 87.4753],
  mumbai: [19.076, 72.8777],
  kurla: [19.0726, 72.8845],
  andheri: [19.1136, 72.8697],
  chembur: [19.0522, 72.8995],
  dharavi: [19.0402, 72.8509],
  delhi: [28.6139, 77.209],
  bengaluru: [12.9716, 77.5946],
  bangalore: [12.9716, 77.5946],
  kolkata: [22.5726, 88.3639],
  chennai: [13.0827, 80.2707],
  hyderabad: [17.385, 78.4867],
  pune: [18.5204, 73.8567],
  ahmedabad: [23.0225, 72.5714],
  jaipur: [26.9124, 75.7873],
  lucknow: [26.8467, 80.9462],
  bhopal: [23.2599, 77.4126],
  chandigarh: [30.7333, 76.7794],
  ranchi: [23.3441, 85.3096],
  dehradun: [30.3165, 78.0322],
  srinagar: [34.0837, 74.7973],
  jammu: [32.7266, 74.857],
};

const geocodeCache = new Map<string, [number, number]>();

// ── Coordinate Parsing & Geocoding Helpers ────────────────────────────────────

function parseCoordinates(raw: string | undefined | null): [number, number] | null {
  if (!raw) return null;
  const cleaned = raw.trim();
  if (
    cleaned.toLowerCase().includes("not provided") ||
    cleaned.toLowerCase().includes("coordinates not") ||
    cleaned.length === 0
  ) {
    return null;
  }

  // Format: "19.0760, 72.8777" or "[19.076, 72.877]" or "19.0760 72.8777"
  const match = cleaned.match(/[-+]?([0-9]*\.[0-9]+|[0-9]+)[,\s]+[-+]?([0-9]*\.[0-9]+|[0-9]+)/);
  if (match) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return [lat, lng];
    }
  }
  return null;
}

function resolveKnownCoordinates(text: string): [number, number] | null {
  const lower = text.toLowerCase();
  for (const [key, coords] of Object.entries(KNOWN_COORDS)) {
    if (lower.includes(key)) {
      return coords;
    }
  }
  return null;
}

async function geocodeLocation(query: string, signal: AbortSignal): Promise<[number, number] | null> {
  if (geocodeCache.has(query)) {
    return geocodeCache.get(query)!;
  }

  const known = resolveKnownCoordinates(query);
  if (known) {
    geocodeCache.set(query, known);
    return known;
  }

  const clean = query
    .replace(/Ward\s+[^\s,]+/gi, "")
    .replace(/Sitting\s+Rajya\s+Sabha/gi, "")
    .replace(/Municipal\s+Committee/gi, "")
    .trim();

  const searchTerm = clean.length > 2 ? `${clean}, India` : "India";
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchTerm)}&limit=1`;

  try {
    const res = await fetch(url, {
      signal,
      headers: { "Accept-Language": "en" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0 && data[0]?.lat && data[0]?.lon) {
      const lat = parseFloat(data[0].lat);
      const lon = parseFloat(data[0].lon);
      if (!isNaN(lat) && !isNaN(lon)) {
        const coords: [number, number] = [lat, lon];
        geocodeCache.set(query, coords);
        return coords;
      }
    }
  } catch {
    return null;
  }
  return null;
}

// ── Map Controller for Dynamic Re-centering ───────────────────────────────────

function MapController({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 13, { animate: true });
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 150);
    return () => clearTimeout(timer);
  }, [center, map]);
  return null;
}

// ── Custom SVG Marker Icon ────────────────────────────────────────────────────

function createMarkerIcon(color = "#4F46E5") {
  return L.divIcon({
    className: "leaflet-custom-marker",
    html: `
      <div style="position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="${color}" style="filter: drop-shadow(0 2px 5px rgba(0,0,0,0.3));">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
        </svg>
        <div style="position: absolute; top: 7px; width: 6px; height: 6px; background: #FFFFFF; border-radius: 50%;"></div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
}

// ── Field Location Map Component ──────────────────────────────────────────────

interface FieldLocationMapProps {
  project: Project | null;
}

export function FieldLocationMap({ project }: FieldLocationMapProps) {
  const [coords, setCoords] = useState<[number, number] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!project) {
      setCoords(null);
      setLoading(false);
      return;
    }

    // 1. Direct coordinates check
    const directCoords = parseCoordinates(project.coords);
    if (directCoords) {
      setCoords(directCoords);
      setLoading(false);
      setError(false);
      return;
    }

    // 2. Geocode from location / district
    const locationQuery = (project.location || project.district || project.constituency || "").trim();
    if (!locationQuery) {
      setCoords(null);
      setLoading(false);
      setError(true);
      return;
    }

    // Check fast local match first
    const instantCoords = resolveKnownCoordinates(locationQuery);
    if (instantCoords) {
      setCoords(instantCoords);
      setLoading(false);
      setError(false);
      return;
    }

    setLoading(true);
    setError(false);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    geocodeLocation(locationQuery, controller.signal)
      .then((resolved) => {
        clearTimeout(timeoutId);
        if (resolved) {
          setCoords(resolved);
          setError(false);
        } else {
          setCoords(null);
          setError(true);
        }
      })
      .catch(() => {
        setCoords(null);
        setError(true);
      })
      .finally(() => {
        setLoading(false);
      });

    return () => {
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [project]);

  const markerColor = useMemo(() => {
    if (!project) return "#4F46E5";
    if (project.status === "HIGH RISK") return "#B3261E";
    if (project.status === "REVIEW") return "#7C4F00";
    return "#006C4C";
  }, [project]);

  const googleMapsUrl = useMemo(() => {
    if (!project) return "#";
    if (coords) {
      return `https://www.google.com/maps/search/?api=1&query=${coords[0]},${coords[1]}`;
    }
    const query = project.location || project.district || project.constituency || "";
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }, [coords, project]);

  if (!project) {
    return null;
  }

  // Graceful fallback if coordinates are unavailable
  if (!loading && (error || !coords)) {
    return (
      <div
        className="rounded-3xl p-4 text-center space-y-2"
        style={{
          background: "#ECE6F0",
          border: "1px solid #CAC4D0",
        }}
      >
        <div className="text-xs font-semibold" style={{ color: "#1C1B1F" }}>
          Location coordinates unavailable
        </div>
        <div className="text-[10px]" style={{ color: "#79747E" }}>
          {project.location || "No location data available"}
        </div>
        {project.location && (
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-white shadow-sm"
            style={{ background: "#4F46E5", textDecoration: "none" }}
          >
            <span>Search on Google Maps</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z" />
            </svg>
          </a>
        )}
      </div>
    );
  }

  return (
    <div
      className="rounded-3xl overflow-hidden relative shadow-sm"
      style={{
        height: 200,
        background: "#ECE6F0",
        border: "1px solid #ECE6F0",
      }}
    >
      {/* Floating Google Maps Action Button */}
      <a
        href={googleMapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute top-2.5 right-2.5 z-[1000] flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold text-white shadow-md transition-all active:scale-95 hover:opacity-95"
        style={{
          background: "#4F46E5",
          textDecoration: "none",
          backdropFilter: "blur(4px)",
        }}
        title="Open project location in Google Maps"
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
        </svg>
        <span>Open in Google Maps</span>
        <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z" />
        </svg>
      </a>

      {loading && (
        <div
          className="absolute inset-0 z-[1000] flex items-center justify-center text-xs font-medium"
          style={{ background: "rgba(243, 240, 249, 0.8)", color: "#49454F" }}
        >
          Resolving project location...
        </div>
      )}

      {coords && (
        <MapContainer
          center={coords}
          zoom={13}
          scrollWheelZoom={false}
          attributionControl={false}
          zoomControl={false}
          style={{ height: "100%", width: "100%", zIndex: 1 }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          <MapController center={coords} />
          <Marker position={coords} icon={createMarkerIcon(markerColor)}>
            <Popup>
              <div style={{ padding: "3px", minWidth: "160px", maxWidth: "210px" }}>
                <div style={{ fontSize: "9px", fontFamily: "monospace", color: "#79747E", marginBottom: "2px" }}>
                  {project.id}
                </div>
                <div style={{ fontSize: "11px", fontWeight: "bold", color: "#1C1B1F", lineHeight: 1.3, marginBottom: "3px" }}>
                  {project.title}
                </div>
                <div style={{ fontSize: "10px", color: "#49454F", marginBottom: "4px" }}>
                  📍 {project.location}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #ECE6F0", paddingTop: "3px", marginBottom: "6px" }}>
                  <span style={{ fontSize: "10px", fontWeight: "600", color: "#1C1B1F" }}>{project.amount}</span>
                  <span
                    style={{
                      fontSize: "9px",
                      fontWeight: "bold",
                      padding: "1px 5px",
                      borderRadius: "8px",
                      background: project.status === "HIGH RISK" ? "#FFDAD6" : project.status === "REVIEW" ? "#FFEFD6" : "#D4F8E8",
                      color: project.status === "HIGH RISK" ? "#B3261E" : project.status === "REVIEW" ? "#7C4F00" : "#006C4C",
                    }}
                  >
                    {project.status}
                  </span>
                </div>

                {/* Google Maps Button inside Popup */}
                <a
                  href={googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "4px",
                    width: "100%",
                    padding: "5px 8px",
                    background: "#4F46E5",
                    color: "#FFFFFF",
                    fontSize: "10px",
                    fontWeight: "bold",
                    borderRadius: "6px",
                    textDecoration: "none",
                    boxSizing: "border-box",
                  }}
                >
                  <span>Open in Google Maps</span>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z" />
                  </svg>
                </a>
              </div>
            </Popup>
          </Marker>
        </MapContainer>
      )}
    </div>
  );
}

export default FieldLocationMap;
