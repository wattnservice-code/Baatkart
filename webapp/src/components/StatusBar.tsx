import { useEffect, useState } from 'react'
import { MapPin, Compass, WifiOff, Wifi, Copy, Check, Circle } from 'lucide-react'
import { useMapStore } from '../store/useMapStore'
import { formatDist } from './NavOverlay'
import { cardinal } from '../geo'

export default function StatusBar() {
  const position          = useMapStore((s) => s.position)
  const compassEnabled    = useMapStore((s) => s.compassEnabled)
  const compassHeading    = useMapStore((s) => s.compassHeading)
  const isTracking        = useMapStore((s) => s.isTracking)
  const startTracking     = useMapStore((s) => s.startTracking)
  const stopTracking      = useMapStore((s) => s.stopTracking)
  const setPendingTrackSave = useMapStore((s) => s.setPendingTrackSave)
  const clearTrack        = useMapStore((s) => s.clearTrack)
  const trackPoints       = useMapStore((s) => s.track.length)
  const trackDistanceM    = useMapStore((s) => s.trackDistanceM)
  const distUnit          = useMapStore((s) => s.distUnit)
  const offlineOnly       = useMapStore((s) => s.offlineOnly)
  const toggleOfflineOnly = useMapStore((s) => s.toggleOfflineOnly)
  const setOfflineOnly    = useMapStore((s) => s.setOfflineOnly)
  // speed is shown in the floating badge (MapControls) — not duplicated here

  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [copied, setCopied]     = useState(false)
  const [now, setNow]           = useState(Date.now())

  // Tick every 3 s to detect stale GPS (position.timestamp not updated)
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 3000)
    return () => clearInterval(id)
  }, [])

  const gpsStale = !!position && (now - position.timestamp) > 8000

  useEffect(() => {
    const on = () => setIsOnline(true)
    const off = () => {
      setIsOnline(false)
      // Auto-enable offline map mode when connectivity is lost
      setOfflineOnly(true)
    }
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [setOfflineOnly])

  const copyCoords = () => {
    if (!position) return
    const text = `${position.lat.toFixed(5)}°N ${position.lng.toFixed(5)}°E`
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="status-bar">
      {/* Coordinates — tap to copy */}
      <button
        className={`status-item status-coords-btn ${copied ? 'status-coords-copied' : ''} ${gpsStale ? 'status-gps-stale' : ''}`}
        onClick={copyCoords}
        title={gpsStale ? 'GPS-signal mistet' : 'Trykk for å kopiere'}
      >
        <MapPin size={16} className="status-icon" />
        <span className="status-value">
          {!position
            ? 'Ingen GPS'
            : gpsStale
            ? 'GPS mistet'
            : `${position.lat.toFixed(4)}°N ${position.lng.toFixed(4)}°E`}
        </span>
        {position && !gpsStale && (copied
          ? <Check size={12} style={{ color: '#4ade80', marginLeft: 3 }} />
          : <Copy size={13} style={{ color: '#94a3b8', marginLeft: 3 }} />
        )}
      </button>

      <div className="status-divider" />

      <div className="status-item">
        <Compass size={16} className="status-icon" />
        {(() => {
          const useCompass = compassEnabled && compassHeading != null && !isNaN(compassHeading)
          const deg = useCompass ? compassHeading! : position?.heading
          return <>
            <span className="status-value">{deg != null ? `${Math.round(deg)}°` : '--'}</span>
            <span className="status-unit">{deg != null ? cardinal(deg) : ''}</span>
            {useCompass && <span className="status-unit" style={{ marginLeft: 2, opacity: 0.6 }}>KMP</span>}
          </>
        })()}
      </div>

      <div className="status-divider" />

      {/* Network status — tap to toggle offline-only map mode */}
      <button
        className={`status-net status-net-btn ${offlineOnly ? 'status-net-offline-only' : isOnline ? 'status-net-on' : 'status-net-off'}`}
        onClick={toggleOfflineOnly}
        title={offlineOnly ? 'Offline-modus PÅ – trykk for å skru av' : 'Trykk for å bruke kun nedlastet kart'}
      >
        {offlineOnly || !isOnline ? <WifiOff size={18} /> : <Wifi size={18} />}
        {offlineOnly && <span className="status-offline-label">Offline</span>}
      </button>

      <div className="status-divider" />
      {/* Tur-knapp: start om ikke recording; stopp + "Lagre tur"-popup om recording */}
      <button
        className={`status-tracking-btn ${isTracking ? 'status-tracking-on' : ''}`}
        onClick={() => {
          if (!isTracking) { startTracking(); return }
          stopTracking()
          if (trackPoints > 1) setPendingTrackSave(true)   // åpne Lagre tur-popup
          else clearTrack()
        }}
        title={isTracking ? 'Stopp og lagre tur' : 'Start tur-opptak'}
      >
        {isTracking
          ? <><Circle size={13} style={{ fill: '#f87171', marginRight: 4 }} />REC {formatDist(trackDistanceM, distUnit)}</>
          : <><Circle size={13} style={{ marginRight: 4 }} />Tur</>
        }
      </button>
    </div>
  )
}
