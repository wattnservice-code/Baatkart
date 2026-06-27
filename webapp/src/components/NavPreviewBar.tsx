import { useMapStore } from '../store/useMapStore'
import { formatDist } from './NavOverlay'
import { haversineM } from '../geo'

function calcEta(distM: number, speedMs: number): string | null {
  if (speedMs < 0.5) return null
  const eta = new Date(Date.now() + (distM / speedMs) * 1000)
  const hh = eta.getHours().toString().padStart(2, '0')
  const mm = eta.getMinutes().toString().padStart(2, '0')
  const mins = Math.round(distM / speedMs / 60)
  return `ETA ${hh}:${mm} (${mins} min)`
}

export default function NavPreviewBar() {
  const navPreview      = useMapStore((s) => s.navPreview)
  const position        = useMapStore((s) => s.position)
  const distUnit        = useMapStore((s) => s.distUnit)
  const confirmNav      = useMapStore((s) => s.confirmNav)
  const clearNavPreview = useMapStore((s) => s.clearNavPreview)

  if (!navPreview) return null

  const dist = position
    ? haversineM(position.lat, position.lng, navPreview.lat, navPreview.lng)
    : null

  const eta = dist !== null && position ? calcEta(dist, position.speed) : null

  return (
    <div className="nav-preview-bar">
      <div className="nav-preview-info">
        <span className="nav-preview-name">📍 {navPreview.name}</span>
        {dist !== null && (
          <span className="nav-preview-dist">{formatDist(dist, distUnit)}</span>
        )}
        {eta && <span className="nav-preview-eta">{eta}</span>}
      </div>

      <div className="nav-preview-actions">
        <button className="nav-preview-cancel" onClick={clearNavPreview}>Avbryt</button>
        <button className="nav-preview-start" onClick={confirmNav}>▶ Start</button>
      </div>
    </div>
  )
}
