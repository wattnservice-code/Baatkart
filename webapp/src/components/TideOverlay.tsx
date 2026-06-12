import { useEffect, useState, useRef } from 'react'
import { useMapStore } from '../store/useMapStore'

interface TideEvent {
  time: Date
  level: number
  type: 'high' | 'low'
}

interface TideData {
  station: string
  events: TideEvent[]
}

export default function TideOverlay() {
  const tideVisible     = useMapStore((s) => s.tideVisible)
  const hideWxTide      = useMapStore((s) => s.hideWxTide)
  const position        = useMapStore((s) => s.position)
  const [tide, setTide] = useState<TideData | null>(null)
  const [err, setErr]   = useState<string | null>(null)
  const fetchedKey      = useRef<string | null>(null)

  useEffect(() => {
    if (!tideVisible) return
    if (!position) { setErr('no-gps'); return }

    const key = `${position.lat.toFixed(1)},${position.lng.toFixed(1)}`
    if (fetchedKey.current === key) return
    fetchedKey.current = key
    setErr(null)
    setTide(null)

    const now = new Date()
    const end = new Date(now.getTime() + 48 * 3600 * 1000)
    const fmt = (d: Date) => d.toISOString().slice(0, 19)

    // vannstand.kartverket.no replaced api.sehavniva.no; datatype=tab returns only high/low events
    const url =
      `https://vannstand.kartverket.no/tideapi.php` +
      `?lat=${position.lat.toFixed(4)}&lon=${position.lng.toFixed(4)}` +
      `&fromtime=${fmt(now)}&totime=${fmt(end)}` +
      `&datatype=tab&lang=nb&tide_request=locationdata`

    fetch(url)
      .then((r) => { if (!r.ok) throw new Error(); return r.text() })
      .then((xml) => {
        const doc     = new DOMParser().parseFromString(xml, 'text/xml')
        const station = doc.querySelector('location')?.getAttribute('name') || ''
        const now2    = new Date()
        const events: TideEvent[] = []

        doc.querySelectorAll('waterlevel[flag]').forEach((el) => {
          const flag = el.getAttribute('flag')
          const t    = el.getAttribute('time')
          const v    = el.getAttribute('value')
          if (!flag || !t || !v) return
          if (flag !== 'high' && flag !== 'low') return
          const time = new Date(t)
          if (time < now2) return
          events.push({ time, level: parseFloat(v), type: flag === 'high' ? 'high' : 'low' })
        })

        setTide({ station, events: events.slice(0, 3) })
      })
      .catch(() => setErr('api'))
  }, [tideVisible, position?.lat, position?.lng])

  if (!tideVisible) return null

  const fmtTime = (d: Date) =>
    d.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="info-panel" onClick={hideWxTide} title="Trykk for å lukke" style={{ cursor: 'pointer' }}>
      {err === 'no-gps' ? (
        <span className="info-error">Ingen GPS-posisjon</span>
      ) : err === 'api' ? (
        <span className="info-error">Tidevann utilgjengelig</span>
      ) : !tide ? (
        <span className="info-loading">Laster tidevann…</span>
      ) : tide.events.length === 0 ? (
        <span className="info-error">Ingen tidedata</span>
      ) : (
        <>
          {tide.station && <div className="tide-station">{tide.station} (nærmest)</div>}
          {tide.events.map((ev, i) => (
            <div key={i} className="tide-row">
              <span className={ev.type === 'high' ? 'tide-high' : 'tide-low'}>
                {ev.type === 'high' ? '▲ Flo' : '▼ Fjøre'}
              </span>
              <span className="tide-time">{fmtTime(ev.time)}</span>
              <span className="tide-level">{Math.round(ev.level)} cm</span>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
