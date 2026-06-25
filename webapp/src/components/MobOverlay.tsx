import { useEffect, useState } from 'react'
import { Copy, Check, Share2 } from 'lucide-react'
import { useMapStore } from '../store/useMapStore'
import { formatDist } from './NavOverlay'
import { haversineM, bearingDeg, cardinal, mobDrift } from '../geo'
import { fetchWeather, fetchOcean } from '../weather'

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
  const setCurrentWeather = useMapStore((s) => s.setCurrentWeather)
  const setCurrentSea     = useMapStore((s) => s.setCurrentSea)
  const boatInfo       = useMapStore((s) => s.boatInfo)
  const [elapsed, setElapsed] = useState('')
  const [copied, setCopied] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [now, setNow] = useState(Date.now())
  // Auto-åpent ved aktivering (valg umiddelbart i krise), kollapser når du velger
  const [expanded, setExpanded] = useState(true)

  useEffect(() => {
    if (!mobPoint) return
    const id = setInterval(() => {
      setElapsed(formatElapsed(mobPoint.timestamp))
      setNow(Date.now())
    }, 1000)
    setElapsed(formatElapsed(mobPoint.timestamp))
    return () => clearInterval(id)
  }, [mobPoint])

  // Ny MOB: nullstill bekreftelse og åpne panelet automatisk
  useEffect(() => { setConfirmClear(false); setExpanded(true) }, [mobPoint])

  // Hent vind + strøm ved MOB-punktet så driftestimatet alltid virker,
  // også når værpanelet er av. Henter én gang per ny MOB.
  useEffect(() => {
    if (!mobPoint) return
    fetchWeather(mobPoint.lat, mobPoint.lng)
      .then(({ wx }) => setCurrentWeather({ windSpeed: wx.windSpeed, windDir: wx.windDir, temp: wx.temp }))
      .catch(() => {})
    fetchOcean(mobPoint.lat, mobPoint.lng)
      .then((ocean) => { if (ocean) setCurrentSea(ocean.current) })
      .catch(() => {})
  }, [mobPoint, setCurrentWeather, setCurrentSea])

  // Bygger MOB-rapporten som både kopier og del bruker. Identisk innhold.
  const buildMobText = () => {
    if (!mobPoint) return ''
    const dt = new Date(mobPoint.timestamp).toLocaleString('nb-NO', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
    const lines = [`MANN OVER BORD ${dt}`]
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
    return lines.join('\n')
  }

  const copyMobPos = () => {
    const text = buildMobText()
    if (!text) return
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    })
  }

  // Native delingsark (SMS/WhatsApp/e-post osv.). Faller tilbake til kopiering
  // hvis nettleseren ikke støtter Web Share API (f.eks. desktop).
  const shareMobPos = async () => {
    const text = buildMobText()
    if (!text) return
    const url = mobPoint ? `https://www.google.com/maps?q=${mobPoint.lat},${mobPoint.lng}` : undefined
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Mann over bord', text, url })
      } catch { /* bruker avbrøt – ignorer */ }
    } else {
      copyMobPos()
    }
  }

  if (!mobPoint) return null

  const dist = position ? haversineM(position.lat, position.lng, mobPoint.lat, mobPoint.lng) : null
  const brg = position ? bearingDeg(position.lat, position.lng, mobPoint.lat, mobPoint.lng) : null

  const elapsedSec = (now - mobPoint.timestamp) / 1000
  const wind = currentWeather ? { windSpeed: currentWeather.windSpeed, windDir: currentWeather.windDir } : null
  const drift = mobDrift(mobPoint.lat, mobPoint.lng, elapsedSec, wind, currentSea)

  // Kollapset: liten pulserende MOB-knapp øverst venstre. Dekker ikke båt/FAB.
  if (!expanded) {
    return (
      <button className="mob-badge" onClick={() => setExpanded(true)} title="Mann over bord – trykk for valg">
        <span className="mob-badge-icon">⚠</span>
        <span className="mob-badge-meta">
          <span className="mob-badge-label">MOB</span>
          {dist !== null && <span className="mob-badge-dist">{formatDist(dist, distUnit)}</span>}
        </span>
      </button>
    )
  }

  // Utvidet: «Hva vil du gjøre?»-panel. Lukk → tilbake til knapp, fortsatt MOB.
  return (
    <>
      {/* Fanger trykk på kartet bak panelet → kollaps, ingen "Valgt punkt"-meny */}
      <div className="mob-backdrop" onClick={() => setExpanded(false)} />
      <div className="mob-overlay">
      <div className="mob-head">
        <span className="mob-title">⚠ MANN OVER BORD</span>
        <button className="mob-collapse" onClick={() => setExpanded(false)} title="Lukk – fortsatt i MOB-modus">✕</button>
      </div>

      <div className="mob-stats">
        {dist !== null && <span className="mob-stat">{formatDist(dist, distUnit)}</span>}
        {brg !== null && <span className="mob-stat">{Math.round(brg)}°</span>}
        <span className="mob-stat mob-elapsed">{elapsed}</span>
      </div>

      {drift && drift.distance >= 15 && (
        <div className="mob-drift" title="Estimert drift fra vind + strøm">
          ➤ Drift: {formatDist(drift.distance, distUnit)} {cardinal(drift.bearing)}
          <span className="mob-drift-sub">±{Math.round(drift.radius)} m</span>
        </div>
      )}

      <a className="mob-emergency" href="tel:120">
        ⚠ Estimat – ring nødnummer sjø <strong>120</strong>
      </a>

      <div className="mob-prompt">Hva vil du gjøre?</div>

      <div className="mob-actions">
        <button
          className="mob-goto"
          onClick={() => { setNavTarget({ lat: mobPoint.lat, lng: mobPoint.lng, name: 'MOB' }); setExpanded(false) }}
        >
          Naviger dit
        </button>
        <button
          className="mob-goto"
          onClick={() => { setFlyTo({ lat: mobPoint.lat, lng: mobPoint.lng }); setExpanded(false) }}
        >
          Vis på kart
        </button>
      </div>

      <div className="mob-share-row">
        <button className="mob-coords-copy" onClick={copyMobPos} title="Kopier posisjon til utklippstavle">
          {copied
            ? <><Check size={16} /> Kopiert!</>
            : <><Copy size={16} /> Kopier</>
          }
        </button>
        <button className="mob-coords-share" onClick={shareMobPos} title="Del posisjon via melding, e-post osv.">
          <Share2 size={16} /> Del
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
    </>
  )
}
