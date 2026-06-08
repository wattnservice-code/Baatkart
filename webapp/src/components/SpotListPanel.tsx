import { useState } from 'react'
import { X, Navigation, Trash2, RouteIcon, LocateFixed, Map } from 'lucide-react'
import { useMapStore } from '../store/useMapStore'

interface Props {
  onClose: () => void
  onAddGps?: () => void
  onAddMap?: () => void
}

export default function SpotListPanel({ onClose, onAddGps, onAddMap }: Props) {
  const savedSpots    = useMapStore((s) => s.savedSpots)
  const position      = useMapStore((s) => s.position)
  const removeSpot    = useMapStore((s) => s.removeSpot)
  const setFlyTo      = useMapStore((s) => s.setFlyTo)
  const setNavPreview = useMapStore((s) => s.setNavPreview)

  const [query, setQuery]       = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const filtered = savedSpots.filter((s) =>
    s.name.toLowerCase().includes(query.toLowerCase())
  )
  const confirmSpot = savedSpots.find((s) => s.id === confirmId)

  const goTo     = (lat: number, lng: number) => { setFlyTo({ lat, lng }); onClose() }
  const navigate = (lat: number, lng: number, name: string) => { setNavPreview({ lat, lng, name }); onClose() }

  const handleAddGps = () => { onClose(); onAddGps?.() }
  const handleAddMap = () => { onClose(); onAddMap?.() }

  return (
    <>
      <div className="spot-panel">
        <div className="spot-panel-header">
          <span>Steder</span>
          <button onClick={onClose}><X size={18} /></button>
        </div>

        {/* Search */}
        <div className="spot-panel-search">
          <input
            className="spot-panel-search-input"
            placeholder="Søk i lagrede steder…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>

        {/* Saved spots list */}
        <div className="spot-panel-list">
          {filtered.length === 0 && (
            <div className="spot-panel-empty">
              {savedSpots.length === 0 ? 'Ingen steder lagret ennå' : 'Ingen treff'}
            </div>
          )}
          {filtered.map((spot) => (
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

        {/* Add new spot */}
        {(onAddGps || onAddMap) && (
          <div className="spot-panel-add">
            <div className="spot-panel-add-label">Legg til nytt sted</div>
            {onAddGps && (
              <button className="spot-panel-add-btn" onClick={handleAddGps} disabled={!position}>
                <LocateFixed size={16} /> Min posisjon nå
              </button>
            )}
            {onAddMap && (
              <button className="spot-panel-add-btn" onClick={handleAddMap}>
                <Map size={16} /> Velg på kartet
              </button>
            )}
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
