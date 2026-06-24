import { useEffect, useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { useMapStore } from '../store/useMapStore'
import { formatDist } from './NavOverlay'
import { haversineM, bearingDeg, cardinal, mobDrift } from '../geo'

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
  const currentSea     = useMapStore((s) => s.currentSea)
  const boatInfo       = useMapStore((s) => s.boatInfo)
  const [elapsed, setElapsed] = useState('')
  const [copied, setCopied] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (!mobPoint) return
    const id = setInterval(() => {
      setElapsed(formatElapsed(mobPoint.timestamp))
      setNow(Date.now())
    }, 1000)
    setElapsed(formatElapsed(mobPoint.timestamp))
    return () => clearInterval(id)
  }, [mobPoint])

  // Nullstill bekreftelse hvis MOB endres/forsvinner
  useEffect(() => { setConfirmClear(false) }, [mobPoint])

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
      const dir = cardinal(currentWeather.windDir)
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

  const elapsedSec = (now - mobPoint.timestamp) / 1000
  const wind = currentWeather ? { windSpeed: currentWeather.windSpeed, windDir: currentWeather.windDir } : null
  const drift = mobDrift(mobPoint.lat, mobPoint.lng, elapsedSec, wind, currentSea)

  return (
    <div className="mob-overlay">
      <div className="mob-title">⚠ MANN OVER BORD</div>
      <div className="mob-stats">
        {dist !== null && <span className="mob-stat">{formatDist(dist, distUnit)}</span>}
        {brg !== null && <span className="mob-stat">{Math.round(brg)}°</span>}
        <span className="mob-stat mob-elapsed">{elapsed}</span>
      </div>

      {drift && drift.distance >= 15 && (
        <div className="mob-drift" title="Estimert drift fra vind + strøm">
          ➤ Estimert drift: {formatDist(drift.distance, distUnit)} {cardinal(drift.bearing)}
          <span className="mob-drift-sub">±{Math.round(drift.radius)} m</span>
        </div>
      )}

      <a className="mob-emergency" href="tel:120">
        ⚠ Estimat – ring nødnummer sjø <strong>120</strong>
      </a>

      <button className="mob-coords-copy" onClick={copyMobPos} title="Kopier posisjon til utklippstavle">
        {copied
          ? <><Check size={16} /> Posisjon kopiert!</>
          : <><Copy size={16} /> Kopier posisjon</>
        }
      </button>

      <div className="mob-actions">
        <button className="mob-goto" onClick={() => setNavTarget({ lat: mobPoint.lat, lng: mobPoint.lng, name: 'MOB' })}>
          Naviger dit
        </button>
        <button className="mob-goto" onClick={() => setFlyTo({ lat: mobPoint.lat, lng: mobPoint.lng })}>
          Vis på kart
        </button>
      </div>

      {confirmClear ? (
        <div className="mob-confirm">
          <span className="mob-confirm-q">Er personen funnet? Posisjonen slettes.</span>
          <div className="mob-confirm-btns">
            <button className="mob-confirm-yes" onClick={clearMob}>Ja, avslutt</button>
            <button className="mob-confirm-no" onClick={() => setConfirmClear(false)}>Avbryt</button>
          </div>
        </div>
      ) : (
        <button className="mob-clear" onClick={() => setConfirmClear(true)}>Person funnet ✓</button>
      )}
    </div>
  )
}
