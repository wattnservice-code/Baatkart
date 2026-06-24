import { useMapStore } from '../store/useMapStore'
import { formatDist } from './NavOverlay'
import { haversineM } from '../geo'

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

  return (
    <div className="nav-preview-bar">
      <div className="nav-preview-info">
        <span className="nav-preview-name">📍 {navPreview.name}</span>
        {dist !== null && (
          <span className="nav-preview-dist">{formatDist(dist, distUnit)}</span>
        )}
      </div>

      <div className="nav-preview-actions">
        <button className="nav-preview-cancel" onClick={clearNavPreview}>Avbryt</button>
        <button className="nav-preview-start" onClick={confirmNav}>▶ Start</button>
      </div>
    </div>
  )
}
