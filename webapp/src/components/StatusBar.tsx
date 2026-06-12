import { useEffect, useState } from 'react'
import { MapPin, Compass, WifiOff, Wifi, Copy, Check } from 'lucide-react'
import { useMapStore } from '../store/useMapStore'

function headingLabel(deg: number): string {
  const dirs = ['N', 'NØ', 'Ø', 'SØ', 'S', 'SV', 'V', 'NV']
  return dirs[Math.round(deg / 45) % 8]
}

export default function StatusBar() {
  const position          = useMapStore((s) => s.position)
  const isTracking        = useMapStore((s) => s.isTracking)
  const offlineOnly       = useMapStore((s) => s.offlineOnly)
  const toggleOfflineOnly = useMapStore((s) => s.toggleOfflineOnly)
  const setOfflineOnly    = useMapStore((s) => s.setOfflineOnly)
  // speed is shown in the floating badge (MapControls) — not duplicated here

  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [copied, setCopied] = useState(false)

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
      <button className={`status-item status-coords-btn ${copied ? 'status-coords-copied' : ''}`} onClick={copyCoords} title="Trykk for å kopiere">
        <MapPin size={16} className="status-icon" />
        <span className="status-value">
          {position
            ? `${position.lat.toFixed(4)}°N ${position.lng.toFixed(4)}°E`
            : 'Ingen GPS'}
        </span>
        {position && (copied
          ? <Check size={12} style={{ color: '#4ade80', marginLeft: 3 }} />
          : <Copy size={11} style={{ color: '#64748b', marginLeft: 3 }} />
        )}
      </button>

      <div className="status-divider" />

      <div className="status-item">
        <Compass size={16} className="status-icon" />
        <span className="status-value">{position ? `${Math.round(position.heading)}°` : '--'}</span>
        <span className="status-unit">{position ? headingLabel(position.heading) : ''}</span>
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

      {isTracking && (
        <>
          <div className="status-divider" />
          <div className="status-tracking">● REC</div>
        </>
      )}
    </div>
  )
}
