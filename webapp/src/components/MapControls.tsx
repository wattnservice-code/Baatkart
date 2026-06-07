import { useState } from 'react'
import { Navigation, Fish, Menu, X, Play, Square, Trash2, Layers } from 'lucide-react'
import { useMapStore } from '../store/useMapStore'

interface Props {
  onLayerToggle?: () => void
}

export default function MapControls({ onLayerToggle }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)

  const followBoat = useMapStore((s) => s.followBoat)
  const addingSpot = useMapStore((s) => s.addingSpot)
  const isTracking = useMapStore((s) => s.isTracking)
  const track = useMapStore((s) => s.track)
  const setFollowBoat = useMapStore((s) => s.setFollowBoat)
  const setAddingSpot = useMapStore((s) => s.setAddingSpot)
  const startTracking = useMapStore((s) => s.startTracking)
  const stopTracking = useMapStore((s) => s.stopTracking)
  const clearTrack = useMapStore((s) => s.clearTrack)

  return (
    <>
      {/* Add-spot mode banner */}
      {addingSpot && (
        <div className="map-banner">
          <span>Trykk på kartet for å legge til fiskeplass</span>
          <button onClick={() => setAddingSpot(false)}><X size={18} /></button>
        </div>
      )}

      {/* Floating controls */}
      <div className="map-controls">
        {/* Center/follow boat */}
        <button
          className={`fab ${followBoat ? 'fab-active' : ''}`}
          onClick={() => setFollowBoat(true)}
          title="Sentrer kart på båt"
        >
          <Navigation size={22} />
        </button>

        {/* Add fishing spot */}
        <button
          className={`fab ${addingSpot ? 'fab-active' : ''}`}
          onClick={() => { setAddingSpot(!addingSpot); setMenuOpen(false) }}
          title="Legg til fiskeplass"
        >
          <Fish size={22} />
        </button>

        {/* Menu */}
        <button
          className={`fab ${menuOpen ? 'fab-active' : ''}`}
          onClick={() => setMenuOpen(!menuOpen)}
          title="Meny"
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Menu panel */}
      {menuOpen && (
        <div className="menu-panel">
          <div className="menu-title">Meny</div>

          <button className="menu-item" onClick={() => { setFollowBoat(true); setMenuOpen(false) }}>
            <Navigation size={20} />
            <span>Sentrer kart på båt</span>
          </button>

          <div className="menu-divider" />

          <div className="menu-section">Sporing</div>
          {!isTracking ? (
            <button className="menu-item text-green-400" onClick={() => { startTracking(); setMenuOpen(false) }}>
              <Play size={20} />
              <span>Start spor</span>
            </button>
          ) : (
            <button className="menu-item text-red-400" onClick={() => { stopTracking(); setMenuOpen(false) }}>
              <Square size={20} />
              <span>Stopp spor</span>
            </button>
          )}
          {track.length > 0 && (
            <button className="menu-item text-slate-400" onClick={() => { clearTrack(); setMenuOpen(false) }}>
              <Trash2 size={20} />
              <span>Slett spor ({track.length} pkt)</span>
            </button>
          )}

          <div className="menu-divider" />

          <button className="menu-item" onClick={() => { onLayerToggle?.(); setMenuOpen(false) }}>
            <Layers size={20} />
            <span>Bytt kartlag</span>
          </button>
        </div>
      )}
    </>
  )
}
