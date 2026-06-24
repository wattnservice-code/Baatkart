import { useState, useEffect, useRef } from 'react'
import { Navigation, X, Plus, Minus, LocateFixed, Globe, Map, Bookmark, Trash2, Sun, Moon, Ship, Eye, Crosshair, List } from 'lucide-react'
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
import { waveClass, seriesRange, WindSparkline, WaveBars } from './forecastCharts'
import type { SeriesPoint } from './forecastCharts'
import { track } from '../analytics'

function cardinal(deg: number): string {
  return ['N','NØ','Ø','SØ','S','SV','V','NV'][Math.round(deg / 45) % 8]
}
function wxEmoji(code: string): string {
  if (!code) return ''
  if (code.includes('thunder')) return '⛈️'
  if (code.includes('snow')) return '❄️'
  if (code.includes('sleet')) return '🌨️'
  if (code.includes('rain') || code.includes('drizzle')) return '🌧️'
  if (code.includes('fog')) return '🌫️'
  if (code.startsWith('clearsky')) return '☀️'
  if (code.startsWith('fair')) return '🌤️'
  if (code.includes('partlycloudy')) return '⛅'
  if (code.includes('cloudy')) return '☁️'
  return ''
}

function bearingDeg(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180
  const Δλ = (lng2 - lng1) * Math.PI / 180
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360
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
  const [quickPinListOpen, setQuickPinListOpen] = useState(false)
  const [spotWx, setSpotWx]   = useState<{ windSpeed: number; windDir: number; temp: number; symbol: string } | null>(null)
  const [spotWave, setSpotWave] = useState<{ height: number; dir: number; seaTemp?: number } | null>(null)
  const [spotWindSeries, setSpotWindSeries] = useState<SeriesPoint[]>([])
  const [spotWaveSeries, setSpotWaveSeries] = useState<SeriesPoint[]>([])
  const [spotForecastOpen, setSpotForecastOpen] = useState(false)

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
  const toggleAis        = useMapStore((s) => s.toggleAis)
  const aisStatus        = useMapStore((s) => s.aisStatus)
  const setFlyTo         = useMapStore((s) => s.setFlyTo)
  const quickPins        = useMapStore((s) => s.quickPins)
  const addQuickPin      = useMapStore((s) => s.addQuickPin)
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
  const setNavTarget     = useMapStore((s) => s.setNavTarget)
  const removeQuickPin   = useMapStore((s) => s.removeQuickPin)
  const clearQuickPins   = useMapStore((s) => s.clearQuickPins)

  // Close the card. For a dropped/search pin (no saved id) also remove the
  // blue pin from the map; for a saved spot just close (keep its yellow pin).
  const closeSpotMenu = () => {
    if (spotMenu && !spotMenu.id) setSearchPin(null)
    setSpotMenu(null)
  }

  const useGpsPos = () => { if (position) setGpsSpot({ lat: position.lat, lng: position.lng }) }
  const useMapPos = () => { setAddingSpot(true) }

  // Pan map so the tapped pin stays visible above the spot-action-card.
  // Card is ~220px tall + 20px bottom gap = 240px from bottom of map-wrapper.
  // Only pan if pin is already hidden behind or near the card.
  useEffect(() => {
    if (!spotMenu) return
    const map = getMapInstance()
    if (!map) return
    const size = map.getSize()
    const pinPt = map.latLngToContainerPoint([spotMenu.lat, spotMenu.lng])
    const targetY = (size.y - 260) * 0.5
    if (pinPt.y > targetY) {
      map.panBy([0, pinPt.y - targetY], { animate: true, duration: 0.25 })
    }
  }, [spotMenu?.lat, spotMenu?.lng])

  useEffect(() => {
    if (!spotMenu || !isOnline) {
      setSpotWx(null); setSpotWave(null)
      setSpotWindSeries([]); setSpotWaveSeries([]); setSpotForecastOpen(false)
      return
    }
    setSpotWx(null); setSpotWave(null)
    setSpotWindSeries([]); setSpotWaveSeries([]); setSpotForecastOpen(false)
    const { lat, lng } = spotMenu
    const ua = { 'User-Agent': 'BaatKart/1.0 frode.sighaug@gmail.com' }
    fetch(`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat.toFixed(4)}&lon=${lng.toFixed(4)}`, { headers: ua })
      .then(r => r.json())
      .then(data => {
        const series = data.properties.timeseries
        const ts0 = series[0].data
        const d = ts0.instant.details
        const symbol = ts0.next_1_hours?.summary?.symbol_code ?? ts0.next_6_hours?.summary?.symbol_code ?? ''
        setSpotWx({ windSpeed: d.wind_speed, windDir: d.wind_from_direction, temp: d.air_temperature, symbol })
        setSpotWindSeries(
          series.slice(0, 8).map((p: any, i: number) => ({ hour: i, v: p.data.instant.details.wind_speed }))
        )
      })
      .catch(() => {})
    fetch(`https://api.met.no/weatherapi/oceanforecast/2.0/complete?lat=${lat.toFixed(4)}&lon=${lng.toFixed(4)}`, { headers: ua })
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(data => {
        const series = data.properties?.timeseries ?? []
        const d = series[0]?.data?.instant?.details
        if (!d || d.sea_surface_wave_height == null) return
        setSpotWave({ height: d.sea_surface_wave_height, dir: d.sea_surface_wave_from_direction ?? 0, seaTemp: d.sea_water_temperature })
        setSpotWaveSeries(
          series.slice(0, 8)
            .filter((p: any) => p.data?.instant?.details?.sea_surface_wave_height != null)
            .map((p: any, i: number) => ({ hour: i, v: p.data.instant.details.sea_surface_wave_height }))
        )
      })
      .catch(() => {})
  }, [spotMenu?.lat, spotMenu?.lng, isOnline])

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
      {aisVisible && (
        <div
          className={`ais-status ais-status-${aisStatus.state}${aisStatus.dangerPos ? ' ais-status-clickable' : ''}`}
          onClick={() => aisStatus.dangerPos && setFlyTo(aisStatus.dangerPos)}
          title={aisStatus.dangerPos ? 'Trykk for å se farlig fartøy' : undefined}
        >
          {aisStatus.state === 'live'
            ? `🚢 ${aisStatus.count} fartøy`
            : aisStatus.state === 'warn'
            ? `🚨 ${aisStatus.message} – trykk for å se`
            : aisStatus.state === 'connecting'
            ? `🚢 ${aisStatus.message}`
            : aisStatus.state === 'error'
            ? `📡 Ingen AIS-kontakt`
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
        <button
          className={`fab ${aisVisible ? 'fab-active' : ''}`}
          onClick={() => { track('ais_toggle', { on: !aisVisible }); toggleAis() }}
          title={aisVisible ? 'Skjul AIS-fartøy' : 'Vis AIS-fartøy'}
        >
          <Ship size={20} />
        </button>
        <button
          className={`fab ${nightVision ? 'fab-nightvision' : !darkMode ? 'fab-active' : ''}`}
          onClick={() => { track('display_mode', { from: nightVision ? 'night' : darkMode ? 'dark' : 'day' }); cycleDisplayMode() }}
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
            const m = getMapInstance()
            if (!followBoat && m) m.setZoom(14)   // reset zoom when returning from nav
            setFollowBoat(true)
          }}
          title={followBoat ? 'Følger båten' : 'Tilbake til båten'}
        >
          <LocateFixed size={22} />
        </button>
        <div className="fab-divider" />
        <button
          className={`fab ${quickPins.length > 0 ? 'fab-quickpin' : ''}`}
          onClick={() => { if (position) { track('quickpin_added'); addQuickPin({ lat: position.lat, lng: position.lng }) } }}
          title="Merk posisjon (blåse, holdeplass…)"
        >
          <Crosshair size={20} />
          {quickPins.length > 0 && <span className="fab-badge">{quickPins.length}</span>}
        </button>
        {quickPins.length > 0 && (
          <button
            className="fab fab-quickpin"
            onClick={() => { track('panel_open', { panel: 'quickpins' }); setQuickPinListOpen(true) }}
            title="Vis alle merker"
          >
            <List size={20} />
          </button>
        )}
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

      {quickPinListOpen && (() => {
        const withDist = quickPins.map((p) => ({
          pin: p,
          dist: position ? distanceM(position.lat, position.lng, p.lat, p.lng) : null,
          brg:  position ? bearingDeg(position.lat, position.lng, p.lat, p.lng) : null,
        }))
        return (
          <div className="quickpin-popup">
            <div className="quickpin-popup-head">
              <span>⊕ Merker ({quickPins.length})</span>
              <button className="quickpin-popup-close" onClick={() => setQuickPinListOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="quickpin-popup-list">
              {withDist.map(({ pin, dist, brg }, idx) => (
                <div
                  key={pin.id}
                  className="quickpin-popup-row"
                  onClick={() => setFlyTo({ lat: pin.lat, lng: pin.lng })}
                >
                  <span className="quickpin-popup-num">{idx + 1}</span>
                  <div className="quickpin-popup-info">
                    <span className="quickpin-popup-label">{pin.label}</span>
                    {dist !== null && (
                      <span className="quickpin-popup-dist">
                        {formatDist(dist, distUnit as 'nm' | 'm' | 'km')} · {Math.round(brg!)}°
                      </span>
                    )}
                  </div>
                  <button
                    className="quickpin-popup-nav"
                    title="Navigér hit"
                    onClick={(e) => {
                      e.stopPropagation()
                      setNavTarget({ lat: pin.lat, lng: pin.lng, name: `Merke ${pin.label}` })
                      removeQuickPin(pin.id)
                      setQuickPinListOpen(false)
                    }}
                  >
                    <Navigation size={16} />
                  </button>
                  <button
                    className="quickpin-popup-del"
                    title="Fjern merke"
                    onClick={(e) => { e.stopPropagation(); removeQuickPin(pin.id) }}
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
            {quickPins.length > 1 && (
              <button className="quickpin-popup-clear" onClick={clearQuickPins}>
                <Trash2 size={13} /> Fjern alle
              </button>
            )}
          </div>
        )
      })()}

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
          {spotWx && (
            <div className="spot-wx-block">
              <span>{wxEmoji(spotWx.symbol)} {Math.round(spotWx.temp)}°C</span>
              <span>🌬 {spotWx.windSpeed.toFixed(1)} m/s {cardinal(spotWx.windDir)}</span>
              {spotWave && <span className={waveClass(spotWave.height)}>🌊 {spotWave.height.toFixed(1)} m</span>}
              {spotWave?.seaTemp != null && <span>{Math.round(spotWave.seaTemp)}° sjø</span>}
            </div>
          )}
          {(spotWindSeries.length >= 2 || spotWaveSeries.length >= 2) && (
            <button
              className="wx-expand-toggle"
              onClick={(e) => { e.stopPropagation(); setSpotForecastOpen((v) => !v) }}
            >
              {spotForecastOpen ? '▲ Skjul varsel' : '▼ Varsel 8t'}
            </button>
          )}
          {spotForecastOpen && (
            <div className="wx-forecast" onClick={(e) => e.stopPropagation()}>
              {spotWindSeries.length >= 2 && (
                <div className="wx-forecast-row">
                  <span className="wx-forecast-label">🌬 {seriesRange(spotWindSeries)}</span>
                  <div className="wx-forecast-col">
                    <WindSparkline points={spotWindSeries} />
                    <div className="wx-forecast-hours"><span>nå</span><span>+8t</span></div>
                  </div>
                </div>
              )}
              {spotWaveSeries.length >= 2 && (
                <div className="wx-forecast-row">
                  <span className="wx-forecast-label">🌊 {seriesRange(spotWaveSeries)} m</span>
                  <div className="wx-forecast-col">
                    <WaveBars points={spotWaveSeries} />
                    <div className="wx-forecast-hours"><span>nå</span><span>+8t</span></div>
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="spot-action-btns">
            <button className="spot-action-btn spot-action-nav" onClick={() => {
              track('nav_started')
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
