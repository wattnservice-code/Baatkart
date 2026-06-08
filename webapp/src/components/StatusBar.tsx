import { Gauge, MapPin, Compass, WifiOff, Wifi } from 'lucide-react'
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

  return (
    <div className="status-bar">
      <div className="status-item">
        <Gauge size={16} className="status-icon" />
        <span className="status-value">{position ? formatSpeed(position.speed, speedUnit) : '--'}</span>
        <span className="status-unit">{speedUnit === 'kn' ? 'kn' : 'km/t'}</span>
      </div>

      <div className="status-divider" />

      <div className="status-item">
        <Compass size={16} className="status-icon" />
        <span className="status-value">{position ? headingLabel(position.heading) : '--'}</span>
        <span className="status-unit">{position ? `${Math.round(position.heading)}°` : ''}</span>
      </div>

      <div className="status-divider" />

      <div className="status-item">
        <MapPin size={16} className="status-icon" />
        <span className="status-value">
          {position
            ? `${position.lat.toFixed(4)}°N ${position.lng.toFixed(4)}°E`
            : 'Ingen GPS'}
        </span>
      </div>

      {isTracking && (
        <>
          <div className="status-divider" />
          <div className="status-tracking">● REC</div>
        </>
      )}

      {tileSource && (
        <>
          <div className="status-divider" />
          <div className={`status-tile-source status-tile-${tileSource}`}>
            {tileSource === 'offline'
              ? <><WifiOff size={13} /> Offline</>
              : tileSource === 'mixed'
              ? <><WifiOff size={13} /> Blandet</>
              : <><Wifi size={13} /> Nett</>
            }
          </div>
        </>
      )}
    </div>
  )
}
