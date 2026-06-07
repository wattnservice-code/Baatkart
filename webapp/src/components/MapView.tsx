import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useMapStore } from '../store/useMapStore'

// OSM as global fallback base layer
const OSM_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const OSM_ATTR = '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'

// Kartverket sjøkartraster on top — covers Norwegian waters, transparent elsewhere
const SJOKAART_URL =
  'https://opencache.statkart.no/gatekeeper/gk/gk.open_nib?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=sjokartraster&STYLE=default&FORMAT=image/png&TILEMATRIXSET=googlemaps&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}'
const SJOKAART_ATTR = '&copy; <a href="https://kartverket.no">Kartverket</a>'

// OpenSeaMap seamark overlay (buoys, rocks, lights etc)
const SEAMARK_URL = 'https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png'
const SEAMARK_ATTR = '&copy; <a href="https://openseamap.org">OpenSeaMap</a>'

const BOAT_SIZE = 48

function boatIconHtml(heading: number) {
  return `
    <div style="
      width:${BOAT_SIZE}px;
      height:${BOAT_SIZE}px;
      display:flex;
      align-items:center;
      justify-content:center;
      transform:rotate(${heading}deg);
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.6));
      font-size:36px;
      line-height:1;
    ">⛵</div>`
}

export default function MapView() {
  const mapRef = useRef<L.Map | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const boatMarkerRef = useRef<L.Marker | null>(null)
  const trackLineRef = useRef<L.Polyline | null>(null)
  const followingBoat = useRef(true)

  const position = useMapStore((s) => s.position)
  const track = useMapStore((s) => s.track)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      center: [59.9, 10.7],
      zoom: 13,
      zoomControl: false,
    })

    L.tileLayer(OSM_URL, { attribution: OSM_ATTR, maxZoom: 19 }).addTo(map)

    L.tileLayer(SJOKAART_URL, {
      attribution: SJOKAART_ATTR,
      maxZoom: 19,
      tileSize: 256,
      errorTileUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
    }).addTo(map)

    L.tileLayer(SEAMARK_URL, {
      attribution: SEAMARK_ATTR,
      maxZoom: 19,
      opacity: 1,
    }).addTo(map)

    L.control.zoom({ position: 'bottomright' }).addTo(map)

    // Stop auto-following when user drags the map
    map.on('dragstart', () => { followingBoat.current = false })

    mapRef.current = map
    return () => { map.remove(); mapRef.current = null }
  }, [])

  // Update boat position
  useEffect(() => {
    if (!mapRef.current || !position) return
    const latlng: L.LatLngExpression = [position.lat, position.lng]

    if (!boatMarkerRef.current) {
      const icon = L.divIcon({
        className: '',
        html: boatIconHtml(position.heading),
        iconSize: [BOAT_SIZE, BOAT_SIZE],
        iconAnchor: [BOAT_SIZE / 2, BOAT_SIZE / 2],
      })
      boatMarkerRef.current = L.marker(latlng, { icon, zIndexOffset: 1000 }).addTo(mapRef.current)
      mapRef.current.setView(latlng, mapRef.current.getZoom(), { animate: false })
      followingBoat.current = true
    } else {
      boatMarkerRef.current.setLatLng(latlng)
      const el = boatMarkerRef.current.getElement()
      if (el) {
        const inner = el.querySelector('div') as HTMLElement
        if (inner) inner.style.transform = `rotate(${position.heading}deg)`
      }

      // Pan smoothly if following
      if (followingBoat.current) {
        mapRef.current.panTo(latlng, { animate: true, duration: 0.5 })
      }
    }
  }, [position])

  // Update track line
  useEffect(() => {
    if (!mapRef.current) return
    const points = track.map((p) => [p.lat, p.lng] as L.LatLngExpression)

    if (!trackLineRef.current) {
      trackLineRef.current = L.polyline(points, {
        color: '#3b82f6',
        weight: 3,
        opacity: 0.8,
      }).addTo(mapRef.current)
    } else {
      trackLineRef.current.setLatLngs(points)
    }
  }, [track])

  return <div ref={containerRef} className="w-full h-full" />
}
