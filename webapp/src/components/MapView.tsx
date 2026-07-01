import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import '../leafletRotateSetup'
import { useMapStore } from '../store/useMapStore'
import { setCurrentBearing } from '../currentBearing'
import SpotDialog from './SpotDialog'
import { getTile } from '../offline/tileDb'
import { tileKey } from '../offline/tileCalc'
import { setMapInstance } from '../mapInstance'
import { iconEmoji } from '../spotIcons'
import { haversineM, destPoint, mobDrift } from '../geo'

// Track cache vs network tile loads and report to store (debounced)
let _cacheHits = 0
let _netHits = 0
let _tileDebounce: ReturnType<typeof setTimeout> | null = null

function recordTileHit(fromCache: boolean) {
  if (fromCache) { _cacheHits++ } else { _netHits++ }
  if (_tileDebounce) clearTimeout(_tileDebounce)
  _tileDebounce = setTimeout(() => {
    const total = _cacheHits + _netHits
    if (total > 0) {
      const ratio = _cacheHits / total
      const source = ratio >= 0.8 ? 'offline' : ratio <= 0.2 ? 'online' : 'mixed'
      useMapStore.getState().setTileSource(source)
    }
    _cacheHits = 0
    _netHits = 0
  }, 1000)
}

// Custom tile layer that serves from IndexedDB when available
class OfflineTileLayer extends L.TileLayer {
  private _layerName: 'sjokaart' | 'seamark'
  constructor(url: string, options: L.TileLayerOptions, layerName: 'sjokaart' | 'seamark') {
    super(url, options)
    this._layerName = layerName
  }
  createTile(coords: L.Coords, done: L.DoneCallback): HTMLElement {
    const img = document.createElement('img')
    img.alt = ''
    const key = tileKey(coords.z, coords.x, coords.y, this._layerName)
    getTile(key).then((blob) => {
      if (blob) {
        recordTileHit(true)
        img.src = URL.createObjectURL(blob)
      } else if (useMapStore.getState().offlineOnly) {
        recordTileHit(true)
        // Draw a grey placeholder so areas without offline coverage are clearly toned down
        const isDark = useMapStore.getState().darkMode
        const canvas = document.createElement('canvas')
        canvas.width = 1; canvas.height = 1
        const ctx = canvas.getContext('2d')
        if (ctx) { ctx.fillStyle = isDark ? '#1e2a38' : '#c8d3dc'; ctx.fillRect(0, 0, 1, 1) }
        img.src = canvas.toDataURL()
      } else {
        recordTileHit(false)
        img.src = this.getTileUrl(coords)
        img.crossOrigin = 'anonymous'
      }
      img.addEventListener('load', () => done(undefined, img))
      img.addEventListener('error', (e) => done(e as unknown as Error, img))
    })
    return img
  }
}

const CARTO_ATTR = '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://openstreetmap.org/copyright">OSM</a>'
const OSM_URL   = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
const OSM_ATTR  = CARTO_ATTR
const DARK_URL  = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
const DARK_ATTR = CARTO_ATTR
const SJOKAART_URL  = 'https://cache.kartverket.no/v1/wmts/1.0.0/sjokartraster/default/webmercator/{z}/{y}/{x}.png'
const SJOKAART_ATTR = '&copy; <a href="https://kartverket.no">Kartverket</a>'
const DYBDE_WMS     = 'https://wms.geonorge.no/skwms1/wms.dybdedata2'
const SEAMARK_URL   = 'https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png'
const SEAMARK_ATTR  = '&copy; <a href="https://openseamap.org">OpenSeaMap</a>'

function boatSize(zoom: number): number {
  if (zoom >= 16) return 30
  if (zoom >= 14) return 24
  if (zoom >= 12) return 20
  return 16
}

function formatRingLabel(m: number): string {
  const r = Math.round(m)
  if (r >= 1000) {
    const km = r / 1000
    return `${Number.isInteger(km) ? km : km.toFixed(1)} km`
  }
  return `${r} m`
}

// How far ahead of the boat the map centre sits, as a fraction of screen height,
// in look-ahead mode. Smaller = boat higher on screen = more room for the ring.
const LOOK_AHEAD_FRAC = 0.28

// Auto look-ahead with hysteresis: engage above 4 kn, only disengage below 2 kn.
// Without the gap, GPS speed noise around the threshold makes the boat flip between
// "pushed back" and "centred" — looking like it drifts toward the middle.
const LA_ENGAGE_MS = 2.06   // ~4 knots
const LA_RELEASE_MS = 1.03  // ~2 knots
function effectiveLookAhead(stateRef: { current: boolean }, speed: number, manual: boolean): boolean {
  if (speed > LA_ENGAGE_MS) stateRef.current = true
  else if (speed < LA_RELEASE_MS) stateRef.current = false
  return manual || stateRef.current
}

// Round a distance DOWN to a clean 1/2/5 × 10ⁿ value (50, 100, 200, 500, …)
function niceRound(m: number): number {
  if (m <= 0) return 50
  const pow = Math.pow(10, Math.floor(Math.log10(m)))
  const f = m / pow
  const nice = f >= 5 ? 5 : f >= 2 ? 2 : 1
  return nice * pow
}

// Largest range-ring radius (m) whose full circle + label fit on the current
// screen, given where the boat sits. Derived from live container size, so it
// adapts to any device/orientation/zoom/speed — the ring is always whole.
function fitRingRadius(
  map: L.Map,
  pos: { lat: number; speed: number },
  followBoat: boolean,
  lookAhead: boolean,
  zoom: number,
): number {
  const size = map.getSize()
  const mpp = (156543 * Math.cos(pos.lat * Math.PI / 180)) / Math.pow(2, zoom)
  // Boat's vertical screen position: centred when stationary, lower when leading.
  // `lookAhead` here is the already-resolved effective flag (manual OR auto).
  const boatY = followBoat && lookAhead ? 0.5 + LOOK_AHEAD_FRAC : 0.5
  const minPx = Math.min(boatY * size.y, (1 - boatY) * size.y, 0.5 * size.x)
  return Math.max(50, niceRound(minPx * mpp * 0.85))   // 0.85 → small margin off the edge
}

