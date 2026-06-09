import { Flag, X } from 'lucide-react'
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
  const navPreview        = useMapStore((s) => s.navPreview)
  const position          = useMapStore((s) => s.position)
  const distUnit          = useMapStore((s) => s.distUnit)
  const confirmNav        = useMapStore((s) => s.confirmNav)
  const clearNavPreview   = useMapStore((s) => s.clearNavPreview)
  const waypoints         = useMapStore((s) => s.waypoints)
  const removeWaypoint    = useMapStore((s) => s.removeWaypoint)
  const addingWaypoint    = useMapStore((s) => s.addingWaypoint)
  const setAddingWaypoint = useMapStore((s) => s.setAddingWaypoint)

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

      {waypoints.length > 0 && (
        <div className="nav-preview-waypoints">
          {waypoints.map((wp, i) => (
            <div key={wp.id} className="nav-preview-wp-item">
              <span className="nav-preview-wp-num">{i + 1}</span>
              <span className="nav-preview-wp-name">{wp.name}</span>
              <button className="nav-preview-wp-remove" onClick={() => removeWaypoint(wp.id)}>
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      )}

      {addingWaypoint && (
        <div className="nav-preview-hint">Trykk på kartet for å legge til waypoint</div>
      )}

      <div className="nav-preview-actions">
        <button className="nav-preview-cancel" onClick={clearNavPreview}>Avbryt</button>
        <button
          className={`nav-preview-wp-add${addingWaypoint ? ' active' : ''}`}
          onClick={() => setAddingWaypoint(!addingWaypoint)}
          title="Legg til waypoint på kartet"
        >
          <Flag size={13} /> WP
        </button>
        <button className="nav-preview-start" onClick={confirmNav}>▶ Start</button>
      </div>
    </div>
  )
}
