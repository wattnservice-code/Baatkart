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

const OSM_URL   = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const OSM_ATTR  = '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
const DARK_URL  = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
const DARK_ATTR = '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> &copy; <a href="https://carto.com">CARTO</a>'
const SJOKAART_URL  = 'https://cache.kartverket.no/v1/wmts/1.0.0/sjokartraster/default/webmercator/{z}/{y}/{x}.png'
const SJOKAART_ATTR = '&copy; <a href="https://kartverket.no">Kartverket</a>'
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
  const autoLookAhead = pos.speed > 2.06
  // Boat's vertical screen position: centred when stationary, lower when leading
  const boatY = followBoat && (lookAhead || autoLookAhead) ? 0.5 + LOOK_AHEAD_FRAC : 0.5
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

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180
  const Δφ = (lat2 - lat1) * Math.PI / 180, Δλ = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(Δφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

// Compute endpoint given start, heading (degrees), distance (meters)
function destPoint(lat: number, lng: number, heading: number, meters: number): L.LatLngExpression {
  const R = 6371000
  const δ = meters / R
  const θ = (heading * Math.PI) / 180
  const φ1 = (lat * Math.PI) / 180
  const λ1 = (lng * Math.PI) / 180
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ))
  const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2))
  return [φ2 * 180 / Math.PI, λ2 * 180 / Math.PI]
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
  const autoLookAhead = pos.speed > 2.06 && pos.heading !== undefined
  if (lookAhead || autoLookAhead) {
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
  const mobTrackLineRef   = useRef<L.Polyline | null>(null)
  const mobMarkerRef      = useRef<L.Marker | null>(null)
  const navLineRef        = useRef<L.Polyline | null>(null)
  const navCasingRef      = useRef<L.Polyline | null>(null)
  const navMarkerRef      = useRef<L.Marker | null>(null)
  const previewLineRef    = useRef<L.Polyline | null>(null)
  const previewMarkerRef  = useRef<L.Marker | null>(null)
  const searchPinRef      = useRef<L.Marker | null>(null)
  const baseTileRef     = useRef<L.TileLayer | null>(null)
  const kartvTileRef    = useRef<L.TileLayer | null>(null)
  const seamarkTileRef  = useRef<L.TileLayer | null>(null)
  const resumeFollowRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wasMovingRef    = useRef(false)
  const spotMarkersRef      = useRef<Map<string, L.Marker>>(new Map())
  const quickPinMarkersRef  = useRef<Map<string, L.Marker>>(new Map())
  const followTrackLineRef  = useRef<L.Polyline | null>(null)

  const [pendingSpot, setPendingSpot]       = useState<{ lat: number; lng: number } | null>(null)
  const bearingRef         = useRef(0)   // currently displayed map bearing (deg)
  const targetBearingRef   = useRef(0)   // desired bearing (deg)
  const appliedBearingRef  = useRef(0)   // last bearing pushed to the map
  const rafRef             = useRef<number | null>(null)

  const position         = useMapStore((s) => s.position)
  const positionRef      = useRef(position)
  const track            = useMapStore((s) => s.track)
  const mobTrack         = useMapStore((s) => s.mobTrack)
  const mobPoint         = useMapStore((s) => s.mobPoint)
  const followBoat       = useMapStore((s) => s.followBoat)
  const addingSpot       = useMapStore((s) => s.addingSpot)
  const flyTo            = useMapStore((s) => s.flyTo)
  const searchPin        = useMapStore((s) => s.searchPin)
  const navPreview       = useMapStore((s) => s.navPreview)
  const navTarget        = useMapStore((s) => s.navTarget)
  const savedSpots       = useMapStore((s) => s.savedSpots)
  const activeSpotId     = useMapStore((s) => s.activeSpotId)
  const spotsVisible     = useMapStore((s) => s.spotsVisible)
  const quickPins        = useMapStore((s) => s.quickPins)
  const compassEnabled   = useMapStore((s) => s.compassEnabled)
  const compassHeading   = useMapStore((s) => s.compassHeading)
  const darkMode         = useMapStore((s) => s.darkMode)
  const seamarkVisible   = useMapStore((s) => s.seamarkVisible)
  const customRingRadius = useMapStore((s) => s.customRingRadius)
  const followingTrack   = useMapStore((s) => s.followingTrack)
  const offlineOnly      = useMapStore((s) => s.offlineOnly)
  const lookAhead        = useMapStore((s) => s.lookAhead)
  const headingUp        = useMapStore((s) => s.headingUp)
  const setFollowBoat    = useMapStore((s) => s.setFollowBoat)
  const setFlyTo         = useMapStore((s) => s.setFlyTo)

  // Init map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = L.map(containerRef.current, {
      center: [59.9, 10.7], zoom: 13, zoomControl: false,
      rotate: true, rotateControl: false, touchRotate: false, shiftKeyRotate: false, bearing: 0,
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

    const updateBounds = () => {
      const b = map.getBounds()
      useMapStore.getState().setMapBounds({
        north: b.getNorth(), south: b.getSouth(),
        east: b.getEast(), west: b.getWest(),
      })
    }
    map.on('moveend', updateBounds)
    map.on('zoomend', updateBounds)
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
        const r = customR ?? fitRingRadius(map, pos, st.followBoat, st.lookAhead, zoom)
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
          recenterOnBoat(map, pos, useMapStore.getState().lookAhead, false)
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
    kartvTileRef.current.setOpacity(darkMode ? 0.5 : 0.7)
  }, [darkMode])

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
        const sp = useMapStore.getState().searchPin
        if (sp) useMapStore.getState().setSpotMenu({ lat: sp.lat, lng: sp.lng, name: sp.name })
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
    const mpp = (156543 * Math.cos(position.lat * Math.PI / 180)) / Math.pow(2, zoom)
    // Auto-fit so the whole ring + label stay on screen; honour a manual override.
    const radius = customRingRadius ?? fitRingRadius(map, position, followBoat, lookAhead, zoom)

    // Boat marker
    const size = boatSize(zoom)
    if (!boatMarkerRef.current) {
      const icon = L.divIcon({ className: '', html: boatSvg(position.heading, size), iconSize: [size, size], iconAnchor: [size / 2, size / 2] })
      boatMarkerRef.current = L.marker(latlng, { icon, zIndexOffset: 1000 }).addTo(map)
      map.setView(latlng, Math.max(zoom, 13), { animate: false })
    } else {
      boatMarkerRef.current.setLatLng(latlng)
      if (followBoat) recenterOnBoat(map, position, lookAhead, true)
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

    const target = () => (headingUp ? targetBearingRef.current : 0)

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

  // MOB rescue track (red)
  useEffect(() => {
    if (!mapRef.current) return
    if (mobTrack.length < 2) {
      mobTrackLineRef.current?.remove()
      mobTrackLineRef.current = null
      return
    }
    const pts = mobTrack.map((p) => [p.lat, p.lng] as L.LatLngExpression)
    if (!mobTrackLineRef.current) {
      mobTrackLineRef.current = L.polyline(pts, { color: '#ef4444', weight: 3, opacity: 0.9, dashArray: '8, 5' }).addTo(mapRef.current)
    } else {
      mobTrackLineRef.current.setLatLngs(pts)
    }
  }, [mobTrack])

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
      const html = `<div class="quick-pin-marker"><span class="quick-pin-num">${idx + 1}</span></div>`
      const icon = L.divIcon({ className: '', html, iconSize: [32, 32], iconAnchor: [16, 16] })
      if (quickPinMarkersRef.current.has(pin.id)) {
        quickPinMarkersRef.current.get(pin.id)!.setLatLng([pin.lat, pin.lng]).setIcon(icon)
      } else {
        const m = L.marker([pin.lat, pin.lng], { icon, zIndexOffset: 900 }).addTo(map)
        quickPinMarkersRef.current.set(pin.id, m)
      }
    })
  }, [quickPins])

  // Click to add spot, or tap anywhere to drop a pin
  useEffect(() => {
    if (!mapRef.current) return
    const map = mapRef.current
    const onClick = (e: L.LeafletMouseEvent) => {
      if (addingSpot) { setPendingSpot({ lat: e.latlng.lat, lng: e.latlng.lng }); return }
      const s = useMapStore.getState()
      if (s.spotMenu) return  // backdrop handles dismiss; ignore Leaflet clicks while card is open
      const lat = e.latlng.lat, lng = e.latlng.lng
      const name = 'Valgt punkt'
      s.setSearchPin({ lat, lng, name })
      s.setSpotMenu({ lat, lng, name })
    }
    map.on('click', onClick)
    map.getContainer().style.cursor = addingSpot ? 'crosshair' : ''
    return () => { map.off('click', onClick) }
  }, [addingSpot])

  return (
    <>
      <div ref={containerRef} className="w-full h-full">
      </div>
      {pendingSpot && <SpotDialog lat={pendingSpot.lat} lng={pendingSpot.lng} onClose={() => setPendingSpot(null)} />}
    </>
  )
}