// Shortest signed angular delta from `from` to `to`, in [-180, 180]
function shortestAngle(from: number, to: number): number {
  let d = (to - from) % 360
  if (d > 180) d -= 360
  if (d < -180) d += 360
  return d
}

// Keep the boat on screen in follow mode, on any size/orientation. When moving
// (or look-ahead is on) it sits low with the course ahead; otherwise centred.
// viewHeightM is derived from the live container size, so it adapts to any
// device — phone, tablet or desktop, portrait or landscape.
function recenterOnBoat(
  map: L.Map,
  pos: { lat: number; lng: number; heading: number; speed: number },
  lookAhead: boolean,
  animate: boolean,
) {
  // `lookAhead` is the already-resolved effective flag (manual OR auto w/ hysteresis).
  if (lookAhead) {
    const size = map.getSize()
    const topLL = map.containerPointToLatLng([size.x / 2, 0])
    const botLL = map.containerPointToLatLng([size.x / 2, size.y])
    const viewHeightM = haversineM(topLL.lat, topLL.lng, botLL.lat, botLL.lng)
    const center = destPoint(pos.lat, pos.lng, pos.heading, viewHeightM * LOOK_AHEAD_FRAC)
    map.panTo(center, { animate, duration: 0.5 })
  } else {
    map.panTo([pos.lat, pos.lng], { animate, duration: 0.5 })
  }
}

function boatSvg(heading: number, size: number) {
  return `<div style="
    width:${size}px;height:${size}px;
    transform:rotate(${heading}deg);
    filter:drop-shadow(0 0 3px rgba(0,0,0,0.9)) drop-shadow(0 2px 5px rgba(0,0,0,0.8));
  ">
    <svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 3 L34 36 L20 29 L6 36 Z" fill="white" stroke="#0f172a" stroke-width="3" stroke-linejoin="round"/>
      <path d="M20 8 L31 33 L20 27 L9 33 Z" fill="#38bdf8" stroke="none"/>
      <circle cx="20" cy="20" r="3.5" fill="#0f172a"/>
    </svg>
  </div>`
}

function ringLabelIcon(radius: number) {
  const text = formatRingLabel(radius)
  return L.divIcon({
    className: '',
    html: `<div class="ring-label">${text}</div>`,
    iconSize: [60, 18], iconAnchor: [30, 18],
  })
}

