import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useMapStore } from '../store/useMapStore'

const OSM_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const OSM_ATTR = '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
const OPENSEAMAP_URL = 'https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png'
const OPENSEAMAP_ATTR = '&copy; <a href="https://openseamap.org">OpenSeaMap</a>'

export default function MapView() {
  const mapRef = useRef<L.Map | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const boatMarkerRef = useRef<L.Marker | null>(null)
  const trackLineRef = useRef<L.Polyline | null>(null)

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
    L.tileLayer(OPENSEAMAP_URL, { attribution: OPENSEAMAP_ATTR, maxZoom: 19, opacity: 0.8 }).addTo(map)
    L.control.zoom({ position: 'bottomright' }).addTo(map)

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
        html: `<div class="boat-icon" style="transform: rotate(${position.heading}deg)">⛵</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      })
      boatMarkerRef.current = L.marker(latlng, { icon }).addTo(mapRef.current)
      mapRef.current.setView(latlng, mapRef.current.getZoom())
    } else {
      boatMarkerRef.current.setLatLng(latlng)
      const el = boatMarkerRef.current.getElement()
      if (el) {
        const inner = el.querySelector('.boat-icon') as HTMLElement
        if (inner) inner.style.transform = `rotate(${position.heading}deg)`
      }
    }
  }, [position])

  // Update track line
  useEffect(() => {
    if (!mapRef.current) return
    const points = track.map((p) => [p.lat, p.lng] as L.LatLngExpression)

    if (!trackLineRef.current) {
      trackLineRef.current = L.polyline(points, { color: '#3b82f6', weight: 3 }).addTo(mapRef.current)
    } else {
      trackLineRef.current.setLatLngs(points)
    }
  }, [track])

  return <div ref={containerRef} className="w-full h-full" />
}
