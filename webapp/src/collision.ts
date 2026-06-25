// Kollisjonsberegning (CPA/TCPA) — closest point of approach mellom egen båt
// og et AIS-fartøy. Ren matte, ekstrahert fra useAIS for å kunne testes.

export const DANGER_CPA_M    = 926   // 0.5 nm
export const DANGER_TCPA_MIN = 15
export const KN_TO_MS        = 0.514444

export interface OwnState { lat: number; lng: number; speedMs: number; courseDeg: number }
export interface CpaInfo  { cpaM: number; tcpaMin: number; rangeM: number; bearingDeg: number }

// Mål-fartøyets relevante felter (delmengde av AISVessel).
export interface CpaTarget { lat: number; lng: number; sog: number; heading: number; cog: number }

// Lokal flat projeksjon (gyldig over korte avstander) + relativ hastighet.
// Returnerer nærmeste passeringsavstand (cpaM), tid til den (tcpaMin),
// nåværende avstand (rangeM) og peiling (bearingDeg).
export function computeCPA(own: OwnState, t: CpaTarget): CpaInfo | null {
  const R = 6371000, latRad = (own.lat * Math.PI) / 180
  const px = ((t.lng - own.lng) * Math.PI / 180) * R * Math.cos(latRad)
  const py = ((t.lat - own.lat) * Math.PI / 180) * R
  const rangeM     = Math.hypot(px, py)
  const bearingDeg = ((Math.atan2(px, py) * 180 / Math.PI) + 360) % 360
  const ovx = own.speedMs * Math.sin((own.courseDeg * Math.PI) / 180)
  const ovy = own.speedMs * Math.cos((own.courseDeg * Math.PI) / 180)
  const tSpeed = t.sog * KN_TO_MS
  const tCourse = t.heading > 0 && t.heading < 360 ? t.heading : t.cog
  const tvx = tSpeed * Math.sin((tCourse * Math.PI) / 180)
  const tvy = tSpeed * Math.cos((tCourse * Math.PI) / 180)
  const rvx = tvx - ovx, rvy = tvy - ovy
  const rv2 = rvx * rvx + rvy * rvy
  if (rv2 < 1e-4) return { cpaM: rangeM, tcpaMin: 0, rangeM, bearingDeg }
  const tcpaSec = -(px * rvx + py * rvy) / rv2
  const cx = px + rvx * tcpaSec, cy = py + rvy * tcpaSec
  return { cpaM: Math.hypot(cx, cy), tcpaMin: tcpaSec / 60, rangeM, bearingDeg }
}

// Farlig hvis fartøyet nærmer seg (positiv TCPA) innen 15 min OG nærmeste
// passering er nærmere enn 0,5 nm.
export function isDanger(cpa: CpaInfo | null): boolean {
  return !!cpa && cpa.tcpaMin > 0 && cpa.tcpaMin < DANGER_TCPA_MIN && cpa.cpaM < DANGER_CPA_M
}
