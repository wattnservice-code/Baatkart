import { useEffect } from 'react'
import { useMapStore } from '../store/useMapStore'
import type { DistUnit } from '../store/useMapStore'

function haversineM(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000
  const φ1 = (lat1 * Math.PI) / 180, φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180, Δλ = ((lon2 - lon1) * Math.PI) / 180
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function bearingDeg(lat1: number, lon1: number, lat2: number, lon2: number) {
  const φ1 = (lat1 * Math.PI) / 180, φ2 = (lat2 * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

// Cross-track error: signed distance (m) from point P to great-circle line A→B
// Positive = right of track, negative = left
function crossTrackError(pLat: number, pLon: number, aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371000
  const d13 = haversineM(aLat, aLon, pLat, pLon) / R
  const θ13 = bearingDeg(aLat, aLon, pLat, pLon) * Math.PI / 180
  const θ12 = bearingDeg(aLat, aLon, bLat, bLon) * Math.PI / 180
  return Math.asin(Math.sin(d13) * Math.sin(θ13 - θ12)) * R
}

export function formatDist(m: number, unit: DistUnit): string {
  if (unit === 'nm') return `${(m / 1852).toFixed(1)} nm`
  if (unit === 'km') return m < 1000
    ? `${Math.round(m)} m`
    : `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`
  if (m < 1000) return `${Math.round(m)} m`
  return `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`
}

function formatETA(distM: number, speedMs: number): string {
  const kts = speedMs * 1.94384
  if (kts < 0.3) return '---'
  const minutes = Math.round((distM / 1852) / kts * 60)
  if (minutes < 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)}t ${minutes % 60}m`
}

function fmtXTE(m: number): string {
  const abs = Math.abs(m)
  const side = m > 0 ? 'H' : 'V'
  return abs < 1000 ? `${Math.round(abs)}m ${side}` : `${(abs / 1000).toFixed(1)}km ${side}`
}

const DIRS = ['N', 'NØ', 'Ø', 'SØ', 'S', 'SV', 'V', 'NV']

export default function NavOverlay() {
  const navTarget      = useMapStore((s) => s.navTarget)
  const position       = useMapStore((s) => s.position)
  const distUnit       = useMapStore((s) => s.distUnit)
  const waypoints      = useMapStore((s) => s.waypoints)
  const removeWaypoint = useMapStore((s) => s.removeWaypoint)
  const clearNav       = useMapStore((s) => s.clearNav)

  // Auto-advance: remove first waypoint when within 50m
  useEffect(() => {
    if (!position || waypoints.length === 0) return
    const next = waypoints[0]
    const d = haversineM(position.lat, position.lng, next.lat, next.lng)
    if (d < 50) removeWaypoint(next.id)
  }, [position, waypoints, removeWaypoint])

  if (!navTarget) return null

  // Next target: first waypoint if exists, otherwise final destination
  const nextTarget = waypoints.length > 0 ? waypoints[0] : navTarget
  const isLastLeg  = waypoints.length === 0

  // Distance + bearing to next waypoint
  const nextDist = position ? haversineM(position.lat, position.lng, nextTarget.lat, nextTarget.lng) : null
  const nextBrg  = position ? bearingDeg(position.lat, position.lng, nextTarget.lat, nextTarget.lng) : null
  const dir      = nextBrg !== null ? DIRS[Math.round(nextBrg / 45) % 8] : null

  // Total remaining route distance
  const routePts = position
    ? [{ lat: position.lat, lng: position.lng }, ...waypoints, { lat: navTarget.lat, lng: navTarget.lng }]
    : [...waypoints, { lat: navTarget.lat, lng: navTarget.lng }]
  const totalDist = routePts.length < 2 ? nextDist : routePts.reduce((sum, pt, i) => {
    if (i === 0) return 0
    return sum + haversineM(routePts[i - 1].lat, routePts[i - 1].lng, pt.lat, pt.lng)
  }, 0)

  // Cross-track error to current leg
  const prevPt   = position ? { lat: position.lat, lng: position.lng } : null
  const xte      = (prevPt && position && !isLastLeg)
    ? crossTrackError(position.lat, position.lng, prevPt.lat, prevPt.lng, nextTarget.lat, nextTarget.lng)
    : null

  const eta      = (totalDist !== null && position) ? formatETA(totalDist, position.speed) : '---'
  const arrived  = nextDist !== null && nextDist < 30 && isLastLeg

  return (
    <div className={`nav-overlay ${arrived ? 'nav-arrived' : ''}`}>
      <div className="nav-name">
        ➤ {isLastLeg ? navTarget.name : `WP1: ${nextTarget.name}`}
        {!isLastLeg && <span style={{ color: '#64748b', fontSize: 11, marginLeft: 6 }}>→ {navTarget.name}</span>}
      </div>
      <div className="nav-stats">
        {nextDist !== null && <span className="nav-stat">{formatDist(nextDist, distUnit)}</span>}
        {nextBrg  !== null && <span className="nav-stat">{Math.round(nextBrg)}° {dir}</span>}
        <span className="nav-stat nav-eta">⏱ {eta}</span>
      </div>
      {!isLastLeg && totalDist !== null && nextDist !== null && (
        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
          Total: {formatDist(totalDist, distUnit)} · {waypoints.length + 1} etapper
        </div>
      )}
      {xte !== null && Math.abs(xte) > 15 && (
        <div style={{ fontSize: 11, color: Math.abs(xte) > 100 ? '#f87171' : '#fbbf24', marginTop: 2 }}>
          XTE: {fmtXTE(xte)}
        </div>
      )}
      {arrived && <div className="nav-arrived-text">Du er fremme!</div>}
      <button className="nav-stop" onClick={clearNav}>Stopp navigasjon ✕</button>
    </div>
  )
}
