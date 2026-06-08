import { useMapStore } from '../store/useMapStore'
import { formatDist } from './NavOverlay'

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000
  const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180
  const Δφ = (lat2 - lat1) * Math.PI / 180, Δλ = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(Δφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

export default function NavPreviewBar() {
  const navPreview    = useMapStore((s) => s.navPreview)
  const position      = useMapStore((s) => s.position)
  const distUnit      = useMapStore((s) => s.distUnit)
  const confirmNav    = useMapStore((s) => s.confirmNav)
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
        <button className="nav-preview-start" onClick={confirmNav}>▶ Start navigering</button>
      </div>
    </div>
  )
}
