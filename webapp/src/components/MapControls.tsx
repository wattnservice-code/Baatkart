import { useState, useEffect, useRef } from 'react'
import { Navigation, X, Plus, Minus, LocateFixed, Globe, Map, Bookmark, Trash2, Sun, Moon, Ship, Eye } from 'lucide-react'
import { getCurrentBearing } from '../currentBearing'
import { useOnline } from '../hooks/useOnline'
import { openGoogleEarth, openGoogleMaps } from '../googleEarth'
import { formatDist } from './NavOverlay'
import { useMapStore } from '../store/useMapStore'
import { getMapInstance } from '../mapInstance'
import SpotListPanel from './SpotListPanel'
import TripsPanel from './TripsPanel'
import SpotDialog from './SpotDialog'
import SettingsPanel from './SettingsPanel'

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

type NordMode = 'off' | 'gps' | 'krs'

function CompassBtn({ mode }: { mode: NordMode }) {
  const elRef  = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number | null>(null)
  const active = mode !== 'off'

  useEffect(() => {
    const el = elRef.current
    if (!el) return
    const loop = () => {
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
      {mode === 'gps' && <span className="cmps-label">GPS</span>}
      {mode === 'krs' && <span className="cmps-label">KRS</span>}
    </div>
  )
}

export default function MapControls() {
  const [gpsSpot, setGpsSpot]           = useState<{ lat: number; lng: number } | null>(null)

  const isOnline         = useOnline()
  const headingUp        = useMapStore((s) => s.headingUp)
  const toggleHeadingUp  = useMapStore((s) => s.toggleHeadingUp)
  const compassEnabled   = useMapStore((s) => s.compassEnabled)
  const toggleCompass    = useMapStore((s) => s.toggleCompass)
  const followBoat       = useMapStore((s) => s.followBoat)
  const addingSpot       = useMapStore((s) => s.addingSpot)
  const position         = useMapStore((s) => s.position)
  const setFollowBoat    = useMapStore((s) => s.setFollowBoat)
  const setAddingSpot    = useMapStore((s) => s.setAddingSpot)
  const darkMode         = useMapStore((s) => s.darkMode)
  const nightVision      = useMapStore((s) => s.nightVision)
  const cycleDisplayMode = useMapStore((s) => s.cycleDisplayMode)
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

  // Close the card. For a dropped/search pin (no saved id) also remove the
  // blue pin from the map; for a saved spot just close (keep its yellow pin).
  const closeSpotMenu = () => {
    if (spotMenu && !spotMenu.id) setSearchPin(null)
    setSpotMenu(null)
  }

  const useGpsPos = () => { if (position) setGpsSpot({ lat: position.lat, lng: position.lng }) }
  const useMapPos = () => { setAddingSpot(true) }

  // 3-state cycle: nord-opp → GPS kjøreretning → kompassretning → nord-opp
  const nordMode: NordMode = compassEnabled ? 'krs' : headingUp ? 'gps' : 'off'

  const handleCompassBtn = async () => {
    if (nordMode === 'off') {
      // → GPS kjøreretning (headingUp on, compass off)
      if (!headingUp) toggleHeadingUp()
      if (compassEnabled) toggleCompass()
    } else if (nordMode === 'gps') {
      // → Kompassretning (headingUp on, compass on) — request permission on iOS
      const DevOr = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }
      if (typeof DevOr.requestPermission === 'function') {
        try { if (await DevOr.requestPermission() !== 'granted') return } catch { return }
      }
      if (!headingUp) toggleHeadingUp()
      toggleCompass()
    } else {
      // krs → off: slå av begge
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
      {aisVisible && aisKey && (
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
          className={`fab compass-fab ${nordMode !== 'off' ? 'cmps-btn-krs' : ''}`}
          onClick={handleCompassBtn}
          title={nordMode === 'krs' ? 'Kompassretning – trykk for nord-opp' : nordMode === 'gps' ? 'GPS kjøreretning – trykk for kompass' : 'Nord-opp – trykk for kjøreretning'}
        >
          <CompassBtn mode={nordMode} />
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
          className={`fab ${nightVision ? 'fab-nightvision' : !darkMode ? 'fab-active' : ''}`}
          onClick={cycleDisplayMode}
          title={
            nightVision ? 'Nattsyn (rødt) – trykk for dag'
            : darkMode  ? 'Natt – trykk for nattsyn'
            :             'Dag – trykk for natt'
          }
        >
          {nightVision ? <Eye size={22} /> : darkMode ? <Moon size={22} /> : <Sun size={22} />}
        </button>
        <div className="fab-divider" />
        <button className="fab" onClick={() => getMapInstance()?.zoomIn()} title="Zoom inn">
          <Plus size={22} />
        </button>
        <button className="fab" onClick={() => getMapInstance()?.zoomOut()} title="Zoom ut">
          <Minus size={22} />
        </button>
        <button
          className={`fab ${followBoat ? 'fab-active' : (position?.speed ?? 0) > 0.3 ? 'fab-locate-lost' : ''}`}
          onClick={() => {
            setFollowBoat(true)
            const m = getMapInstance()
            if (m && m.getZoom() < 13) m.setZoom(13)
          }}
          title={followBoat ? 'Følger båten' : 'Tilbake til båten'}
        >
          <LocateFixed size={22} />
        </button>
      </div>

      {activePanel === 'spots' && (
        <SpotListPanel
          onClose={() => setActivePanel(null)}
          onAddGps={useGpsPos}
          onAddMap={useMapPos}
        />
      )}
      {activePanel === 'turer' && <TripsPanel onClose={() => setActivePanel(null)} />}
      {activePanel === 'meg' && <SettingsPanel onClose={() => setActivePanel(null)} />}
      {gpsSpot && <SpotDialog lat={gpsSpot.lat} lng={gpsSpot.lng} onClose={() => setGpsSpot(null)} />}

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
