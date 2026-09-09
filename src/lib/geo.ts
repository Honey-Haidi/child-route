export type LatLng = { lat: number; lng: number };

const EARTH_RADIUS_M = 6371000;

export function distanceMeters(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters)) return "—";
  if (meters < 950) return `${Math.round(meters / 10) * 10} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * ETA from remaining distance and a speed estimate.
 * Falls back to a conservative city average when the vehicle is stopped.
 */
export function etaMinutes(meters: number, speedKmh: number | null | undefined): number {
  const speed = speedKmh && speedKmh > 8 ? Math.min(speedKmh, 80) : 22;
  const minutes = meters / 1000 / speed * 60;
  return Math.max(1, Math.round(minutes));
}

export function formatTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatDate(value: string): string {
  return new Date(value).toLocaleDateString([], {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export const STALE_LOCATION_MS = 45000;

export function isStale(recordedAt: string | null | undefined, now = Date.now()): boolean {
  if (!recordedAt) return true;
  return now - new Date(recordedAt).getTime() > STALE_LOCATION_MS;
}