export default function MapView() {
  const mapRef          = useRef<L.Map | null>(null)
  const containerRef    = useRef<HTMLDivElement>(null)
  const boatMarkerRef   = useRef<L.Marker | null>(null)
  const trackLineRef    = useRef<L.Polyline | null>(null)
  const courseLineRef   = useRef<L.Polyline | null>(null)
  const courseCasingRef = useRef<L.Polyline | null>(null)
  const compassLineRef  = useRef<L.Polyline | null>(null)
  const rangeRingRef    = useRef<L.Circle | null>(null)
  const accuracyRingRef = useRef<L.Circle | null>(null)
  const ringLabelRef    = useRef<L.Marker | null>(null)
  const mobMarkerRef      = useRef<L.Marker | null>(null)
  const mobDriftLineRef   = useRef<L.Polyline | null>(null)
  const mobDriftMarkerRef = useRef<L.Marker | null>(null)
  const mobDriftCircleRef = useRef<L.Circle | null>(null)
  const navLineRef        = useRef<L.Polyline | null>(null)
  const navCasingRef      = useRef<L.Polyline | null>(null)
  const navMarkerRef      = useRef<L.Marker | null>(null)
  const previewLineRef    = useRef<L.Polyline | null>(null)
  const previewMarkerRef  = useRef<L.Marker | null>(null)
  const searchPinRef      = useRef<L.Marker | null>(null)
  const baseTileRef     = useRef<L.TileLayer | null>(null)
  const kartvTileRef    = useRef<L.TileLayer | null>(null)
  const seamarkTileRef  = useRef<L.TileLayer | null>(null)
  const depthTileRef    = useRef<L.TileLayer | null>(null)
  const resumeFollowRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wasMovingRef    = useRef(false)
  const autoLARef       = useRef(false)   // hysteresis state for auto look-ahead
  const spotMarkersRef      = useRef<Map<string, L.Marker>>(new Map())
  const quickPinMarkersRef  = useRef<Map<string, L.Marker>>(new Map())
  const followTrackLineRef  = useRef<L.Polyline | null>(null)

  const [pendingSpot, setPendingSpot]       = useState<{ lat: number; lng: number } | null>(null)
  const [driftTick, setDriftTick]           = useState(0)
  const bearingRef         = useRef(0)   // currently displayed map bearing (deg)
  const targetBearingRef   = useRef(0)   // desired bearing (deg)
  const appliedBearingRef  = useRef(0)   // last bearing pushed to the map
  const rafRef             = useRef<number | null>(null)
  const isManualRef        = useRef(false) // bruker har vridd kartet fritt (to-finger)
  const manualBearingRef   = useRef(0)     // holdt vinkel i fri modus (deg)

  const position         = useMapStore((s) => s.position)
  const positionRef      = useRef(position)
  const track            = useMapStore((s) => s.track)
  const mobPoint         = useMapStore((s) => s.mobPoint)
  const currentWeather   = useMapStore((s) => s.currentWeather)
  const currentSea       = useMapStore((s) => s.currentSea)
  const followBoat       = useMapStore((s) => s.followBoat)
  const addingSpot       = useMapStore((s) => s.addingSpot)
  const flyTo            = useMapStore((s) => s.flyTo)
  const searchPin        = useMapStore((s) => s.searchPin)
  const navPreview       = useMapStore((s) => s.navPreview)
  const navTarget        = useMapStore((s) => s.navTarget)
  const savedSpots       = useMapStore((s) => s.savedSpots)
  const activeSpotId     = useMapStore((s) => s.activeSpotId)
  const spotsVisible     = useMapStore((s) => s.spotsVisible)
  const quickPins               = useMapStore((s) => s.quickPins)
  const highlightedQuickPinId   = useMapStore((s) => s.highlightedQuickPinId)
  const mapHintDismissed        = useMapStore((s) => s.mapHintDismissed)
  const dismissMapHint          = useMapStore((s) => s.dismissMapHint)
  const compassEnabled          = useMapStore((s) => s.compassEnabled)
  const compassHeading   = useMapStore((s) => s.compassHeading)
  const darkMode         = useMapStore((s) => s.darkMode)
  const seamarkVisible   = useMapStore((s) => s.seamarkVisible)
  const seaChartFull     = useMapStore((s) => s.seaChartFull)
  const depthShadeVisible = useMapStore((s) => s.depthShadeVisible)
  const customRingRadius = useMapStore((s) => s.customRingRadius)
  const followingTrack   = useMapStore((s) => s.followingTrack)
  const offlineOnly      = useMapStore((s) => s.offlineOnly)
  const lookAhead        = useMapStore((s) => s.lookAhead)
  const headingUp        = useMapStore((s) => s.headingUp)
  const northUpNonce     = useMapStore((s) => s.northUpNonce)
  const rotateEnabled    = useMapStore((s) => s.rotateEnabled)
  const setFollowBoat    = useMapStore((s) => s.setFollowBoat)
  const setFlyTo         = useMapStore((s) => s.setFlyTo)

  // Init map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const _saved = (() => { try { return JSON.parse(localStorage.getItem('lastPos') ?? 'null') } catch { return null } })()
    const _zoom  = (() => { const z = localStorage.getItem('lastZoom'); return z ? +z : 13 })()
    const map = L.map(containerRef.current, {
      center: _saved ? [_saved.lat, _saved.lng] : [59.9, 10.7], zoom: _zoom, zoomControl: false,
      rotate: true, rotateControl: false, touchRotate: useMapStore.getState().rotateEnabled, shiftKeyRotate: false, bearing: 0,
    })
    // Move the OSM attribution to the bottom-left so it doesn't sit under the
    // right-edge FAB menu.
    map.attributionControl.setPosition('bottomleft')

    const isDark = useMapStore.getState().darkMode
    baseTileRef.current = L.tileLayer(isDark ? DARK_URL : OSM_URL, {
      attribution: isDark ? DARK_ATTR : OSM_ATTR, maxZoom: 19,
    }).addTo(map)
    kartvTileRef.current = new OfflineTileLayer(SJOKAART_URL, {
      attribution: SJOKAART_ATTR, maxZoom: 19, opacity: isDark ? 0.5 : 0.7,
    }, 'sjokaart').addTo(map)
    // Kraftige dybdefarger (Kartverket Dybdedata): kun fargeflaten. Dybdetall/koter
    // kommer fra sjøkartrasteret over — så vi unngår doble tall.
    const depthOn = useMapStore.getState().depthShadeVisible
    depthTileRef.current = L.tileLayer.wms(DYBDE_WMS, {
      layers: 'Dybdelag', format: 'image/png', transparent: true,
      version: '1.3.0', attribution: SJOKAART_ATTR, maxZoom: 19,
      opacity: depthOn ? 0.8 : 0,
    }).addTo(map)
    seamarkTileRef.current = new OfflineTileLayer(SEAMARK_URL, {
      attribution: SEAMARK_ATTR, maxZoom: 19,
    }, 'seamark').addTo(map)
    setMapInstance(map)
    map.on('dragstart', () => {
      setFollowBoat(false)
      // Auto-resume: if boat is still moving and user hasn't dragged again within 10s, re-lock onto boat
      if (resumeFollowRef.current) clearTimeout(resumeFollowRef.current)
      resumeFollowRef.current = setTimeout(() => {
        if ((useMapStore.getState().position?.speed ?? 0) > 0.3) {
          useMapStore.getState().setFollowBoat(true)
        }
      }, 10000)
    })

    // To-finger-vri: skill brukerens gest fra appens egen setBearing via
    // touchGestures._rotating. Ved manuell vri kobles kjøreretning/kompass ut
    // og vinkelen holdes (fri modus), så auto-rotasjonen ikke slåss imot.
    map.on('rotate', () => {
      const tg = (map as unknown as { touchGestures?: { _rotating?: boolean } }).touchGestures
      if (!tg?._rotating) return // programmatisk rotasjon – ignorer
      const st = useMapStore.getState()
      if (st.headingUp) st.toggleHeadingUp()
      if (st.compassEnabled) st.toggleCompass()
      const disp = ((-map.getBearing() % 360) + 360) % 360
      isManualRef.current = true
      manualBearingRef.current = disp
      bearingRef.current = disp
      appliedBearingRef.current = disp
      setCurrentBearing(disp)
      if (!st.mapRotated) st.setMapRotated(true)
    })

    const updateBounds = () => {
      const b = map.getBounds()
      useMapStore.getState().setMapBounds({
        north: b.getNorth(), south: b.getSouth(),
        east: b.getEast(), west: b.getWest(),
      })
    }
    map.on('moveend', updateBounds)
    map.on('zoomend', () => { updateBounds(); localStorage.setItem('lastZoom', String(map.getZoom())) })
    updateBounds()

    map.on('zoom', () => {
      const zoom = map.getZoom()
      const pos = useMapStore.getState().position
      const customR = useMapStore.getState().customRingRadius

      if (pos && boatMarkerRef.current) {
        const size = boatSize(zoom)
        boatMarkerRef.current.setIcon(L.divIcon({
          className: '', html: boatSvg(pos.heading, size),
          iconSize: [size, size], iconAnchor: [size / 2, size / 2],
        }))
      }
      if (rangeRingRef.current && pos) {
        const st = useMapStore.getState()
        const la = effectiveLookAhead(autoLARef, pos.speed, st.lookAhead)
        const r = customR ?? fitRingRadius(map, pos, st.followBoat, la, zoom)
        rangeRingRef.current.setRadius(r)
        const labelPos = destPoint(pos.lat, pos.lng, (pos.heading + 270) % 360, r)
        ringLabelRef.current?.setLatLng(labelPos)
        const el = ringLabelRef.current?.getElement()?.querySelector('.ring-label')
        if (el) el.textContent = formatRingLabel(r)
      }
    })

    mapRef.current = map
    return () => {
      if (resumeFollowRef.current) clearTimeout(resumeFollowRef.current)
      map.remove(); mapRef.current = null; setMapInstance(null)
    }
  }, [setFollowBoat])

  // Keep position ref current
  useEffect(() => {
    positionRef.current = position
  }, [position])

  // Keep the map sized correctly and the boat on screen on ANY container change
  // — orientation flip, tablet split-view, desktop window resize, PWA chrome.
  // A ResizeObserver is device-agnostic (no per-device breakpoints needed).
  useEffect(() => {
    const map = mapRef.current
    const el  = containerRef.current
    if (!map || !el) return
    let raf = 0
    const handle = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        map.invalidateSize({ animate: false })
        const pos = positionRef.current
        if (pos && useMapStore.getState().followBoat) {
          const la = effectiveLookAhead(autoLARef, pos.speed, useMapStore.getState().lookAhead)
          recenterOnBoat(map, pos, la, false)
        }
      })
    }
    const ro = new ResizeObserver(handle)
    ro.observe(el)
    window.addEventListener('orientationchange', handle)
    return () => {
      ro.disconnect()
      window.removeEventListener('orientationchange', handle)
      cancelAnimationFrame(raf)
    }
  }, [])

  // Dark/day mode tile switch
  useEffect(() => {
    if (!baseTileRef.current || !kartvTileRef.current) return
    baseTileRef.current.setUrl(darkMode ? DARK_URL : OSM_URL)
    // Fullt sjøkart → tydelige dybdefarger. Natt dempes så hvitt kart ikke blender.
    kartvTileRef.current.setOpacity(
      seaChartFull ? (darkMode ? 0.7 : 1) : (darkMode ? 0.45 : 0.6)
    )
  }, [darkMode, seaChartFull])

  // Kraftige dybdefarger toggle (kun fargeflaten – tall kommer fra rasteret)
  useEffect(() => {
    depthTileRef.current?.setOpacity(depthShadeVisible ? 0.8 : 0)
  }, [depthShadeVisible])

  // Seamark toggle
  useEffect(() => {
    if (!seamarkTileRef.current) return
    seamarkTileRef.current.setOpacity(seamarkVisible ? 1 : 0)
  }, [seamarkVisible])

  // Fly-to command
  useEffect(() => {
    if (!mapRef.current || !flyTo) return
    mapRef.current.flyTo([flyTo.lat, flyTo.lng], Math.max(mapRef.current.getZoom(), 14), { animate: true, duration: 1 })
    setFlyTo(null)
  }, [flyTo, setFlyTo])

  // Search result pin — teardrop marker with name label. Tap to dismiss.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (!searchPin) {
      searchPinRef.current?.remove(); searchPinRef.current = null
      return
    }
    const html = `<div class="search-pin"></div><div class="search-pin-label">${searchPin.name}</div>`
    const icon = L.divIcon({ className: '', html, iconSize: [20, 20], iconAnchor: [10, 20] })
    if (!searchPinRef.current) {
      searchPinRef.current = L.marker([searchPin.lat, searchPin.lng], { icon, zIndexOffset: 600 }).addTo(map)
      searchPinRef.current.on('click', () => {
        const s = useMapStore.getState()
        if (s.mobPoint) return
        if (s.searchPin) s.setSpotMenu({ lat: s.searchPin.lat, lng: s.searchPin.lng, name: s.searchPin.name })
      })
    } else {
      searchPinRef.current.setLatLng([searchPin.lat, searchPin.lng]).setIcon(icon)
    }
  }, [searchPin])

  // Boat position + course line + range ring + ring label
  useEffect(() => {
    if (!mapRef.current || !position) return
    const map = mapRef.current
    const latlng: L.LatLngExpression = [position.lat, position.lng]
    const zoom = map.getZoom()

    // Auto-zoom to navigation level when the boat starts moving and follow is on
    const isMoving = (position.speed ?? 0) > 0.5
    if (isMoving && !wasMovingRef.current && followBoat && zoom < 12) {
      map.setZoom(13, { animate: true })
    }
    wasMovingRef.current = isMoving
    const la = effectiveLookAhead(autoLARef, position.speed, lookAhead)
    const mpp = (156543 * Math.cos(position.lat * Math.PI / 180)) / Math.pow(2, zoom)
    // Auto-fit so the whole ring + label stay on screen; honour a manual override.
    const radius = customRingRadius ?? fitRingRadius(map, position, followBoat, la, zoom)

    // Boat marker
    const size = boatSize(zoom)
    if (!boatMarkerRef.current) {
      const icon = L.divIcon({ className: '', html: boatSvg(position.heading, size), iconSize: [size, size], iconAnchor: [size / 2, size / 2] })
      boatMarkerRef.current = L.marker(latlng, { icon, zIndexOffset: 1000 }).addTo(map)
      map.setView(latlng, Math.max(zoom, 13), { animate: false })
    } else {
      boatMarkerRef.current.setLatLng(latlng)
      if (followBoat) recenterOnBoat(map, position, la, true)
    }

    // GPS course predictor — zoom-adaptive length (min 40% screen height, up to 5 min ahead or 100% screen height)
    const screenH = map.getSize().y
    const courseLen = Math.max(mpp * screenH * 0.4, Math.min(position.speed * 300, mpp * screenH))
    const courseEnd = destPoint(position.lat, position.lng, position.heading, courseLen)
    if (!courseLineRef.current) {
      // Dark casing under the orange course predictor so it stays readable on a
      // pale day chart (orange-on-beige otherwise washes out).
      courseCasingRef.current = L.polyline([latlng, courseEnd], { color: '#0f172a', weight: 5, opacity: 0.35 }).addTo(map)
      courseLineRef.current = L.polyline([latlng, courseEnd], { color: '#fb923c', weight: 3, opacity: 0.95, dashArray: '8, 6' }).addTo(map)
    } else {
      courseCasingRef.current?.setLatLngs([latlng, courseEnd])
      courseLineRef.current.setLatLngs([latlng, courseEnd])
    }

    // GPS accuracy circle — shows how confident the fix is (Google-Maps style).
    // Only when the figure is meaningful so a sharp fix doesn't clutter the view.
    const acc = position.accuracy
    if (acc && acc > 8 && acc < 1000) {
      if (!accuracyRingRef.current) {
        accuracyRingRef.current = L.circle(latlng, {
          radius: acc, color: '#38bdf8', weight: 1, opacity: 0.4,
          fill: true, fillColor: '#38bdf8', fillOpacity: 0.08, interactive: false,
        }).addTo(map)
      } else {
        accuracyRingRef.current.setLatLng(latlng).setRadius(acc)
      }
    } else {
      accuracyRingRef.current?.remove(); accuracyRingRef.current = null
    }

    // Range ring
    if (!rangeRingRef.current) {
      rangeRingRef.current = L.circle(latlng, {
        radius, color: '#3b82f6', weight: 2.5, opacity: 0.9,
        fill: true, fillColor: '#3b82f6', fillOpacity: 0.05,
      }).addTo(map)
    } else {
      rangeRingRef.current.setLatLng(latlng).setRadius(radius)
    }

    // Ring label to the port side of the ring (90° left of heading) so it stays
    // on-screen when the boat is pushed low by look-ahead while moving.
    const labelPos = destPoint(position.lat, position.lng, (position.heading + 270) % 360, radius)
    if (!ringLabelRef.current) {
      ringLabelRef.current = L.marker(labelPos, {
        icon: ringLabelIcon(radius),
        interactive: false, zIndexOffset: 400,
      }).addTo(map)
    } else {
      ringLabelRef.current.setLatLng(labelPos)
      const el = ringLabelRef.current.getElement()?.querySelector('.ring-label')
      if (el) el.textContent = formatRingLabel(radius)
    }
  }, [position, followBoat, customRingRadius])

  // Boat rotation — compass heading takes priority over GPS heading.
  // In heading-up mode the map rotates to the course, so the boat points
  // straight up (chartplotter style); otherwise it points along its heading.
  useEffect(() => {
    if (!boatMarkerRef.current) return
    const isCompassActive = compassEnabled && compassHeading !== null && !isNaN(compassHeading)
    const h = isCompassActive ? compassHeading! : (position?.heading ?? 0)
    const inner = boatMarkerRef.current.getElement()?.querySelector('div') as HTMLElement | null
    if (inner) inner.style.transform = `rotate(${headingUp ? 0 : h}deg)`
  }, [position, compassEnabled, compassHeading, headingUp])

  // Compass heading line — solid cyan, fixed 800m length
  useEffect(() => {
    if (!mapRef.current || !position) {
      compassLineRef.current?.remove(); compassLineRef.current = null
      return
    }
    const isActive = compassEnabled && compassHeading !== null && !isNaN(compassHeading)
    if (!isActive) {
      compassLineRef.current?.remove(); compassLineRef.current = null
      return
    }
    const latlng: L.LatLngExpression = [position.lat, position.lng]
    const map = mapRef.current
    const compassMpp = (156543 * Math.cos(position.lat * Math.PI / 180)) / Math.pow(2, map.getZoom())
    const compassLen = compassMpp * map.getSize().y * 0.55
    const compassEnd = destPoint(position.lat, position.lng, compassHeading!, compassLen)
    if (!compassLineRef.current) {
      compassLineRef.current = L.polyline([latlng, compassEnd], {
        color: '#38bdf8', weight: 3, opacity: 0.95,
      }).addTo(mapRef.current)
    } else {
      compassLineRef.current.setLatLngs([latlng, compassEnd])
    }
  }, [position, compassEnabled, compassHeading])

  // Update the *target* bearing (cheap, no DOM). Gated by speed so a stationary
  // boat doesn't spin on noisy GPS heading. Compass (if on) is stable at rest.
  useEffect(() => {
    if (!headingUp) return
    const isCompassActive = compassEnabled && compassHeading !== null && !isNaN(compassHeading)
    if (isCompassActive) {
      targetBearingRef.current = compassHeading!
    } else if (position && position.speed > 0.5 && position.heading !== undefined) {
      targetBearingRef.current = position.heading
    }
    // else: keep previous target — hold heading when slow/stopped
  }, [headingUp, position, compassHeading, compassEnabled])

  // Smoothly drive the real map bearing (leaflet-rotate) toward the target.
  // Heavy easing acts as a low-pass filter so a noisy compass doesn't spin the
  // map. setBearing is only applied when the change is meaningful (>0.4°) to
  // avoid thrashing tile rendering on every frame.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    // Compass indoors is very noisy → gentle ease. GPS course is already smooth.
    const isCompassActive = compassEnabled && compassHeading !== null && !isNaN(compassHeading)
    const ease = isCompassActive ? 0.06 : 0.1

    // Heading-modus overstyrer fri rotasjon: rydd manuell-flagget når den slås på.
    if (headingUp) {
      isManualRef.current = false
      if (useMapStore.getState().mapRotated) useMapStore.getState().setMapRotated(false)
    }

    // Mål: kjøreretning (heading-up) → fri vinkel (manuell vri) → nord-opp (0).
    const target = () =>
      headingUp ? targetBearingRef.current
      : isManualRef.current ? manualBearingRef.current
      : 0

    const loop = () => {
      const diff = shortestAngle(bearingRef.current, target())
      if (Math.abs(diff) < 0.15) {
        bearingRef.current = target()
      } else {
        bearingRef.current += diff * ease
      }
      if (Math.abs(shortestAngle(appliedBearingRef.current, bearingRef.current)) >= 0.4) {
        appliedBearingRef.current = bearingRef.current
        setCurrentBearing(bearingRef.current)
        try { map.setBearing(-bearingRef.current) } catch { /* plugin not ready */ }
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(loop)

    return () => { if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null } }
  }, [headingUp, compassEnabled, compassHeading])

  // Reset til nord-opp når kompass-rosen trykkes mens kartet er fritt vridd.
  // rAF-loopen over easer kartet tilbake til 0 når manuell-flagget ryddes.
  useEffect(() => {
    if (northUpNonce === 0) return
    isManualRef.current = false
    manualBearingRef.current = 0
    useMapStore.getState().setMapRotated(false)
  }, [northUpNonce])

  // Toggle for to-finger-vri (Meg → Kartvisning). Av → deaktiver gesten og
  // rett kartet mot nord.
  useEffect(() => {
    const map = mapRef.current as unknown as { touchRotate?: { enable: () => void; disable: () => void } } | null
    if (!map?.touchRotate) return
    if (rotateEnabled) {
      map.touchRotate.enable()
    } else {
      map.touchRotate.disable()
      if (useMapStore.getState().mapRotated) useMapStore.getState().requestNorthUp()
    }
  }, [rotateEnabled])

  // Redraw tiles when offlineOnly toggles so grey placeholders appear immediately
  useEffect(() => {
    kartvTileRef.current?.redraw()
    seamarkTileRef.current?.redraw()
  }, [offlineOnly])

  // Track line
  useEffect(() => {
    if (!mapRef.current) return
    const pts = track.map((p) => [p.lat, p.lng] as L.LatLngExpression)
    if (!trackLineRef.current) {
      trackLineRef.current = L.polyline(pts, { color: '#3b82f6', weight: 3, opacity: 0.8 }).addTo(mapRef.current)
    } else {
      trackLineRef.current.setLatLngs(pts)
    }
  }, [track])

  // Followed saved track (purple dashed)
  useEffect(() => {
    if (!mapRef.current) return
    if (followTrackLineRef.current) { followTrackLineRef.current.remove(); followTrackLineRef.current = null }
    if (!followingTrack || followingTrack.points.length < 2) return
    followTrackLineRef.current = L.polyline(
      followingTrack.points.map((p) => [p.lat, p.lng] as L.LatLngExpression),
      { color: '#a855f7', weight: 4, opacity: 0.85, dashArray: '10 7' }
    ).addTo(mapRef.current)
    return () => { followTrackLineRef.current?.remove(); followTrackLineRef.current = null }
  }, [followingTrack])

  // Navigation line
  useEffect(() => {
    if (!mapRef.current) return
    if (!navTarget) {
      navLineRef.current?.remove(); navLineRef.current = null
      navCasingRef.current?.remove(); navCasingRef.current = null
      navMarkerRef.current?.remove(); navMarkerRef.current = null
      return
    }
    const targetLL: L.LatLngExpression = [navTarget.lat, navTarget.lng]
    if (!navMarkerRef.current) {
      const icon = L.divIcon({ className: '', html: `<div class="nav-target-marker"><div class="nav-target-dot"></div></div>`, iconSize: [20, 20], iconAnchor: [10, 10] })
      navMarkerRef.current = L.marker(targetLL, { icon, zIndexOffset: 1500 }).addTo(mapRef.current)
    } else {
      navMarkerRef.current.setLatLng(targetLL)
    }
    const from: L.LatLngExpression = position ? [position.lat, position.lng] : targetLL
    if (!navLineRef.current) {
      // White casing underneath so the route stays visible on any chart shade
      // (light land, dark water) in both day and night — chartplotter best practice.
      navCasingRef.current = L.polyline([from, targetLL], { color: '#ffffff', weight: 8, opacity: 0.55 }).addTo(mapRef.current)
      navLineRef.current   = L.polyline([from, targetLL], { color: '#16a34a', weight: 4, opacity: 1, dashArray: '14, 8' }).addTo(mapRef.current)
    } else {
      navCasingRef.current?.setLatLngs([from, targetLL])
      navLineRef.current.setLatLngs([from, targetLL])
    }
    if (position) {
      const dist = haversineM(position.lat, position.lng, navTarget.lat, navTarget.lng)
      if (dist < 800) {
        // Close: show both boat and target. Bias toward bottom-right so the
        // alarm/overlay (top in portrait, left in landscape) doesn't cover them.
        const isMob = navTarget.name === 'MOB'
        mapRef.current.fitBounds(L.latLngBounds([from, targetLL]), {
          paddingTopLeft: isMob ? [150, 90] : [100, 100],
          paddingBottomRight: [70, 70],
          maxZoom: 17, animate: true,
        })
      } else {
        // Far: center on boat, zoom to show direction — not the full route
        const zoom = dist < 4000 ? 14 : 13
        mapRef.current.setView([position.lat, position.lng], zoom, { animate: true })
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navTarget])

  useEffect(() => {
    if (!navLineRef.current || !navTarget || !position) return
    const seg: L.LatLngExpression[] = [[position.lat, position.lng], [navTarget.lat, navTarget.lng]]
    navCasingRef.current?.setLatLngs(seg)
    navLineRef.current.setLatLngs(seg)
  }, [position, navTarget])

  // Nav preview line (blue dashed, no overlay)
  useEffect(() => {
    if (!mapRef.current) return
    if (!navPreview) {
      previewLineRef.current?.remove(); previewLineRef.current = null
      previewMarkerRef.current?.remove(); previewMarkerRef.current = null
      return
    }
    const targetLL: L.LatLngExpression = [navPreview.lat, navPreview.lng]
    if (!previewMarkerRef.current) {
      const icon = L.divIcon({ className: '', html: `<div class="nav-target-marker"><div class="nav-target-dot" style="background:#60a5fa;box-shadow:0 0 8px rgba(96,165,250,0.8)"></div></div>`, iconSize: [20, 20], iconAnchor: [10, 10] })
      previewMarkerRef.current = L.marker(targetLL, { icon, zIndexOffset: 1500 }).addTo(mapRef.current)
    } else {
      previewMarkerRef.current.setLatLng(targetLL)
    }
    const from: L.LatLngExpression = position ? [position.lat, position.lng] : targetLL
    if (!previewLineRef.current) {
      previewLineRef.current = L.polyline([from, targetLL], { color: '#60a5fa', weight: 3, opacity: 0.8, dashArray: '10, 8' }).addTo(mapRef.current)
    } else {
      previewLineRef.current.setLatLngs([from, targetLL])
    }
    if (position) {
      // Show both boat and destination — user wants to see the full route before confirming
      mapRef.current.fitBounds(L.latLngBounds([from, targetLL]), {
        padding: [80, 100], maxZoom: 15, animate: true,
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navPreview])

  useEffect(() => {
    if (!previewLineRef.current || !navPreview || !position) return
    previewLineRef.current.setLatLngs([[position.lat, position.lng], [navPreview.lat, navPreview.lng]])
  }, [position, navPreview])

  // MOB marker
  useEffect(() => {
    if (!mapRef.current) return
    if (!mobPoint) {
      mobMarkerRef.current?.remove(); mobMarkerRef.current = null
      return
    }
    const icon = L.divIcon({ className: '', html: `<div class="mob-map-marker"><div class="mob-map-pulse"></div><div class="mob-map-dot">⚠</div></div>`, iconSize: [40, 40], iconAnchor: [20, 20] })
    if (!mobMarkerRef.current) {
      mobMarkerRef.current = L.marker([mobPoint.lat, mobPoint.lng], { icon, zIndexOffset: 2000 }).addTo(mapRef.current)
    } else {
      mobMarkerRef.current.setLatLng([mobPoint.lat, mobPoint.lng]).setIcon(icon)
    }
  }, [mobPoint])

  // Recompute drift periodically while a MOB is active (elapsed time grows).
  useEffect(() => {
    if (!mobPoint) return
    const id = setInterval(() => setDriftTick((t) => t + 1), 15000)
    return () => clearInterval(id)
  }, [mobPoint])

  // MOB drift estimate: dashed line + estimated position + uncertainty circle
  useEffect(() => {
    void driftTick // tving re-run når tiden går
    const map = mapRef.current
    const clear = () => {
      mobDriftLineRef.current?.remove();   mobDriftLineRef.current = null
      mobDriftMarkerRef.current?.remove(); mobDriftMarkerRef.current = null
      mobDriftCircleRef.current?.remove(); mobDriftCircleRef.current = null
    }
    if (!map || !mobPoint) { clear(); return }

    const elapsedSec = (Date.now() - mobPoint.timestamp) / 1000
    const wind = currentWeather ? { windSpeed: currentWeather.windSpeed, windDir: currentWeather.windDir } : null
    const drift = mobDrift(mobPoint.lat, mobPoint.lng, elapsedSec, wind, currentSea)
    // Vis ikke før driften er meningsfull (>15 m), ellers rot rundt punktet.
    if (!drift || drift.distance < 15) { clear(); return }

    const from: L.LatLngExpression = [mobPoint.lat, mobPoint.lng]
    const to: L.LatLngExpression = [drift.lat, drift.lng]

    if (!mobDriftLineRef.current) {
      mobDriftLineRef.current = L.polyline([from, to], {
        color: '#f59e0b', weight: 3, opacity: 0.95, dashArray: '6, 6',
      }).addTo(map)
    } else {
      mobDriftLineRef.current.setLatLngs([from, to])
    }

    if (!mobDriftCircleRef.current) {
      mobDriftCircleRef.current = L.circle(to, {
        radius: drift.radius, color: '#f59e0b', weight: 1.5,
        fillColor: '#f59e0b', fillOpacity: 0.12, dashArray: '4, 4',
      }).addTo(map)
    } else {
      mobDriftCircleRef.current.setLatLng(to).setRadius(drift.radius)
    }

    // Lite rodt person-ikon = der personen trolig er na (estimert drift)
    const dIcon = L.divIcon({
      className: '',
      html: `<div class="mob-drift-marker"><svg viewBox="0 0 24 24" width="15" height="15" fill="white"><circle cx="12" cy="6" r="3.3"/><path d="M12 10.5c-3.2 0-5.5 2.1-5.5 5.2V19h11v-3.3c0-3.1-2.3-5.2-5.5-5.2z"/></svg></div>`,
      iconSize: [26, 26], iconAnchor: [13, 13],
    })
    if (!mobDriftMarkerRef.current) {
      mobDriftMarkerRef.current = L.marker(to, { icon: dIcon, zIndexOffset: 1500 }).addTo(map)
    } else {
      mobDriftMarkerRef.current.setLatLng(to).setIcon(dIcon)
    }
  }, [mobPoint, currentWeather, currentSea, driftTick])

  // Saved spot markers — only when spotsVisible
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const currentIds = new Set(spotsVisible ? savedSpots.map((s) => s.id) : [])
    spotMarkersRef.current.forEach((marker, id) => {
      if (!currentIds.has(id)) { marker.remove(); spotMarkersRef.current.delete(id) }
    })
    if (!spotsVisible) return

    savedSpots.forEach((spot) => {
      const isActive = spot.id === activeSpotId
      const emoji = iconEmoji(spot.icon)
      const html = `<div class="spot-emoji-pin ${isActive ? 'spot-emoji-pin-active' : ''}"><span class="spot-emoji-glyph">${emoji}</span>${isActive ? `<div class="spot-emoji-label">${spot.name}</div>` : ''}</div>`
      const icon = L.divIcon({ className: '', html, iconSize: [28, 28], iconAnchor: [14, 14] })
      if (spotMarkersRef.current.has(spot.id)) {
        spotMarkersRef.current.get(spot.id)!.setLatLng([spot.lat, spot.lng]).setIcon(icon)
      } else {
        const marker = L.marker([spot.lat, spot.lng], { icon, zIndexOffset: 500 }).addTo(map)
        marker.on('click', () => {
          const s = useMapStore.getState()
          if (s.mobPoint) return
          s.setActiveSpot(spot.id)
          s.setSpotMenu({ lat: spot.lat, lng: spot.lng, name: spot.name, id: spot.id })
        })
        spotMarkersRef.current.set(spot.id, marker)
      }
    })
  }, [savedSpots, activeSpotId, spotsVisible])

  // Quick pin markers — temporary navigation pins (multiple)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const activeIds = new Set(quickPins.map((p) => p.id))
    quickPinMarkersRef.current.forEach((m, id) => {
      if (!activeIds.has(id)) { m.remove(); quickPinMarkersRef.current.delete(id) }
    })
    quickPins.forEach((pin, idx) => {
      const sel = pin.id === highlightedQuickPinId
      const cls = sel ? 'quick-pin-marker quick-pin-marker--selected' : 'quick-pin-marker'
      const html = `<div class="${cls}"><span class="quick-pin-num">${idx + 1}</span></div>`
      const icon = L.divIcon({ className: '', html, iconSize: [32, 32], iconAnchor: [16, 16] })
      if (quickPinMarkersRef.current.has(pin.id)) {
        quickPinMarkersRef.current.get(pin.id)!.setLatLng([pin.lat, pin.lng]).setIcon(icon)
      } else {
        const m = L.marker([pin.lat, pin.lng], { icon, zIndexOffset: 900 }).addTo(map)
        // Trykk på et merke → fokuser det (åpne lista + marker raden)
        m.on('click', (e) => {
          L.DomEvent.stopPropagation(e)
          useMapStore.getState().setFocusQuickPin(pin.id)
        })
        quickPinMarkersRef.current.set(pin.id, m)
      }
    })
  }, [quickPins, highlightedQuickPinId])

  // Click to add spot, or tap anywhere to drop a pin.
  // Guard: if click is closing a popup (e.g. AIS vessel info), skip pin creation.
  useEffect(() => {
    if (!mapRef.current) return
    const map = mapRef.current
    const popupJustClosed = { current: false }
    const onPopupClose = () => {
      popupJustClosed.current = true
      setTimeout(() => { popupJustClosed.current = false }, 100)
    }
    // Åpne "Valgt punkt"-menyen (naviger / Google Maps / lagre) der du trykker.
    // Leaflet fyrer ikke 'click' etter en dra-bevegelse, så panorering trigger
    // ikke menyen ved et uhell — trygt å bruke enkelt-trykk.
    const openPointMenu = (lat: number, lng: number) => {
      const s = useMapStore.getState()
      const name = 'Valgt punkt'
      s.setSearchPin({ lat, lng, name })
      s.setSpotMenu({ lat, lng, name })
      s.dismissMapHint()
    }
    // Enkelt-trykk: rask tilgang (viktig i sjøgang der trykk-og-hold feiler).
    // Plasserer sted i "legg til"-modus; ellers åpner/lukker punktmenyen.
    const onClick = (e: L.LeafletMouseEvent) => {
      if (popupJustClosed.current) return
      if (addingSpot) { setPendingSpot({ lat: e.latlng.lat, lng: e.latlng.lng }); return }
      const s = useMapStore.getState()
      if (s.mobPoint) return
      if (s.spotMenu) { s.setSpotMenu(null); s.setSearchPin(null); return }  // trykk igjen lukker
      openPointMenu(e.latlng.lat, e.latlng.lng)
    }
    // Trykk-og-hold (touch) / høyreklikk (desktop) → samme meny, beholdt som fallback.
    const onLongPress = (e: L.LeafletMouseEvent) => {
      if (e.originalEvent) L.DomEvent.preventDefault(e.originalEvent)
      const s = useMapStore.getState()
      if (s.mobPoint || addingSpot || s.spotMenu) return
      openPointMenu(e.latlng.lat, e.latlng.lng)
    }
    map.on('popupclose', onPopupClose)
    map.on('click', onClick)
    map.on('contextmenu', onLongPress)
    map.getContainer().style.cursor = addingSpot ? 'crosshair' : ''
    return () => {
      map.off('popupclose', onPopupClose)
      map.off('click', onClick)
      map.off('contextmenu', onLongPress)
    }
  }, [addingSpot])

  return (
    <>
      <div ref={containerRef} className="w-full h-full">
      </div>
      {!mapHintDismissed && !mobPoint && (
        <div className="map-hint">
          <span>Trykk på kartet for valg</span>
          <button onClick={dismissMapHint}>Vis ikke igjen</button>
        </div>
      )}
      {pendingSpot && <SpotDialog lat={pendingSpot.lat} lng={pendingSpot.lng} onClose={() => setPendingSpot(null)} />}
    </>
  )
}
