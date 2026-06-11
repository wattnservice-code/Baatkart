import { useState, useEffect, useRef } from 'react'
import { Navigation, MapPin, X, Play, Square, Trash2, Layers, Compass, Sun, Moon, Search, Gauge, Circle, Wind, Waves, WifiOff, Ship, Plus, Minus, Globe, Zap, Settings, Map, Bookmark } from 'lucide-react'
import { getCurrentBearing } from '../currentBearing'
import { useOnline } from '../hooks/useOnline'
import { openGoogleEarth, openGoogleMaps } from '../googleEarth'
import { formatDist } from './NavOverlay'
import { useMapStore } from '../store/useMapStore'
import { getMapInstance } from '../mapInstance'
import SpotListPanel from './SpotListPanel'
import SearchBar from './SearchBar'
import SpotDialog from './SpotDialog'
import OfflinePanel from './OfflinePanel'
import BoatInfoPanel from './BoatInfoPanel'

function formatRingLabel(r: null | number): string {
  if (r === null) return 'Auto'
  return r >= 1000 ? `${r / 1000} km` : `${r} m`
}

function distanceM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000
  const φ1 = (aLat * Math.PI) / 180, φ2 = (bLat * Math.PI) / 180
  const dφ = ((bLat - aLat) * Math.PI) / 180, dλ = ((bLng - aLng) * Math.PI) / 180
  const x = Math.sin(dφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(x))
}

// Returns formatted ETA string or null if speed is too low to be meaningful
function formatEta(distM: number, speedMs: number): string | null {
  if (speedMs < 0.5) return null  // ~1 knot threshold; below this = stationary
  const secs = distM / speedMs
  const h = Math.floor(secs / 3600)
  const m = Math.round((secs % 3600) / 60)
  if (h === 0) return `${m} min`
  return `${h} t ${m} min`
}

function CompassRose({ headingUp }: { headingUp: boolean }) {
  const elRef  = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const el = elRef.current
    if (!el) return
    const loop = () => {
      // Rotate the N indicator opposite to the map so it always points to true north
      el.style.transform = headingUp ? `rotate(${-getCurrentBearing()}deg)` : ''
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [headingUp])

  return (
    <div ref={elRef} className="compass-rose">
      <span className="compass-n">N</span>
      <div className="compass-needle" />
    </div>
  )
}

const subheadStyle: React.CSSProperties = {
  padding: '8px 16px 2px', fontSize: 11, fontWeight: 700,
  color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px',
}

