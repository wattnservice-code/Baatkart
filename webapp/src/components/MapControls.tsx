import { useState, useEffect, useRef } from 'react'
import { Navigation, X, Plus, Minus, LocateFixed, Circle, Square, Globe, Map, Bookmark, Trash2, Sun, Moon, Ship, Eye } from 'lucide-react'
import { getCurrentBearing } from '../currentBearing'
import { useOnline } from '../hooks/useOnline'
import { openGoogleEarth, openGoogleMaps } from '../googleEarth'
import { formatDist } from './NavOverlay'
import { useMapStore } from '../store/useMapStore'
import { getMapInstance } from '../mapInstance'
import SpotListPanel from './SpotListPanel'
import SearchBar from './SearchBar'
import SpotDialog from './SpotDialog'
import SettingsPanel from './SettingsPanel'
import SaveTrackDialog from './SaveTrackDialog'

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

function CompassBtn({ active }: { active: boolean }) {
  const elRef  = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const el = elRef.current
    if (!el) return
    const loop = () => {
      // Rotate N to always point true north when kurs-opp is active
      el.style.transform = active ? `rotate(${-getCurrentBearing()}deg)` : ''
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [active])

  return (
    <div ref={elRef} className={`cmps-rose ${!active ? 'cmps-off' : ''}`}>
      <span className="cmps-n">N</span>
      <div className="cmps-needle" />
      {active && <span className="cmps-label">KRS</span>}
    </div>
  )
}

