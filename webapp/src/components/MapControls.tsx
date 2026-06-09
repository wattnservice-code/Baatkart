import { useState } from 'react'
import { Navigation, Navigation2, MapPin, Menu, X, Play, Square, Trash2, Layers, Compass, List, Sun, Moon, Search, Gauge, Circle, Anchor, Wind, Waves, WifiOff, ChevronDown, ChevronUp, Ship, Plus, Minus, Flag } from 'lucide-react'
import { useMapStore } from '../store/useMapStore'
import { getMapInstance } from '../mapInstance'
import SpotListPanel from './SpotListPanel'
import SearchBar from './SearchBar'
import SpotDialog from './SpotDialog'
import AnchorDialog from './AnchorDialog'
import OfflinePanel from './OfflinePanel'
import BoatInfoPanel from './BoatInfoPanel'

function formatRingLabel(r: null | number): string {
  if (r === null) return 'Auto'
  return r >= 1000 ? `${r / 1000} km` : `${r} m`
}

export default function MapControls() {
  const [menuOpen, setMenuOpen]           = useState(false)
  const [spotListOpen, setSpotListOpen]   = useState(false)
  const [searchOpen, setSearchOpen]       = useState(false)
  const [offlineOpen, setOfflineOpen]     = useState(false)
  const [boatInfoOpen, setBoatInfoOpen]   = useState(false)
  const [gpsSpot, setGpsSpot]             = useState<{ lat: number; lng: number } | null>(null)
  const [confirmTrack, setConfirmTrack]   = useState(false)
  const [anchorOpen, setAnchorOpen]       = useState(false)

  const [sections, setSections] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem('menuSections') || '{}') } catch { return {} }
  })
  const isOpen = (key: string, def = true) => sections[key] ?? def
  const toggleSec = (key: string, def = true) => setSections((prev) => {
    const next = { ...prev, [key]: !(prev[key] ?? def) }
    localStorage.setItem('menuSections', JSON.stringify(next))
    return next
  })

  const followBoat       = useMapStore((s) => s.followBoat)
  const addingSpot       = useMapStore((s) => s.addingSpot)
  const isTracking       = useMapStore((s) => s.isTracking)
  const track            = useMapStore((s) => s.track)
  const savedSpots       = useMapStore((s) => s.savedSpots)
  const mobPoint         = useMapStore((s) => s.mobPoint)
  const position         = useMapStore((s) => s.position)
  const compassEnabled   = useMapStore((s) => s.compassEnabled)
  const darkMode         = useMapStore((s) => s.darkMode)
  const speedUnit        = useMapStore((s) => s.speedUnit)
  const customRingRadius = useMapStore((s) => s.customRingRadius)
  const setFollowBoat    = useMapStore((s) => s.setFollowBoat)
  const setAddingSpot    = useMapStore((s) => s.setAddingSpot)
  const startTracking    = useMapStore((s) => s.startTracking)
  const stopTracking     = useMapStore((s) => s.stopTracking)
  const clearTrack       = useMapStore((s) => s.clearTrack)
  const setMob           = useMapStore((s) => s.setMob)
  const seamarkVisible   = useMapStore((s) => s.seamarkVisible)
  const anchorPoint      = useMapStore((s) => s.anchorPoint)
  const clearAnchor      = useMapStore((s) => s.clearAnchor)
  const weatherVisible   = useMapStore((s) => s.weatherVisible)
  const tideVisible      = useMapStore((s) => s.tideVisible)
  const toggleCompass    = useMapStore((s) => s.toggleCompass)
  const toggleDarkMode   = useMapStore((s) => s.toggleDarkMode)
  const toggleSeamark    = useMapStore((s) => s.toggleSeamark)
  const toggleWeather    = useMapStore((s) => s.toggleWeather)
  const toggleTide       = useMapStore((s) => s.toggleTide)
  const distUnit           = useMapStore((s) => s.distUnit)
  const lookAhead          = useMapStore((s) => s.lookAhead)
  const waypoints          = useMapStore((s) => s.waypoints)
  const addingWaypoint     = useMapStore((s) => s.addingWaypoint)
  const toggleSpeedUnit    = useMapStore((s) => s.toggleSpeedUnit)
  const cycleDistUnit      = useMapStore((s) => s.cycleDistUnit)
  const cycleRingRadius    = useMapStore((s) => s.cycleRingRadius)
  const toggleLookAhead    = useMapStore((s) => s.toggleLookAhead)
  const setAddingWaypoint  = useMapStore((s) => s.setAddingWaypoint)
  const clearWaypoints     = useMapStore((s) => s.clearWaypoints)
  const removeWaypoint     = useMapStore((s) => s.removeWaypoint)

  const handleMob = () => {
    if (mobPoint || !position) return
    navigator.vibrate?.([200, 100, 200, 100, 400])
    setMob({ lat: position.lat, lng: position.lng })
  }

  const handlePinBtn = () => {
    if (addingSpot) { setAddingSpot(false); return }
    setSpotListOpen(true)
    setMenuOpen(false)
  }

  const useGpsPos = () => {
    if (position) setGpsSpot({ lat: position.lat, lng: position.lng })
  }

  const useMapPos = () => {
    setAddingSpot(true)
  }

  return (
    <>
      {addingSpot && (
        <div className="map-banner">
          <span>Trykk på kartet for å lagre sted</span>
          <button onClick={() => setAddingSpot(false)}><X size={18} /></button>
        </div>
      )}
      {addingWaypoint && (
        <div className="map-banner" style={{ background: '#7c3aed' }}>
          <span>Trykk på kartet for å legge til waypoint</span>
          <button onClick={() => setAddingWaypoint(false)}><X size={18} /></button>
        </div>
      )}

      <button className={`mob-btn ${mobPoint ? 'mob-btn-active' : ''}`} onClick={handleMob} title="Mann over bord" disabled={!!mobPoint}>
        MOB
      </button>

      <div className="map-controls">
        <button className="fab" onClick={() => getMapInstance()?.zoomIn()} title="Zoom inn">
          <Plus size={22} />
        </button>
        <button className="fab" onClick={() => getMapInstance()?.zoomOut()} title="Zoom ut">
          <Minus size={22} />
        </button>
        <button
          className={`fab ${lookAhead ? 'fab-active' : ''}`}
          onClick={() => toggleLookAhead()}
          title={lookAhead ? 'Fremovervisning på' : 'Fremovervisning av'}
        >
          <Navigation2 size={22} />
        </button>
        <button className={`fab ${followBoat ? 'fab-active' : ''}`} onClick={() => {
          setFollowBoat(true)
          const m = getMapInstance()
          if (m && m.getZoom() < 14) m.setZoom(14)
        }} title="Sentrer kart">
          <Navigation size={22} />
        </button>
        <button className={`fab ${addingSpot || spotListOpen ? 'fab-active' : ''}`} onClick={handlePinBtn} title="Steder">
          <MapPin size={22} />
        </button>
        <button className={`fab ${menuOpen ? 'fab-active' : ''}`} onClick={() => {
          const opening = !menuOpen
          setMenuOpen(opening)
          if (opening) { setSpotListOpen(false); setSearchOpen(false); setOfflineOpen(false) }
        }} title="Meny">
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {menuOpen && (
        <div className="menu-backdrop" onClick={() => setMenuOpen(false)} />
      )}

      {menuOpen && (
        <div className="menu-panel">
          <div className="menu-title">Meny</div>

          <div className="menu-divider" />
          <button className="menu-section-toggle" onClick={() => toggleSec('nav')}>
            <span>Navigasjon</span>
            {isOpen('nav') ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          {isOpen('nav') && (
            <button className="menu-item" onClick={() => { setFollowBoat(true); setMenuOpen(false) }}>
              <Navigation size={20} /><span>Sentrer kart på båt</span>
            </button>
          )}

          <div className="menu-divider" />
          <button className="menu-section-toggle" onClick={() => toggleSec('sporing')}>
            <span>Sporing</span>
            {isOpen('sporing') ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          {isOpen('sporing') && (<>
            {!isTracking ? (
              <button className="menu-item" style={{ color: '#4ade80' }} onClick={() => { startTracking(); setMenuOpen(false) }}>
                <Play size={20} /><span>Start spor</span>
              </button>
            ) : (
              <button className="menu-item" style={{ color: '#f87171' }} onClick={() => { stopTracking(); setMenuOpen(false) }}>
                <Square size={20} /><span>Stopp spor</span>
              </button>
            )}
            {track.length > 0 && (
              <button className="menu-item" style={{ color: '#94a3b8' }} onClick={() => { setConfirmTrack(true); setMenuOpen(false) }}>
                <Trash2 size={20} /><span>Slett spor ({track.length} pkt)</span>
              </button>
            )}
          </>)}

          <div className="menu-divider" />
          <button className="menu-section-toggle" onClick={() => toggleSec('steder')}>
            <span>Steder</span>
            {isOpen('steder') ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          {isOpen('steder') && (<>
            <button className="menu-item" onClick={() => { setSpotListOpen(true); setMenuOpen(false) }}>
              <List size={20} /><span>Lagrede steder ({savedSpots.length})</span>
            </button>
            <button className="menu-item" onClick={() => { setSearchOpen(true); setMenuOpen(false) }}>
              <Search size={20} /><span>Søk etter sted</span>
            </button>
          </>)}

          <div className="menu-divider" />
          <button className="menu-section-toggle" onClick={() => toggleSec('offline')}>
            <span>Offline</span>
            {isOpen('offline') ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          {isOpen('offline') && (
            <button className="menu-item" onClick={() => { setOfflineOpen(true); setMenuOpen(false) }}>
              <WifiOff size={20} /><span>Last ned kart offline</span>
            </button>
          )}

          <div className="menu-divider" />
          <button className="menu-section-toggle" onClick={() => toggleSec('kart')}>
            <span>Kart og vær</span>
            {isOpen('kart') ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          {isOpen('kart') && (<>
            <button className="menu-item" style={{ color: compassEnabled ? '#60a5fa' : undefined }} onClick={() => { toggleCompass(); setMenuOpen(false) }}>
              <Compass size={20} /><span>Kompass {compassEnabled ? '(på)' : '(av)'}</span>
            </button>
            <button className="menu-item" onClick={() => { toggleDarkMode(); setMenuOpen(false) }}>
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
              <span>{darkMode ? 'Dagmodus' : 'Nattmodus'}</span>
            </button>
            <button className="menu-item" onClick={() => cycleRingRadius()}>
              <Circle size={20} /><span>Avstandsring: {formatRingLabel(customRingRadius)}</span>
            </button>
            <button className="menu-item" style={{ color: weatherVisible ? '#60a5fa' : undefined }} onClick={() => toggleWeather()}>
              <Wind size={20} /><span>Vær og vind {weatherVisible ? '(på)' : '(av)'}</span>
            </button>
            <button className="menu-item" style={{ color: tideVisible ? '#60a5fa' : undefined }} onClick={() => toggleTide()}>
              <Waves size={20} /><span>Tidevann {tideVisible ? '(på)' : '(av)'}</span>
            </button>
          </>)}

          <div className="menu-divider" />
          <button className="menu-section-toggle" onClick={() => toggleSec('waypoints', false)}>
            <span>Waypoints {waypoints.length > 0 ? `(${waypoints.length})` : ''}</span>
            {isOpen('waypoints', false) ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          {isOpen('waypoints', false) && (<>
            <button className="menu-item" style={{ color: addingWaypoint ? '#a78bfa' : undefined }} onClick={() => { setAddingWaypoint(!addingWaypoint); setMenuOpen(false) }}>
              <Flag size={20} /><span>{addingWaypoint ? 'Avbryt waypoint' : 'Legg til waypoint'}</span>
            </button>
            {waypoints.map((wp, i) => (
              <div key={wp.id} className="menu-item" style={{ justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="waypoint-pin-inline">{i + 1}</span>
                  {wp.name}
                </span>
                <button style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4 }}
                  onClick={() => removeWaypoint(wp.id)}>
                  <X size={14} />
                </button>
              </div>
            ))}
            {waypoints.length > 0 && (
              <button className="menu-item" style={{ color: '#f87171' }} onClick={() => clearWaypoints()}>
                <Trash2 size={20} /><span>Slett alle waypoints</span>
              </button>
            )}
          </>)}

          <div className="menu-divider" />
          <button className="menu-section-toggle" onClick={() => toggleSec('anker')}>
            <span>Anker</span>
            {isOpen('anker') ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          {isOpen('anker') && (
            !anchorPoint ? (
              <button className="menu-item" style={{ color: '#f59e0b' }} onClick={() => { setAnchorOpen(true); setMenuOpen(false) }}>
                <Anchor size={20} /><span>Sett anker</span>
              </button>
            ) : (
              <button className="menu-item" style={{ color: '#94a3b8' }} onClick={() => { clearAnchor(); setMenuOpen(false) }}>
                <Anchor size={20} /><span>Løft anker</span>
              </button>
            )
          )}

          <div className="menu-divider" />
          <button className="menu-section-toggle" onClick={() => toggleSec('innstillinger')}>
            <span>Innstillinger</span>
            {isOpen('innstillinger') ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          {isOpen('innstillinger') && (<>
            <button className="menu-item" onClick={() => { setBoatInfoOpen(true); setMenuOpen(false) }}>
              <Ship size={20} /><span>Båtinfo</span>
            </button>
            <button className="menu-item" style={{ color: seamarkVisible ? '#60a5fa' : undefined }} onClick={() => toggleSeamark()}>
              <Layers size={20} /><span>Sjømerke {seamarkVisible ? '(på)' : '(av)'}</span>
            </button>
            <button className="menu-item" onClick={() => toggleSpeedUnit()}>
              <Gauge size={20} /><span>Fart: {speedUnit === 'kn' ? 'Knop → km/t' : 'km/t → Knop'}</span>
            </button>
            <button className="menu-item" onClick={() => cycleDistUnit()}>
              <Gauge size={20} /><span>Avstand: {distUnit === 'nm' ? 'nm → m' : distUnit === 'm' ? 'm → km' : 'km → nm'}</span>
            </button>
          </>)}
        </div>
      )}

      {offlineOpen && <OfflinePanel onClose={() => setOfflineOpen(false)} />}
      {boatInfoOpen && <BoatInfoPanel onClose={() => setBoatInfoOpen(false)} />}

      {spotListOpen && (
        <SpotListPanel
          onClose={() => setSpotListOpen(false)}
          onAddGps={useGpsPos}
          onAddMap={useMapPos}
        />
      )}
      {searchOpen && <SearchBar onClose={() => setSearchOpen(false)} />}
      {gpsSpot && <SpotDialog lat={gpsSpot.lat} lng={gpsSpot.lng} onClose={() => setGpsSpot(null)} />}
      {anchorOpen && <AnchorDialog onClose={() => setAnchorOpen(false)} />}

      {confirmTrack && (
        <div className="dialog-overlay" onClick={() => setConfirmTrack(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">Slett spor</div>
            <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 16 }}>
              Slette sporet ({track.length} punkter)?
            </p>
            <div className="dialog-actions">
              <button className="btn-secondary" onClick={() => setConfirmTrack(false)}>Avbryt</button>
              <button className="btn-primary" style={{ background: '#dc2626' }} onClick={() => { clearTrack(); setConfirmTrack(false) }}>
                <Trash2 size={15} /> Slett
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
