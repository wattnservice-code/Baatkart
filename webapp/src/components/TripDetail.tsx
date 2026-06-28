import { X, Play, Square, Trash2 } from 'lucide-react'
import { useMapStore } from '../store/useMapStore'
import { formatDist } from './NavOverlay'
import { iconEmoji } from '../spotIcons'
import type { SavedTrack } from '../store/useMapStore'

interface Props {
  track: SavedTrack
  following: boolean
  onClose: () => void
  onFollow: () => void
  onStop: () => void
  onDelete: () => void
}

function fmtDuration(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)
  if (h > 0) return `${h}t ${m.toString().padStart(2, '0')}m`
  return `${m}m ${sec.toString().padStart(2, '0')}s`
}
function fmtSpd(ms: number, unit: 'kn' | 'kmh'): string {
  if (ms <= 0) return '—'
  return unit === 'kn' ? `${(ms * 1.94384).toFixed(1)} kn` : `${(ms * 3.6).toFixed(1)} km/t`
}

// Bygg en aspekt-korrigert rute fra GPS-punktene (ingen lagring av bilde nødvendig)
function routePoints(points: { lat: number; lng: number }[], w: number, h: number, pad: number) {
  if (points.length < 2) return null
  const lats = points.map((p) => p.lat)
  const lngs = points.map((p) => p.lng)
  const meanLat = (Math.min(...lats) + Math.max(...lats)) / 2
  const k = Math.cos((meanLat * Math.PI) / 180) || 1
  const xs = lngs.map((l) => l * k)
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minLat = Math.min(...lats), maxLat = Math.max(...lats)
  const spanX = maxX - minX || 1e-6, spanY = maxLat - minLat || 1e-6
  const scale = Math.min((w - 2 * pad) / spanX, (h - 2 * pad) / spanY)
  const offX = (w - spanX * scale) / 2
  const offY = (h - spanY * scale) / 2
  const xy = points.map((p) => ({
    x: offX + (p.lng * k - minX) * scale,
    y: offY + (maxLat - p.lat) * scale,
  }))
  return {
    poly: xy.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '),
    start: xy[0],
    end: xy[xy.length - 1],
  }
}

export default function TripDetail({ track, following, onClose, onFollow, onStop, onDelete }: Props) {
  const distUnit  = useMapStore((s) => s.distUnit)
  const speedUnit = useMapStore((s) => s.speedUnit)

  const W = 300, H = 190
  const route = routePoints(track.points, W, H, 16)
  const date = new Date(track.date).toLocaleString('no-NO', {
    weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="trip-detail" onClick={(e) => e.stopPropagation()}>
        <div className="trip-detail-head">
          <span className="trip-detail-name">{iconEmoji(track.icon)} {track.name}</span>
          <button className="trip-detail-close" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="trip-detail-date">{date}</div>

        <div className="trip-detail-map">
          {route ? (
            <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H}>
              <polyline points={route.poly} className="trip-route-line" />
              <circle cx={route.start.x} cy={route.start.y} r="5" className="trip-route-start" />
              <circle cx={route.end.x} cy={route.end.y} r="5" className="trip-route-end" />
            </svg>
          ) : (
            <div className="trip-detail-noroute">Ingen rute lagret</div>
          )}
        </div>

        <div className="trip-detail-stats">
          <div className="trip-detail-stat">
            <span className="trip-detail-stat-label">Distanse</span>
            <span className="trip-detail-stat-val">{formatDist(track.distanceM, distUnit)}</span>
          </div>
          <div className="trip-detail-stat">
            <span className="trip-detail-stat-label">Tid</span>
            <span className="trip-detail-stat-val">{track.durationS != null ? fmtDuration(track.durationS) : '—'}</span>
          </div>
          <div className="trip-detail-stat">
            <span className="trip-detail-stat-label">Snitt</span>
            <span className="trip-detail-stat-val">{track.avgSpeedMs != null ? fmtSpd(track.avgSpeedMs, speedUnit) : '—'}</span>
          </div>
          <div className="trip-detail-stat">
            <span className="trip-detail-stat-label">Maks</span>
            <span className="trip-detail-stat-val">{track.maxSpeedMs != null ? fmtSpd(track.maxSpeedMs, speedUnit) : '—'}</span>
          </div>
        </div>

        <div className="trip-detail-actions">
          {following ? (
            <button className="trip-detail-btn trip-detail-stop" onClick={onStop}>
              <Square size={18} /> Stopp følging
            </button>
          ) : (
            <button className="trip-detail-btn trip-detail-follow" onClick={onFollow}>
              <Play size={18} /> Følg ruten
            </button>
          )}
          <button className="trip-detail-btn trip-detail-del" onClick={onDelete}>
            <Trash2 size={18} /> Slett
          </button>
        </div>
      </div>
    </div>
  )
}