export default function MapControls() {
  const [gpsSpot, setGpsSpot]           = useState<{ lat: number; lng: number } | null>(null)
  const [showSaveTrack, setShowSaveTrack] = useState(false)

  const isOnline         = useOnline()
  const headingUp        = useMapStore((s) => s.headingUp)
  const toggleHeadingUp  = useMapStore((s) => s.toggleHeadingUp)
  const compassEnabled   = useMapStore((s) => s.compassEnabled)
  const toggleCompass    = useMapStore((s) => s.toggleCompass)
  const followBoat       = useMapStore((s) => s.followBoat)
  const addingSpot       = useMapStore((s) => s.addingSpot)
  const isTracking       = useMapStore((s) => s.isTracking)
  const position         = useMapStore((s) => s.position)
  const setFollowBoat    = useMapStore((s) => s.setFollowBoat)
  const setAddingSpot    = useMapStore((s) => s.setAddingSpot)
  const startTracking    = useMapStore((s) => s.startTracking)
  const stopTracking     = useMapStore((s) => s.stopTracking)
  const darkMode         = useMapStore((s) => s.darkMode)
  const toggleDarkMode   = useMapStore((s) => s.toggleDarkMode)
  const nightVision      = useMapStore((s) => s.nightVision)
  const toggleNightVision = useMapStore((s) => s.toggleNightVision)
  const aisVisible       = useMapStore((s) => s.aisVisible)
  const aisKey           = useMapStore((s) => s.aisKey)
  const toggleAis        = useMapStore((s) => s.toggleAis)
  const aisStatus        = useMapStore((s) => s.aisStatus)
  const speedUnit        = useMapStore((s) => s.speedUnit)
  const toggleSpeedUnit  = useMapStore((s) => s.toggleSpeedUnit)
  const distUnit         = useMapStore((s) => s.distUnit)
  const activePanel      = useMapStore((s) => s.activePanel)
  const setActivePanel   = useMapStore((s) => s.setActivePanel)
  const spotMenu         = useMapStore((s) => s.spotMenu)
  const setSpotMenu      = useMapStore((s) => s.setSpotMenu)
  const setNavPreview    = useMapStore((s) => s.setNavPreview)
  const setSearchPin     = useMapStore((s) => s.setSearchPin)
  const removeSpot       = useMapStore((s) => s.removeSpot)
  const track            = useMapStore((s) => s.track)

  // Close the card. For a dropped/search pin (no saved id) also remove the
  // blue pin from the map; for a saved spot just close (keep its yellow pin).
  const closeSpotMenu = () => {
    if (spotMenu && !spotMenu.id) setSearchPin(null)
    setSpotMenu(null)
  }

  const useGpsPos = () => { if (position) setGpsSpot({ lat: position.lat, lng: position.lng }) }
  const useMapPos = () => { setAddingSpot(true) }

  // 2-state toggle: OFF ↔ kurs-opp (compass on + heading-up)
  const handleCompassBtn = async () => {
    if (!compassEnabled) {
      const DevOr = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }
      if (typeof DevOr.requestPermission === 'function') {
        try { if (await DevOr.requestPermission() !== 'granted') return } catch { return }
      }
      toggleCompass()
      if (!headingUp) toggleHeadingUp()
    } else {
      // Turn everything off
      if (headingUp) toggleHeadingUp()
      toggleCompass()
    }
  }

  return (
    <>
      {addingSpot && (
        <div className="map-banner">
          <span>Trykk på kartet for å lagre sted</span>
          <button onClick={() => setAddingSpot(false)}><X size={18} /></button>
        </div>
      )}

      {/* AIS status pill — only while AIS is enabled */}
      {aisVisible && (
        <div className={`ais-status ais-status-${aisStatus.state}`}>
          {aisStatus.state === 'live'
            ? `🚢 ${aisStatus.count} fartøy`
            : aisStatus.state === 'warn'
            ? `${aisStatus.message} · ${aisStatus.count} fartøy`
            : aisStatus.state === 'connecting'
            ? `🚢 ${aisStatus.message}`
            : aisStatus.state === 'error'
            ? `⚠ AIS: ${aisStatus.message}`
            : '🚢 AIS av'}
        </div>
      )}

      {/* Speed badge — top-left, grows at ≥ 3 kn */}
      {position && position.speed > 0 && (() => {
        const spd = speedUnit === 'kn' ? position.speed * 1.94384 : position.speed * 3.6
        const unit = speedUnit === 'kn' ? 'kn' : 'km/t'
        const fast = position.speed * 1.94384 >= 3
        return (
          <button className={`speed-badge ${fast ? 'speed-badge-fast' : 'speed-badge-slow'}`} onClick={toggleSpeedUnit} title="Trykk for å bytte enhet">
            <span className="speed-badge-val">{spd.toFixed(1)}</span>
            <span className="speed-badge-unit">{unit}</span>
          </button>
        )
      })()}

      <div className="map-controls">
        <button
          className={`fab compass-fab ${compassEnabled ? 'cmps-btn-krs' : ''}`}
          onClick={handleCompassBtn}
          title={compassEnabled ? 'Kurs opp aktiv – trykk for å slå av' : 'Trykk for kurs opp'}
        >
          <CompassBtn active={compassEnabled} />
        </button>
        {aisKey && (
          <button
            className={`fab ${aisVisible ? 'fab-active' : ''}`}
            onClick={toggleAis}
            title={aisVisible ? 'Skjul AIS-fartøy' : 'Vis AIS-fartøy'}
          >
            <Ship size={20} />
          </button>
        )}
        <button
          className={`fab ${!darkMode ? 'fab-active' : ''}`}
          onClick={toggleDarkMode}
          title={darkMode ? 'Bytt til dagmodus' : 'Bytt til nattmodus'}
        >
          {darkMode ? <Sun size={22} /> : <Moon size={22} />}
        </button>
        <button
          className={`fab ${nightVision ? 'fab-nightvision' : ''}`}
          onClick={toggleNightVision}
          title={nightVision ? 'Slå av nattmodus' : 'Nattmodus (rødt lys)'}
        >
          <Eye size={20} />
        </button>
        <div className="fab-divider" />
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
          <LocateFixed size={22} />
        </button>
        <button
          className={`fab ${isTracking ? 'fab-rec' : ''}`}
          onClick={() => {
            if (isTracking) {
              stopTracking()
              if (track.length > 0) setShowSaveTrack(true)
            } else {
              startTracking()
            }
          }}
          title={isTracking ? 'Stopp sporing' : 'Start sporing'}
        >
          {isTracking ? <Square size={20} /> : <Circle size={22} />}
        </button>
      </div>

      {activePanel === 'spots' && (
        <SpotListPanel
          onClose={() => setActivePanel(null)}
          onAddGps={useGpsPos}
          onAddMap={useMapPos}
        />
      )}
      {activePanel === 'search' && <SearchBar onClose={() => setActivePanel(null)} />}
      {activePanel === 'meg' && <SettingsPanel onClose={() => setActivePanel(null)} />}
      {gpsSpot && <SpotDialog lat={gpsSpot.lat} lng={gpsSpot.lng} onClose={() => setGpsSpot(null)} />}
      {showSaveTrack && <SaveTrackDialog onClose={() => setShowSaveTrack(false)} />}

      {spotMenu && <div className="spot-action-backdrop" onClick={closeSpotMenu} />}
      {spotMenu && (
        <div className="spot-action-card" onClick={(e) => e.stopPropagation()}>
          <div className="spot-action-head">
            <span className="spot-action-name">📍 {spotMenu.name}</span>
            <button className="spot-action-close" onClick={closeSpotMenu}><X size={18} /></button>
          </div>
          {position && (() => {
            const dist = distanceM(position.lat, position.lng, spotMenu.lat, spotMenu.lng)
            const eta  = formatEta(dist, position.speed ?? 0)
            return (
              <div className="spot-action-dist-block">
                <span className="spot-action-dist-val">{formatDist(dist, distUnit)}</span>
                {eta && <span className="spot-action-eta-val">⏱ {eta}</span>}
              </div>
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
    </>
  )
}
