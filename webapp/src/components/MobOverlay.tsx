import { useEffect, useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { useMapStore } from '../store/useMapStore'
import { formatDist } from './NavOverlay'

function windDirLabel(deg: number): string {
  const dirs = ['N', 'NØ', 'Ø', 'SØ', 'S', 'SV', 'V', 'NV']
  return dirs[Math.round(deg / 45) % 8]
}

function haversineM(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function bearingDeg(lat1: number, lon1: number, lat2: number, lon2: number) {
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

function formatElapsed(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000)
  const m = Math.floor(s / 60)
  const sec = s % 60
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`
}

export default function MobOverlay() {
  const mobPoint      = useMapStore((s) => s.mobPoint)
  const position      = useMapStore((s) => s.position)
  const distUnit      = useMapStore((s) => s.distUnit)
  const clearMob      = useMapStore((s) => s.clearMob)
  const setFlyTo      = useMapStore((s) => s.setFlyTo)
  const setNavTarget  = useMapStore((s) => s.setNavTarget)
  const currentWeather = useMapStore((s) => s.currentWeather)
  const boatInfo       = useMapStore((s) => s.boatInfo)
  const [elapsed, setElapsed] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!mobPoint) return
    const id = setInterval(() => setElapsed(formatElapsed(mobPoint.timestamp)), 1000)
    setElapsed(formatElapsed(mobPoint.timestamp))
    return () => clearInterval(id)
  }, [mobPoint])

  const copyMobPos = () => {
    if (!mobPoint) return
    const dt = new Date(mobPoint.timestamp).toLocaleString('nb-NO', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
    const lines = [`MOB ${dt}`]
    if (boatInfo.name) {
      const boatLine = [`Båt: ${boatInfo.name}`, boatInfo.boatType, boatInfo.mmsi ? `MMSI: ${boatInfo.mmsi}` : ''].filter(Boolean).join('  ')
      lines.push(boatLine)
    }
    lines.push(`Posisjon: ${mobPoint.lat.toFixed(5)}°N ${mobPoint.lng.toFixed(5)}°E`)
    if (currentWeather) {
      const dir = windDirLabel(currentWeather.windDir)
      lines.push(`Vær: ${currentWeather.windSpeed.toFixed(1)} m/s ${dir}, ${Math.round(currentWeather.temp)}°C`)
    }
    if (boatInfo.phone) lines.push(`Kontakt: ${boatInfo.phone}`)
    if (boatInfo.notes) lines.push(`Notat: ${boatInfo.notes}`)
    navigator.clipboard?.writeText(lines.join('\n')).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    })
  }

  if (!mobPoint) return null

  const dist = position ? haversineM(position.lat, position.lng, mobPoint.lat, mobPoint.lng) : null
  const brg = position ? bearingDeg(position.lat, position.lng, mobPoint.lat, mobPoint.lng) : null

  return (
    <div className="mob-overlay">
      <div className="mob-title">⚠ MANN OVER BORD</div>
      <div className="mob-stats">
        {dist !== null && <span className="mob-stat">{formatDist(dist, distUnit)}</span>}
        {brg !== null && <span className="mob-stat">{Math.round(brg)}°</span>}
        <span className="mob-stat mob-elapsed">{elapsed}</span>
      </div>

      {/* Coordinates for emergency use */}
      <button className="mob-coords-copy" onClick={copyMobPos} title="Kopier posisjon til utklippstavle">
        <span className="mob-coords-text">
          {mobPoint.lat.toFixed(5)}°N&nbsp;&nbsp;{mobPoint.lng.toFixed(5)}°E
        </span>
        {copied
          ? <><Check size={14} /> Kopiert!</>
          : <><Copy size={14} /> Kopier</>
        }
      </button>

      <div className="mob-actions">
        <button className="mob-goto" onClick={() => setNavTarget({ lat: mobPoint.lat, lng: mobPoint.lng, name: 'MOB' })}>
          Naviger dit
        </button>
        <button className="mob-goto" onClick={() => setFlyTo({ lat: mobPoint.lat, lng: mobPoint.lng })}>
          Vis på kart
        </button>
        <button className="mob-clear" onClick={clearMob}>Person funnet ✓</button>
      </div>
    </div>
  )
}
