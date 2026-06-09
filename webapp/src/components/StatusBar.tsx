import { useEffect, useState } from 'react'
import { Gauge, MapPin, Compass, WifiOff, Wifi, Copy, Check } from 'lucide-react'
import { useMapStore } from '../store/useMapStore'

function formatSpeed(ms: number, unit: 'kn' | 'kmh'): string {
  return unit === 'kn'
    ? (ms * 1.94384).toFixed(1)
    : (ms * 3.6).toFixed(1)
}

function headingLabel(deg: number): string {
  const dirs = ['N', 'NØ', 'Ø', 'SØ', 'S', 'SV', 'V', 'NV']
  return dirs[Math.round(deg / 45) % 8]
}

export default function StatusBar() {
  const position   = useMapStore((s) => s.position)
  const isTracking = useMapStore((s) => s.isTracking)
  const speedUnit  = useMapStore((s) => s.speedUnit)
  const tileSource = useMapStore((s) => s.tileSource)

  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const on = () => setIsOnline(true)
    const off = () => setIsOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

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
      <div className="status-item">
        <Gauge size={16} className="status-icon" />
        <span className="status-value">{position ? formatSpeed(position.speed, speedUnit) : '--'}</span>
        <span className="status-unit">{speedUnit === 'kn' ? 'kn' : 'km/t'}</span>
      </div>

      <div className="status-divider" />

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

      {/* Network status */}
      <div className={`status-net ${isOnline ? 'status-net-on' : 'status-net-off'}`} title={isOnline ? 'Internett tilkoblet' : 'Ingen internett'}>
        {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
      </div>

      {tileSource && (
        <>
          <div className="status-divider" />
          <div className={`status-tile-source status-tile-${tileSource}`}>
            {tileSource === 'offline' ? 'Offline' : tileSource === 'mixed' ? 'Blandet' : 'Nett-tiles'}
          </div>
        </>
      )}

      {isTracking && (
        <>
          <div className="status-divider" />
          <div className="status-tracking">● REC</div>
        </>
      )}
    </div>
  )
}
