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

export function formatDist(m: number, unit: DistUnit): string {
  if (unit === 'nm') return `${(m / 1852).toFixed(1)} nm`
  if (unit === 'km') return m < 1000
    ? `${Math.round(m)} m`
    : `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`
  // 'm' = smart metrisk: m nær, km langt
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

const DIRS = ['N', 'NØ', 'Ø', 'SØ', 'S', 'SV', 'V', 'NV']

export default function NavOverlay() {
  const navTarget = useMapStore((s) => s.navTarget)
  const position  = useMapStore((s) => s.position)
  const distUnit  = useMapStore((s) => s.distUnit)
  const waypoints = useMapStore((s) => s.waypoints)
  const clearNav  = useMapStore((s) => s.clearNav)

  if (!navTarget) return null

  // Total remaining route distance: position → remaining waypoints → navTarget
  const routePoints = position
    ? [{ lat: position.lat, lng: position.lng }, ...waypoints, { lat: navTarget.lat, lng: navTarget.lng }]
    : [...waypoints, { lat: navTarget.lat, lng: navTarget.lng }]

  const totalDist = routePoints.length < 2 ? null : routePoints.reduce((sum, pt, i) => {
    if (i === 0) return 0
    return sum + haversineM(routePoints[i - 1].lat, routePoints[i - 1].lng, pt.lat, pt.lng)
  }, 0)

  const directDist = position ? haversineM(position.lat, position.lng, navTarget.lat, navTarget.lng) : null
  const dist = totalDist ?? directDist
  const brg  = position ? bearingDeg(position.lat, position.lng, navTarget.lat, navTarget.lng) : null
  const dir  = brg !== null ? DIRS[Math.round(brg / 45) % 8] : null
  const eta  = (dist !== null && position) ? formatETA(dist, position.speed) : '---'
  const arrived = directDist !== null && directDist < 30

  return (
    <div className={`nav-overlay ${arrived ? 'nav-arrived' : ''}`}>
      <div className="nav-name">➤ {navTarget.name}</div>
      <div className="nav-stats">
        {dist !== null && <span className="nav-stat">{formatDist(dist, distUnit)}</span>}
        {brg  !== null && <span className="nav-stat">{Math.round(brg)}° {dir}</span>}
        <span className="nav-stat nav-eta">⏱ {eta}</span>
      </div>
      {arrived && <div className="nav-arrived-text">Du er fremme!</div>}
      <button className="nav-stop" onClick={clearNav}>Stopp navigasjon ✕</button>
    </div>
  )
}
