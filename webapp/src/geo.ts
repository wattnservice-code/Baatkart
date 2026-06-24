// Shared geo math — single source of truth for distance, bearing, projection
// and compass labels. Previously duplicated across 8+ files.

const R = 6371000 // Earth radius, metres

// Great-circle distance between two points, in metres.
export function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const φ1 = (lat1 * Math.PI) / 180, φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180, Δλ = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Initial bearing from point 1 to point 2, in degrees [0, 360).
export function bearingDeg(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const φ1 = (lat1 * Math.PI) / 180, φ2 = (lat2 * Math.PI) / 180
  const Δλ = ((lng2 - lng1) * Math.PI) / 180
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

// Destination point given start, heading (degrees) and distance (metres).
// Returns [lat, lng] — assignable to Leaflet's LatLngExpression.
export function destPoint(lat: number, lng: number, heading: number, meters: number): [number, number] {
  const δ = meters / R
  const θ = (heading * Math.PI) / 180
  const φ1 = (lat * Math.PI) / 180, λ1 = (lng * Math.PI) / 180
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ))
  const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2))
  return [(φ2 * 180) / Math.PI, (λ2 * 180) / Math.PI]
}

// Degrees → 8-point Norwegian compass label (N/NØ/Ø/SØ/S/SV/V/NV).
// Handles negative and >360 input.
export function cardinal(deg: number): string {
  const dirs = ['N', 'NØ', 'Ø', 'SØ', 'S', 'SV', 'V', 'NV']
  const norm = ((deg % 360) + 360) % 360
  return dirs[Math.round(norm / 45) % 8]
}

// Person-in-water drift estimate (forenklet SAR-leeway-modell).
// Driften er sum av to vektorer:
//   – Vind-leeway: ~3,5 % av vindstyrke, nedvinds (windDir er "fra"-retning)
//   – Strøm: 100 % av strømhastighet, i strømmens "mot"-retning (curDir)
// Alle hastigheter i m/s, retninger i grader. Tid i sekunder.
// Returnerer estimert posisjon, total driftretning/-distanse og en
// usikkerhetsradius som vokser med tid (modellen er grov).
export const LEEWAY_FACTOR = 0.035

export interface DriftEstimate {
  lat: number
  lng: number
  bearing: number   // retning driften går MOT, grader
  distance: number  // meter
  radius: number    // usikkerhetsradius, meter
}

export function mobDrift(
  lat: number,
  lng: number,
  elapsedSec: number,
  wind: { windSpeed: number; windDir: number } | null,
  current: { speed: number; dir: number } | null,
): DriftEstimate | null {
  if (!wind && !current) return null

  // Bygg nord/øst-komponenter (m/s) fra hver kilde.
  let vN = 0, vE = 0
  if (wind) {
    const sp = LEEWAY_FACTOR * wind.windSpeed
    const θ = ((wind.windDir + 180) * Math.PI) / 180 // nedvinds
    vN += sp * Math.cos(θ)
    vE += sp * Math.sin(θ)
  }
  if (current) {
    const θ = (current.dir * Math.PI) / 180 // strøm "mot"-retning
    vN += current.speed * Math.cos(θ)
    vE += current.speed * Math.sin(θ)
  }

  const speed = Math.hypot(vN, vE)
  if (speed < 0.001) return null
  const bearing = ((Math.atan2(vE, vN) * 180) / Math.PI + 360) % 360
  const distance = speed * elapsedSec
  const [dLat, dLng] = destPoint(lat, lng, bearing, distance)
  // Usikkerhet: 30 m base + 30 % av driftet — vokser med tid.
  const radius = 30 + distance * 0.3
  return { lat: dLat, lng: dLng, bearing, distance, radius }
}
