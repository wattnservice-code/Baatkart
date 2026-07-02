import { useEffect, useState } from 'react'
import { useMapStore } from '../store/useMapStore'
import type { DistUnit } from '../store/useMapStore'
import { haversineM } from '../geo'

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h}t ${m.toString().padStart(2, '0')}m`
  return `${m}m ${(s % 60).toString().padStart(2, '0')}s`
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
  const navTarget    = useMapStore((s) => s.navTarget)
  const navStartedAt = useMapStore((s) => s.navStartedAt)
  const position     = useMapStore((s) => s.position)
  const distUnit     = useMapStore((s) => s.distUnit)
  const clearNav     = useMapStore((s) => s.clearNav)

  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!navTarget) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [navTarget])

  if (!navTarget) return null

  const dist    = position ? haversineM(position.lat, position.lng, navTarget.lat, navTarget.lng) : null
  const eta     = (dist !== null && position) ? formatETA(dist, position.speed) : null
  const arrived = dist !== null && dist < 20
  const elapsed = navStartedAt ? formatElapsed(now - navStartedAt) : null
  // Ankomst-klokkeslett ved gjeldende fart
  let arrivalClock: string | null = null
  if (dist !== null && position && position.speed * 1.94384 >= 0.3) {
    const secLeft = (dist / position.speed)
    const a = new Date(now + secLeft * 1000)
    arrivalClock = `${a.getHours().toString().padStart(2, '0')}:${a.getMinutes().toString().padStart(2, '0')}`
  }

  return (
    <div className={`nav-overlay ${arrived ? 'nav-arrived' : ''}`}>
      <div className="nav-name">➤ {navTarget.name}</div>
      {dist !== null && (
        <div className="nav-dist-big">{formatDist(dist, distUnit)}</div>
      )}
      {eta && (
        <div className="nav-eta-big">⏱ {eta}{arrivalClock ? ` · ${arrivalClock}` : ''}</div>
      )}
      <div className="nav-elapsed">
        {elapsed && <span>Brukt: {elapsed}</span>}
      </div>
      {arrived && <div className="nav-arrived-text">Du er fremme!</div>}
      <button className="nav-stop" onClick={clearNav}>Stopp navigasjon ✕</button>
    </div>
  )
}
