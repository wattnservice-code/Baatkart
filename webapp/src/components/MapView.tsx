import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useMapStore } from '../store/useMapStore'
import SpotDialog from './SpotDialog'
import WaypointDialog from './WaypointDialog'
import { getTile } from '../offline/tileDb'
import { tileKey } from '../offline/tileCalc'
import { setMapInstance } from '../mapInstance'

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
        recordTileHit(true) // treat as "offline" — tile is just missing
        // leave img.src blank: tile renders as empty
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

function ringRadius(zoom: number): number {
  if (zoom >= 15) return 100
  if (zoom >= 13) return 500
  if (zoom >= 11) return 1000
  return 5000
}

function formatRingLabel(m: number): string {
  return m >= 1000 ? `${m / 1000} km` : `${m} m`
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
  const compassLineRef  = useRef<L.Polyline | null>(null)
  const rangeRingRef    = useRef<L.Circle | null>(null)
  const ringLabelRef    = useRef<L.Marker | null>(null)
  const mobTrackLineRef   = useRef<L.Polyline | null>(null)
  const mobMarkerRef      = useRef<L.Marker | null>(null)
  const anchorMarkerRef   = useRef<L.Marker | null>(null)
  const anchorCircleRef   = useRef<L.Circle | null>(null)
  const navLineRef        = useRef<L.Polyline | null>(null)
  const navMarkerRef      = useRef<L.Marker | null>(null)
  const previewLineRef    = useRef<L.Polyline | null>(null)
  const previewMarkerRef  = useRef<L.Marker | null>(null)
  const baseTileRef     = useRef<L.TileLayer | null>(null)
  const kartvTileRef    = useRef<L.TileLayer | null>(null)
  const seamarkTileRef  = useRef<L.TileLayer | null>(null)
  const spotMarkersRef  = useRef<Map<string, L.Marker>>(new Map())

  const [pendingSpot, setPendingSpot]       = useState<{ lat: number; lng: number } | null>(null)
  const [pendingWaypoint, setPendingWaypoint] = useState<{ lat: number; lng: number } | null>(null)
  const waypointLineRef    = useRef<L.Polyline | null>(null)
  const waypointMarkersRef = useRef<Map<string, L.Marker>>(new Map())

  const position         = useMapStore((s) => s.position)
  const positionRef      = useRef(position)
  const track            = useMapStore((s) => s.track)
  const mobTrack         = useMapStore((s) => s.mobTrack)
  const mobPoint         = useMapStore((s) => s.mobPoint)
  const followBoat       = useMapStore((s) => s.followBoat)
  const addingSpot       = useMapStore((s) => s.addingSpot)
  const flyTo            = useMapStore((s) => s.flyTo)
  const navPreview       = useMapStore((s) => s.navPreview)
  const navTarget        = useMapStore((s) => s.navTarget)
  const savedSpots       = useMapStore((s) => s.savedSpots)
  const activeSpotId     = useMapStore((s) => s.activeSpotId)
  const compassEnabled   = useMapStore((s) => s.compassEnabled)
  const compassHeading   = useMapStore((s) => s.compassHeading)
  const darkMode         = useMapStore((s) => s.darkMode)
  const seamarkVisible   = useMapStore((s) => s.seamarkVisible)
  const anchorPoint      = useMapStore((s) => s.anchorPoint)
  const anchorRadius     = useMapStore((s) => s.anchorRadius)
  const anchorAlarm      = useMapStore((s) => s.anchorAlarm)
  const customRingRadius = useMapStore((s) => s.customRingRadius)
  const lookAhead        = useMapStore((s) => s.lookAhead)
  const waypoints        = useMapStore((s) => s.waypoints)
  const addingWaypoint   = useMapStore((s) => s.addingWaypoint)
  const addWaypoint        = useMapStore((s) => s.addWaypoint)
  const setFollowBoat    = useMapStore((s) => s.setFollowBoat)
  const setFlyTo         = useMapStore((s) => s.setFlyTo)

  // Init map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = L.map(containerRef.current, { center: [59.9, 10.7], zoom: 15, zoomControl: false })

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
    map.on('dragstart', () => setFollowBoat(false))

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
        const r = customR ?? ringRadius(zoom)
        rangeRingRef.current.setRadius(r)
        const labelPos = destPoint(pos.lat, pos.lng, 0, r)
        ringLabelRef.current?.setLatLng(labelPos)
        const el = ringLabelRef.current?.getElement()?.querySelector('.ring-label')
        if (el) el.textContent = formatRingLabel(r)
      }
    })

    mapRef.current = map
    return () => { map.remove(); mapRef.current = null; setMapInstance(null) }
  }, [setFollowBoat])

  // Keep position ref current + update route line first point
  useEffect(() => {
    positionRef.current = position
    if (!waypointLineRef.current || !position) return
    const pts = waypointLineRef.current.getLatLngs() as L.LatLng[]
    if (pts.length > 0) {
      pts[0] = L.latLng(position.lat, position.lng)
      waypointLineRef.current.setLatLngs(pts)
    }
  }, [position])

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

  // Boat position + course line + range ring + ring label
  useEffect(() => {
    if (!mapRef.current || !position) return
    const map = mapRef.current
    const latlng: L.LatLngExpression = [position.lat, position.lng]
    const zoom = map.getZoom()
    const speedRadius = position.speed > 0.5 ? Math.max(100, Math.min(10000, position.speed * 120)) : ringRadius(zoom)
    const radius = customRingRadius ?? speedRadius

    // Boat marker
    const size = boatSize(zoom)
    if (!boatMarkerRef.current) {
      const icon = L.divIcon({ className: '', html: boatSvg(position.heading, size), iconSize: [size, size], iconAnchor: [size / 2, size / 2] })
      boatMarkerRef.current = L.marker(latlng, { icon, zIndexOffset: 1000 }).addTo(map)
      map.setView(latlng, Math.max(zoom, 15), { animate: false })
    } else {
      boatMarkerRef.current.setLatLng(latlng)
      if (followBoat) {
        const autoLookAhead = position.speed > 2.06 && position.heading !== undefined
        if ((lookAhead || autoLookAhead)) {
          const b = map.getBounds()
          const viewHeightM = haversineM(b.getSouth(), b.getCenter().lng, b.getNorth(), b.getCenter().lng)
          const center = destPoint(position.lat, position.lng, position.heading, viewHeightM * 0.35)
          map.panTo(center, { animate: true, duration: 0.5 })
        } else {
          map.panTo(latlng, { animate: true, duration: 0.5 })
        }
      }
    }

    // GPS course predictor line — orange dashed (2 min ahead, min 300m)
    const courseLen = Math.max(300, Math.min(position.speed * 120, 3000))
    const courseEnd = destPoint(position.lat, position.lng, position.heading, courseLen)
    if (!courseLineRef.current) {
      courseLineRef.current = L.polyline([latlng, courseEnd], { color: '#fb923c', weight: 3, opacity: 0.9, dashArray: '8, 6' }).addTo(map)
    } else {
      courseLineRef.current.setLatLngs([latlng, courseEnd])
    }

    // Range ring
    if (!rangeRingRef.current) {
      rangeRingRef.current = L.circle(latlng, {
        radius, color: '#94a3b8', weight: 1.5, opacity: 0.6,
        fill: true, fillColor: '#94a3b8', fillOpacity: 0.04,
      }).addTo(map)
    } else {
      rangeRingRef.current.setLatLng(latlng).setRadius(radius)
    }

    // Ring label (north edge, red text)
    const labelPos = destPoint(position.lat, position.lng, 0, radius)
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

  // Boat rotation — compass heading takes priority over GPS heading
  useEffect(() => {
    if (!boatMarkerRef.current) return
    const isCompassActive = compassEnabled && compassHeading !== null && !isNaN(compassHeading)
    const h = isCompassActive ? compassHeading! : (position?.heading ?? 0)
    const inner = boatMarkerRef.current.getElement()?.querySelector('div') as HTMLElement | null
    if (inner) inner.style.transform = `rotate(${h}deg)`
  }, [position, compassEnabled, compassHeading])

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
    const compassEnd = destPoint(position.lat, position.lng, compassHeading!, 800)
    if (!compassLineRef.current) {
      compassLineRef.current = L.polyline([latlng, compassEnd], {
        color: '#38bdf8', weight: 3, opacity: 0.95,
      }).addTo(mapRef.current)
    } else {
      compassLineRef.current.setLatLngs([latlng, compassEnd])
    }
  }, [position, compassEnabled, compassHeading])

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
      navLineRef.current = L.polyline([from, targetLL], { color: '#4ade80', weight: 4, opacity: 1, dashArray: '14, 8' }).addTo(mapRef.current)
    } else {
      navLineRef.current.setLatLngs([from, targetLL])
    }
    if (position) {
      const dist = haversineM(position.lat, position.lng, navTarget.lat, navTarget.lng)
      if (dist < 800) {
        // Close: show both boat and target
        mapRef.current.fitBounds(L.latLngBounds([from, targetLL]), { padding: [100, 100], maxZoom: 16, animate: true })
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
    navLineRef.current.setLatLngs([[position.lat, position.lng], [navTarget.lat, navTarget.lng]])
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

  // Anchor marker + alarm circle
  useEffect(() => {
    if (!mapRef.current) return
    if (!anchorPoint) {
      anchorMarkerRef.current?.remove(); anchorMarkerRef.current = null
      anchorCircleRef.current?.remove(); anchorCircleRef.current = null
      return
    }
    const latlng: L.LatLngExpression = [anchorPoint.lat, anchorPoint.lng]
    const color = anchorAlarm ? '#ef4444' : '#f59e0b'
    const icon = L.divIcon({
      className: '',
      html: `<div style="font-size:24px;line-height:1;filter:drop-shadow(0 1px 3px rgba(0,0,0,0.7))">⚓</div>`,
      iconSize: [28, 28], iconAnchor: [14, 14],
    })
    if (!anchorMarkerRef.current) {
      anchorMarkerRef.current = L.marker(latlng, { icon, zIndexOffset: 900 }).addTo(mapRef.current)
    } else {
      anchorMarkerRef.current.setLatLng(latlng)
    }
    if (!anchorCircleRef.current) {
      anchorCircleRef.current = L.circle(latlng, {
        radius: anchorRadius, color, weight: 2, opacity: 0.8,
        fill: true, fillColor: color, fillOpacity: 0.08,
      }).addTo(mapRef.current)
    } else {
      anchorCircleRef.current.setLatLng(latlng).setRadius(anchorRadius)
        .setStyle({ color, fillColor: color })
    }
  }, [anchorPoint, anchorRadius, anchorAlarm])

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

  // Saved spot markers
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const currentIds = new Set(savedSpots.map((s) => s.id))
    spotMarkersRef.current.forEach((marker, id) => {
      if (!currentIds.has(id)) { marker.remove(); spotMarkersRef.current.delete(id) }
    })

    savedSpots.forEach((spot) => {
      const isActive = spot.id === activeSpotId
      const size = isActive ? 22 : 14
      const html = isActive
        ? `<div class="spot-pin spot-pin-active"><div class="spot-pin-label">${spot.name}</div></div>`
        : `<div class="spot-pin"></div>`
      const icon = L.divIcon({ className: '', html, iconSize: [size, size], iconAnchor: [size / 2, size] })
      if (spotMarkersRef.current.has(spot.id)) {
        spotMarkersRef.current.get(spot.id)!.setLatLng([spot.lat, spot.lng]).setIcon(icon)
      } else {
        const marker = L.marker([spot.lat, spot.lng], { icon, zIndexOffset: 500 }).addTo(map)
        marker.on('click', () => {
          useMapStore.getState().setActiveSpot(spot.id)
          map.flyTo([spot.lat, spot.lng], Math.max(map.getZoom(), 14), { animate: true, duration: 0.8 })
        })
        spotMarkersRef.current.set(spot.id, marker)
      }
    })
  }, [savedSpots, activeSpotId])

  // Route line + draggable waypoint markers
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    // Build full route: position → waypoints → navTarget (or navPreview while planning)
    const pos = positionRef.current
    const terminal = navTarget ?? navPreview
    const routePts: L.LatLngExpression[] = [
      ...(pos ? [[pos.lat, pos.lng] as L.LatLngExpression] : []),
      ...waypoints.map((w) => [w.lat, w.lng] as L.LatLngExpression),
      ...(terminal ? [[terminal.lat, terminal.lng] as L.LatLngExpression] : []),
    ]

    // Hide green nav line when waypoints exist — route shows the full path
    if (waypoints.length > 0 && navLineRef.current) {
      navLineRef.current.setStyle({ opacity: 0 })
    } else if (navLineRef.current) {
      navLineRef.current.setStyle({ opacity: 1 })
    }

    // Hide blue preview line when waypoints exist — purple route line covers the path
    if (waypoints.length > 0 && previewLineRef.current) {
      previewLineRef.current.setStyle({ opacity: 0 })
    } else if (previewLineRef.current) {
      previewLineRef.current.setStyle({ opacity: 1 })
    }

    // Route line
    if (routePts.length >= 2) {
      if (!waypointLineRef.current) {
        waypointLineRef.current = L.polyline(routePts, { color: '#a78bfa', weight: 4, opacity: 0.85, dashArray: '10, 6' }).addTo(map)
      } else {
        waypointLineRef.current.setLatLngs(routePts)
      }

      // Click on route line → insert waypoint at nearest segment
      waypointLineRef.current.off('click')
      waypointLineRef.current.on('click', (e: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e)
        const clicked = e.latlng
        const pts = routePts.map((p) => Array.isArray(p) ? L.latLng(p[0], p[1]) : L.latLng((p as L.LatLngLiteral).lat, (p as L.LatLngLiteral).lng))
        let minDist = Infinity, insertIdx = 0
        for (let i = 0; i < pts.length - 1; i++) {
          const dx = pts[i + 1].lat - pts[i].lat, dy = pts[i + 1].lng - pts[i].lng
          const t = dx || dy ? Math.max(0, Math.min(1, ((clicked.lat - pts[i].lat) * dx + (clicked.lng - pts[i].lng) * dy) / (dx * dx + dy * dy))) : 0
          const d = clicked.distanceTo(L.latLng(pts[i].lat + t * dx, pts[i].lng + t * dy))
          if (d < minDist) { minDist = d; insertIdx = i }
        }
        const wpIdx = Math.min(insertIdx, useMapStore.getState().waypoints.length)
        useMapStore.getState().insertWaypointAt(
          { id: `wp-${Date.now()}`, lat: clicked.lat, lng: clicked.lng, name: `WP${useMapStore.getState().waypoints.length + 1}` },
          wpIdx
        )
      })
    } else {
      waypointLineRef.current?.remove()
      waypointLineRef.current = null
    }

    // Waypoint markers (draggable)
    const currentIds = new Set(waypoints.map((w) => w.id))
    waypointMarkersRef.current.forEach((marker, id) => {
      if (!currentIds.has(id)) { marker.remove(); waypointMarkersRef.current.delete(id) }
    })

    waypoints.forEach((wp, i) => {
      const html = `<div class="waypoint-pin">${i + 1}</div>`
      const icon = L.divIcon({ className: '', html, iconSize: [28, 28], iconAnchor: [14, 14] })
      if (waypointMarkersRef.current.has(wp.id)) {
        waypointMarkersRef.current.get(wp.id)!.setLatLng([wp.lat, wp.lng]).setIcon(icon)
      } else {
        const marker = L.marker([wp.lat, wp.lng], { icon, draggable: true, zIndexOffset: 600 }).addTo(map)
        marker.on('dragend', () => {
          const ll = marker.getLatLng()
          useMapStore.getState().updateWaypoint(wp.id, ll.lat, ll.lng)
        })
        marker.on('click', (e) => {
          L.DomEvent.stopPropagation(e)
          useMapStore.getState().removeWaypoint(wp.id)
        })
        waypointMarkersRef.current.set(wp.id, marker)
      }
    })
  }, [waypoints, navTarget, navPreview])

  // Click to add spot or waypoint
  useEffect(() => {
    if (!mapRef.current) return
    const map = mapRef.current
    const onClick = (e: L.LeafletMouseEvent) => {
      if (addingWaypoint) setPendingWaypoint({ lat: e.latlng.lat, lng: e.latlng.lng })
      else if (addingSpot) setPendingSpot({ lat: e.latlng.lat, lng: e.latlng.lng })
    }
    map.on('click', onClick)
    map.getContainer().style.cursor = (addingSpot || addingWaypoint) ? 'crosshair' : ''
    return () => { map.off('click', onClick) }
  }, [addingSpot, addingWaypoint])

  return (
    <>
      <div ref={containerRef} className="w-full h-full" />
      {pendingSpot && <SpotDialog lat={pendingSpot.lat} lng={pendingSpot.lng} onClose={() => setPendingSpot(null)} />}
      {pendingWaypoint && (
        <WaypointDialog
          lat={pendingWaypoint.lat}
          lng={pendingWaypoint.lng}
          index={waypoints.length + 1}
          onSave={(name) => {
            addWaypoint({ id: `wp-${Date.now()}`, lat: pendingWaypoint.lat, lng: pendingWaypoint.lng, name })
            setPendingWaypoint(null)
          }}
          onClose={() => { setPendingWaypoint(null); useMapStore.getState().setAddingWaypoint(true) }}
        />
      )}
    </>
  )
}
