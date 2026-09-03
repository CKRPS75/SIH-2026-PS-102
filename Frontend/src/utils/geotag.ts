import type { Project } from "../data/projects";

export type Coordinates = {
  lat: number;
  lng: number;
};

const KNOWN_COORDS: Record<string, Coordinates> = {
  barwani: { lat: 22.0368, lng: 74.9032 },
  ludhiana: { lat: 30.901, lng: 75.8573 },
  chikkamagaluru: { lat: 13.3153, lng: 75.7754 },
  chickmaglur: { lat: 13.3153, lng: 75.7754 },
  anantnag: { lat: 33.7311, lng: 75.1487 },
  bhavnagar: { lat: 21.7645, lng: 72.1519 },
  mahabubnagar: { lat: 16.7488, lng: 77.9942 },
  mahbubnagar: { lat: 16.7488, lng: 77.9942 },
  chhindwara: { lat: 22.0574, lng: 78.9382 },
  kodarma: { lat: 24.4667, lng: 85.6833 },
  patna: { lat: 25.5941, lng: 85.1376 },
  sambalpur: { lat: 21.4669, lng: 83.9812 },
  ganjam: { lat: 19.3804, lng: 85.0504 },
  dhanbad: { lat: 23.7957, lng: 86.4304 },
  nainital: { lat: 29.3919, lng: 79.4542 },
  hooghly: { lat: 22.8963, lng: 88.3846 },
  bharatpur: { lat: 27.217, lng: 77.49 },
  bhagalpur: { lat: 25.2425, lng: 86.9842 },
  mathura: { lat: 27.4924, lng: 77.6737 },
  dholpur: { lat: 26.7025, lng: 77.8934 },
  belagavi: { lat: 15.8497, lng: 74.4977 },
  patiala: { lat: 30.3398, lng: 76.3869 },
  katihar: { lat: 25.5398, lng: 87.5724 },
  purnea: { lat: 25.7771, lng: 87.4753 },
  mumbai: { lat: 19.076, lng: 72.8777 },
  kurla: { lat: 19.0726, lng: 72.8845 },
  andheri: { lat: 19.1136, lng: 72.8697 },
  chembur: { lat: 19.0522, lng: 72.8995 },
  dharavi: { lat: 19.0402, lng: 72.8509 },
  delhi: { lat: 28.6139, lng: 77.209 },
  bengaluru: { lat: 12.9716, lng: 77.5946 },
  bangalore: { lat: 12.9716, lng: 77.5946 },
  kolkata: { lat: 22.5726, lng: 88.3639 },
  chennai: { lat: 13.0827, lng: 80.2707 },
  hyderabad: { lat: 17.385, lng: 78.4867 },
  pune: { lat: 18.5204, lng: 73.8567 },
  ahmedabad: { lat: 23.0225, lng: 72.5714 },
  jaipur: { lat: 26.9124, lng: 75.7873 },
  lucknow: { lat: 26.8467, lng: 80.9462 },
  bhopal: { lat: 23.2599, lng: 77.4126 },
  chandigarh: { lat: 30.7333, lng: 76.7794 },
  ranchi: { lat: 23.3441, lng: 85.3096 },
  dehradun: { lat: 30.3165, lng: 78.0322 },
  srinagar: { lat: 34.0837, lng: 74.7973 },
  jammu: { lat: 32.7266, lng: 74.857 },
  goa: { lat: 15.2993, lng: 74.124 },
};

export function parseCoordinates(raw: string | undefined | null): Coordinates | null {
  if (!raw) return null;
  const cleaned = raw.trim();
  if (
    !cleaned ||
    cleaned.toLowerCase().includes("not provided") ||
    cleaned.toLowerCase().includes("coordinates not")
  ) {
    return null;
  }

  const match = cleaned.match(/([-+]?(?:[0-9]*\.[0-9]+|[0-9]+))[^0-9+-]+([-+]?(?:[0-9]*\.[0-9]+|[0-9]+))/);
  if (!match) return null;

  const lat = Number.parseFloat(match[1]);
  const lng = Number.parseFloat(match[2]);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

export function formatCoordinates(coords: Coordinates | null): string {
  if (!coords) return "GPS unavailable";
  const latDir = coords.lat >= 0 ? "N" : "S";
  const lngDir = coords.lng >= 0 ? "E" : "W";
  return `${Math.abs(coords.lat).toFixed(5)} deg ${latDir}, ${Math.abs(coords.lng).toFixed(5)} deg ${lngDir}`;
}

export function resolveProjectCoordinates(project: Project | null): Coordinates | null {
  if (!project) return null;

  const direct = parseCoordinates(project.coords);
  if (direct) return direct;

  const searchableText = [
    project.location,
    project.district,
    project.constituency,
    project.description,
    project.title,
  ].join(" ").toLowerCase();

  for (const [key, coords] of Object.entries(KNOWN_COORDS)) {
    if (searchableText.includes(key)) return coords;
  }

  return null;
}

export function haversineDistanceMeters(a: Coordinates, b: Coordinates): number {
  const earthRadiusMeters = 6371000;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
