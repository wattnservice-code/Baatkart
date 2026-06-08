import { useEffect, useRef } from 'react'
import { useMapStore } from '../store/useMapStore'
import { beep } from '../audio'

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000
  const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180
  const Δφ = (lat2 - lat1) * Math.PI / 180, Δλ = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(Δφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

function alarm() {
  beep(660, 0.4, 0.6)
  setTimeout(() => beep(880, 0.4, 0.6), 450)
  navigator.vibrate?.([300, 150, 300])
}

export default function AnchorOverlay() {
  const anchorPoint  = useMapStore((s) => s.anchorPoint)
  const anchorRadius = useMapStore((s) => s.anchorRadius)
  const anchorAlarm  = useMapStore((s) => s.anchorAlarm)
  const position     = useMapStore((s) => s.position)
  const clearAnchor  = useMapStore((s) => s.clearAnchor)
  const beepRef      = useRef<ReturnType<typeof setInterval> | null>(null)

  const dist = (anchorPoint && position)
    ? haversineM(position.lat, position.lng, anchorPoint.lat, anchorPoint.lng)
    : null

  useEffect(() => {
    if (anchorAlarm) {
      alarm()
      beepRef.current = setInterval(alarm, 4000)
    } else {
      if (beepRef.current) { clearInterval(beepRef.current); beepRef.current = null }
    }
    return () => { if (beepRef.current) clearInterval(beepRef.current) }
  }, [anchorAlarm])

  if (!anchorPoint) return null

  return (
    <div className={`anchor-overlay ${anchorAlarm ? 'anchor-alarm' : 'anchor-ok'}`}>
      <div className="anchor-title">
        {anchorAlarm ? '⚠ ANKER DRIFTER' : '⚓ For anker'}
      </div>
      <div className="anchor-stats">
        {dist !== null && (
          <span className="anchor-stat">
            {Math.round(dist)} m {anchorAlarm ? `(+${Math.round(dist - anchorRadius)} m)` : `/ ${anchorRadius} m`}
          </span>
        )}
      </div>
      <button className="anchor-lift" onClick={clearAnchor}>Løft anker</button>
    </div>
  )
}
