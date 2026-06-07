import { Gauge, MapPin } from 'lucide-react'
import { useMapStore } from '../store/useMapStore'

function msToKnots(ms: number) {
  return (ms * 1.94384).toFixed(1)
}

export default function StatusBar() {
  const position = useMapStore((s) => s.position)
  const isTracking = useMapStore((s) => s.isTracking)

  return (
    <div className="status-bar">
      <div className="status-item">
        <Gauge size={16} className="status-icon" />
        <span className="status-value">{position ? msToKnots(position.speed) : '--'}</span>
        <span className="status-unit">kn</span>
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
    </div>
  )
}
