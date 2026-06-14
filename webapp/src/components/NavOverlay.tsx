import { useMapStore } from '../store/useMapStore'
import type { DistUnit } from '../store/useMapStore'

function haversineM(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000
  const φ1 = (lat1 * Math.PI) / 180, φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180, Δλ = ((lon2 - lon1) * Math.PI) / 180
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function formatDist(m: number, unit: DistUnit): string {
  if (unit === 'nm') { const nm = m / 1852; return `${nm < 1 ? nm.toFixed(2) : nm.toFixed(1)} nm` }
  if (unit === 'km') return m < 1000
    ? `${Math.round(m)} m`
    : `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`
  if (m < 1000) return `${Math.round(m)} m`
  return `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`
}

function formatETA(distM: number, speedMs: number): string | null {
  const kts = speedMs * 1.94384
  if (kts < 0.3) return null
  const minutes = Math.round((distM / 1852) / kts * 60)
  if (minutes < 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)}t ${minutes % 60}m`
}

export default function NavOverlay() {
  const navTarget = useMapStore((s) => s.navTarget)
  const position  = useMapStore((s) => s.position)
  const distUnit  = useMapStore((s) => s.distUnit)
  const clearNav  = useMapStore((s) => s.clearNav)

  if (!navTarget) return null

  const dist    = position ? haversineM(position.lat, position.lng, navTarget.lat, navTarget.lng) : null
  const eta     = (dist !== null && position) ? formatETA(dist, position.speed) : null
  const arrived = dist !== null && dist < 20

  return (
    <div className={`nav-overlay ${arrived ? 'nav-arrived' : ''}`}>
      <div className="nav-name">➤ {navTarget.name}</div>
      {dist !== null && (
        <div className="nav-dist-big">{formatDist(dist, distUnit)}</div>
      )}
      {eta && (
        <div className="nav-eta-big">⏱ {eta}</div>
      )}
      {arrived && <div className="nav-arrived-text">Du er fremme!</div>}
      <button className="nav-stop" onClick={clearNav}>Stopp navigasjon ✕</button>
    </div>
  )
}