export default function MapControls() {
  const [actionsOpen, setActionsOpen]     = useState(false)
  const [settingsOpen, setSettingsOpen]   = useState(false)
  const [spotListOpen, setSpotListOpen]   = useState(false)
  const [searchOpen, setSearchOpen]       = useState(false)
  const [offlineOpen, setOfflineOpen]     = useState(false)
  const [boatInfoOpen, setBoatInfoOpen]   = useState(false)
  const [gpsSpot, setGpsSpot]             = useState<{ lat: number; lng: number } | null>(null)
  const [confirmTrack, setConfirmTrack]   = useState(false)

  const closeMenus = () => { setActionsOpen(false); setSettingsOpen(false) }

  const isOnline         = useOnline()
  const headingUp        = useMapStore((s) => s.headingUp)
  const toggleHeadingUp  = useMapStore((s) => s.toggleHeadingUp)
  const followBoat       = useMapStore((s) => s.followBoat)
  const addingSpot       = useMapStore((s) => s.addingSpot)
  const isTracking       = useMapStore((s) => s.isTracking)
  const track            = useMapStore((s) => s.track)
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
  const weatherVisible   = useMapStore((s) => s.weatherVisible)
  const tideVisible      = useMapStore((s) => s.tideVisible)
  const toggleCompass    = useMapStore((s) => s.toggleCompass)
  const toggleDarkMode   = useMapStore((s) => s.toggleDarkMode)
  const toggleSeamark    = useMapStore((s) => s.toggleSeamark)
  const toggleWeather    = useMapStore((s) => s.toggleWeather)
  const toggleTide       = useMapStore((s) => s.toggleTide)
  const distUnit           = useMapStore((s) => s.distUnit)
  const toggleSpeedUnit    = useMapStore((s) => s.toggleSpeedUnit)
  const cycleDistUnit      = useMapStore((s) => s.cycleDistUnit)
  const cycleRingRadius    = useMapStore((s) => s.cycleRingRadius)
  const spotMenu           = useMapStore((s) => s.spotMenu)
  const setSpotMenu        = useMapStore((s) => s.setSpotMenu)
  const setNavPreview      = useMapStore((s) => s.setNavPreview)
  const setSearchPin       = useMapStore((s) => s.setSearchPin)
  const removeSpot         = useMapStore((s) => s.removeSpot)

  const handleCompassToggle = async () => {
    if (!compassEnabled) {
      // iOS requires requestPermission() from a synchronous user-gesture context.
      // Calling it here (directly in onClick) satisfies that requirement, so the
      // dialog only appears once per session instead of on every app restart.
      const DevOr = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }
      if (typeof DevOr.requestPermission === 'function') {
        try {
          const perm = await DevOr.requestPermission()
          if (perm !== 'granted') return
        } catch {
          return
        }
      }
    }
    toggleCompass()
  }

  // Close the card. For a dropped/search pin (no saved id) also remove the
  // blue pin from the map; for a saved spot just close (keep its yellow pin).
  const closeSpotMenu = () => {
    if (spotMenu && !spotMenu.id) setSearchPin(null)
    setSpotMenu(null)
  }

  const handleMob = () => {
    if (mobPoint || !position) return
    navigator.vibrate?.([200, 100, 200, 100, 400])
    setMob({ lat: position.lat, lng: position.lng })
  }

  const handlePinBtn = () => {
    if (addingSpot) { setAddingSpot(false); return }
    setSpotListOpen(true)
    closeMenus()
  }

  const useGpsPos = () => {
    if (position) setGpsSpot({ lat: position.lat, lng: position.lng })
  }

  const useMapPos = () => {
    setAddingSpot(true)
  }

  const openActions = () => {
    const o = !actionsOpen
    setActionsOpen(o); setSettingsOpen(false)
    if (o) { setSpotListOpen(false); setSearchOpen(false); setOfflineOpen(false) }
  }

  const openSettings = () => {
    const o = !settingsOpen
    setSettingsOpen(o); setActionsOpen(false)
    if (o) { setSpotListOpen(false); setSearchOpen(false); setOfflineOpen(false) }
  }

  return (
    <>
      {addingSpot && (
        <div className="map-banner">
          <span>Trykk på kartet for å lagre sted</span>
          <button onClick={() => setAddingSpot(false)}><X size={18} /></button>
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
        <button className={`fab ${followBoat ? 'fab-active' : ''}`} onClick={() => {
          setFollowBoat(true)
          const m = getMapInstance()
          if (m && m.getZoom() < 14) m.setZoom(14)
        }} title="Sentrer kart">
          <Navigation size={22} />
        </button>
        <button
          className={`fab compass-fab ${headingUp ? 'fab-active' : ''}`}
          onClick={toggleHeadingUp}
          title={headingUp ? 'Kursretning opp – bytt til Nord opp' : 'Nord opp – bytt til Kursretning opp'}
        >
          <CompassRose headingUp={headingUp} />
        </button>
        <button className={`fab ${addingSpot || spotListOpen ? 'fab-active' : ''}`} onClick={handlePinBtn} title="Steder">
          <MapPin size={22} />
        </button>
        <button className={`fab ${actionsOpen ? 'fab-active' : ''}`} onClick={openActions} title="Handlinger">
          {actionsOpen ? <X size={22} /> : <Zap size={22} />}
        </button>
        <button className={`fab ${settingsOpen ? 'fab-active' : ''}`} onClick={openSettings} title="Innstillinger">
          {settingsOpen ? <X size={22} /> : <Settings size={22} />}
        </button>
      </div>

      {(actionsOpen || settingsOpen) && (
        <div className="menu-backdrop" onClick={closeMenus} />
      )}

      {/* ── Handlinger ── */}
      {actionsOpen && (
        <div className="menu-panel">
          <div className="menu-title">⚡ Handlinger</div>

          <div style={subheadStyle}>Sporing</div>
          {!isTracking ? (
            <button className="menu-item" style={{ color: '#4ade80' }} onClick={() => { startTracking(); closeMenus() }}>
              <Play size={20} /><span>Start spor</span>
            </button>
          ) : (
            <button className="menu-item" style={{ color: '#f87171' }} onClick={() => { stopTracking(); closeMenus() }}>
              <Square size={20} /><span>Stopp spor</span>
            </button>
          )}
          {track.length > 0 && (
            <button className="menu-item" style={{ color: '#94a3b8' }} onClick={() => { setConfirmTrack(true); closeMenus() }}>
              <Trash2 size={20} /><span>Slett spor ({track.length} pkt)</span>
            </button>
          )}

          <div className="menu-divider" />
          <div style={subheadStyle}>Steder</div>
          <button className="menu-item" onClick={() => { setSearchOpen(true); closeMenus() }}>
            <Search size={20} /><span>Søk etter sted</span>
          </button>

          <div className="menu-divider" />
          <div style={subheadStyle}>Kart</div>
          <button className="menu-item" onClick={() => { setOfflineOpen(true); closeMenus() }}>
            <WifiOff size={20} /><span>Last ned kart offline</span>
          </button>
          {isOnline && (
            <button className="menu-item" style={{ color: '#34d399' }} onClick={() => {
              const c = position ?? getMapInstance()?.getCenter() ?? { lat: 59.9, lng: 10.7 }
              openGoogleEarth(c.lat, c.lng)
              closeMenus()
            }}>
              <Globe size={20} /><span>Vis i Google Earth (3D)</span>
            </button>
          )}
        </div>
      )}

      {/* ── Innstillinger ── */}
      {settingsOpen && (
        <div className="menu-panel">
          <div className="menu-title">⚙️ Innstillinger</div>

          <div style={subheadStyle}>Båt</div>
          <button className="menu-item" onClick={() => { setBoatInfoOpen(true); closeMenus() }}>
            <Ship size={20} /><span>Båtinfo</span>
          </button>

          <div className="menu-divider" />
          <div style={subheadStyle}>Kartvisning</div>
          <button className="menu-item" onClick={() => { toggleDarkMode() }}>
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            <span>{darkMode ? 'Dagmodus' : 'Nattmodus'}</span>
          </button>
          <button className="menu-item" style={{ color: seamarkVisible ? '#60a5fa' : undefined }} onClick={() => toggleSeamark()}>
            <Layers size={20} /><span>Sjømerke {seamarkVisible ? '(på)' : '(av)'}</span>
          </button>
          <button className="menu-item" onClick={() => cycleRingRadius()}>
            <Circle size={20} /><span>Avstandsring: {formatRingLabel(customRingRadius)}</span>
          </button>

          <div className="menu-divider" />
          <div style={subheadStyle}>Sensorer og lag</div>
          <button className="menu-item" style={{ color: compassEnabled ? '#60a5fa' : undefined }} onClick={handleCompassToggle}>
            <Compass size={20} /><span>Kompass {compassEnabled ? '(på)' : '(av)'}</span>
          </button>
          <button className="menu-item" style={{ color: weatherVisible ? '#60a5fa' : undefined }} onClick={() => toggleWeather()}>
            <Wind size={20} /><span>Vær og vind {weatherVisible ? '(på)' : '(av)'}</span>
          </button>
          <button className="menu-item" style={{ color: tideVisible ? '#60a5fa' : undefined }} onClick={() => toggleTide()}>
            <Waves size={20} /><span>Tidevann {tideVisible ? '(på)' : '(av)'}</span>
          </button>

          <div className="menu-divider" />
          <div style={subheadStyle}>Enheter</div>
          <button className="menu-item" onClick={() => toggleSpeedUnit()}>
            <Gauge size={20} /><span>Fart: {speedUnit === 'kn' ? 'Knop → km/t' : 'km/t → Knop'}</span>
          </button>
          <button className="menu-item" onClick={() => cycleDistUnit()}>
            <Gauge size={20} /><span>Avstand: {distUnit === 'nm' ? 'nm → m' : distUnit === 'm' ? 'm → km' : 'km → nm'}</span>
          </button>
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

      {spotMenu && (
        <div className="spot-action-card">
          <div className="spot-action-head">
            <span className="spot-action-name">📍 {spotMenu.name}</span>
            <button className="spot-action-close" onClick={closeSpotMenu}><X size={18} /></button>
          </div>
          {position && (() => {
            const dist = distanceM(position.lat, position.lng, spotMenu.lat, spotMenu.lng)
            const eta  = formatEta(dist, position.speed ?? 0)
            return (
              <>
                <div className="spot-action-dist">
                  📏 {formatDist(dist, distUnit)} herfra
                  {eta && <span className="spot-action-eta">· ⏱ {eta}</span>}
                </div>
              </>
            )
          })()}
          <div className="spot-action-btns">
            <button className="spot-action-btn spot-action-nav" onClick={() => {
              setNavPreview({ lat: spotMenu.lat, lng: spotMenu.lng, name: spotMenu.name })
              setSpotMenu(null)
            }}>
              <Navigation size={18} /> Naviger hit
            </button>

            {isOnline && (
              <div className="spot-action-row">
                <button className="spot-action-btn spot-action-maps" onClick={() => {
                  openGoogleMaps(spotMenu.lat, spotMenu.lng)
                  setSpotMenu(null)
                }}>
                  <Map size={18} /> Google Maps
                </button>
                <button className="spot-action-btn spot-action-earth" onClick={() => {
                  openGoogleEarth(spotMenu.lat, spotMenu.lng)
                  setSpotMenu(null)
                }}>
                  <Globe size={18} /> Google Earth
                </button>
              </div>
            )}

            {!spotMenu.id ? (
              <button className="spot-action-btn spot-action-save" onClick={() => {
                setGpsSpot({ lat: spotMenu.lat, lng: spotMenu.lng })
                setSearchPin(null)
                setSpotMenu(null)
              }}>
                <Bookmark size={18} /> Lagre sted
              </button>
            ) : (
              <button className="spot-action-btn spot-action-remove" onClick={() => {
                removeSpot(spotMenu.id!)
                setSpotMenu(null)
              }}>
                <Trash2 size={18} /> Slett lagret sted
              </button>
            )}
          </div>
        </div>
      )}

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
