import { useState } from 'react'
import { X, Navigation, Trash2, RouteIcon } from 'lucide-react'
import { useMapStore } from '../store/useMapStore'

interface Props { onClose: () => void }

export default function SpotListPanel({ onClose }: Props) {
  const savedSpots    = useMapStore((s) => s.savedSpots)
  const removeSpot    = useMapStore((s) => s.removeSpot)
  const setFlyTo      = useMapStore((s) => s.setFlyTo)
  const setNavPreview = useMapStore((s) => s.setNavPreview)

  const [confirmId, setConfirmId] = useState<string | null>(null)
  const confirmSpot = savedSpots.find((s) => s.id === confirmId)

  const goTo     = (lat: number, lng: number) => { setFlyTo({ lat, lng }); onClose() }
  const navigate  = (lat: number, lng: number, name: string) => { setNavPreview({ lat, lng, name }); onClose() }

  return (
    <>
      <div className="spot-panel">
        <div className="spot-panel-header">
          <span>Lagrede steder</span>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        {savedSpots.length === 0 ? (
          <div className="spot-panel-empty">Ingen steder lagret ennå</div>
        ) : (
          <div className="spot-panel-list">
            {savedSpots.map((spot) => (
              <div key={spot.id} className="spot-panel-item">
                <div className="spot-panel-info">
                  <span className="spot-panel-name">📍 {spot.name}</span>
                  <span className="spot-panel-coords">{spot.lat.toFixed(4)}°N {spot.lng.toFixed(4)}°E</span>
                </div>
                <div className="spot-panel-actions">
                  <button className="spot-panel-btn spot-panel-goto" onClick={() => goTo(spot.lat, spot.lng)} title="Vis på kart">
                    <Navigation size={15} />
                  </button>
                  <button className="spot-panel-btn spot-panel-nav" onClick={() => navigate(spot.lat, spot.lng, spot.name)} title="Naviger hit">
                    <RouteIcon size={15} />
                  </button>
                  <button className="spot-panel-btn spot-panel-delete" onClick={() => setConfirmId(spot.id)} title="Slett">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {confirmSpot && (
        <div className="dialog-overlay" onClick={() => setConfirmId(null)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">Slett sted</div>
            <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 16 }}>
              Slette <strong style={{ color: 'white' }}>"{confirmSpot.name}"</strong>?
            </p>
            <div className="dialog-actions">
              <button className="btn-secondary" onClick={() => setConfirmId(null)}>Avbryt</button>
              <button className="btn-primary" style={{ background: '#dc2626' }} onClick={() => { removeSpot(confirmSpot.id); setConfirmId(null) }}>
                <Trash2 size={15} /> Slett
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
