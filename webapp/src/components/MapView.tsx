import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useMapStore } from '../store/useMapStore'
import FishingSpotDialog from './FishingSpotDialog'

const OSM_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const OSM_ATTR = '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
const SJOKAART_URL = 'https://cache.kartverket.no/v1/wmts/1.0.0/sjokartraster/default/webmercator/{z}/{y}/{x}.png'
const SJOKAART_ATTR = '&copy; <a href="https://kartverket.no">Kartverket</a>'
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
      font-size:32px;
      line-height:1;
    ">🛥️</div>`
}

function fishingSpotIcon(name: string) {
  return L.divIcon({
    className: '',
    html: `<div class="spot-marker">
      <span class="spot-emoji">🎣</span>
      <span class="spot-label">${name}</span>
    </div>`,
    iconSize: [120, 40],
    iconAnchor: [20, 20],
  })
}

export default function MapView() {
  const mapRef = useRef<L.Map | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const boatMarkerRef = useRef<L.Marker | null>(null)
  const trackLineRef = useRef<L.Polyline | null>(null)
  const spotMarkersRef = useRef<Map<string, L.Marker>>(new Map())

  const [pendingSpot, setPendingSpot] = useState<{ lat: number; lng: number } | null>(null)

  const position = useMapStore((s) => s.position)
  const track = useMapStore((s) => s.track)
  const fishingSpots = useMapStore((s) => s.fishingSpots)
  const followBoat = useMapStore((s) => s.followBoat)
  const addingSpot = useMapStore((s) => s.addingSpot)
  const setFollowBoat = useMapStore((s) => s.setFollowBoat)
  const removeFishingSpot = useMapStore((s) => s.removeFishingSpot)

  // Init map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      center: [59.9, 10.7],
      zoom: 13,
      zoomControl: false,
    })

    L.tileLayer(OSM_URL, { attribution: OSM_ATTR, maxZoom: 19 }).addTo(map)
    L.tileLayer(SJOKAART_URL, { attribution: SJOKAART_ATTR, maxZoom: 19 }).addTo(map)
    L.tileLayer(SEAMARK_URL, { attribution: SEAMARK_ATTR, maxZoom: 19, opacity: 1 }).addTo(map)
    L.control.zoom({ position: 'bottomright' }).addTo(map)

    map.on('dragstart', () => setFollowBoat(false))

    mapRef.current = map
    return () => { map.remove(); mapRef.current = null }
  }, [setFollowBoat])

  // Handle map click for adding fishing spot
  useEffect(() => {
    if (!mapRef.current) return
    const map = mapRef.current

    const onClick = (e: L.LeafletMouseEvent) => {
      if (!addingSpot) return
      setPendingSpot({ lat: e.latlng.lat, lng: e.latlng.lng })
    }

    map.on('click', onClick)
    if (addingSpot) {
      map.getContainer().style.cursor = 'crosshair'
    } else {
      map.getContainer().style.cursor = ''
    }

    return () => { map.off('click', onClick) }
  }, [addingSpot])

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
    } else {
      boatMarkerRef.current.setLatLng(latlng)
      const el = boatMarkerRef.current.getElement()
      if (el) {
        const inner = el.querySelector('div') as HTMLElement
        if (inner) inner.style.transform = `rotate(${position.heading}deg)`
      }
      if (followBoat) {
        mapRef.current.panTo(latlng, { animate: true, duration: 0.5 })
      }
    }
  }, [position, followBoat])

  // Update track
  useEffect(() => {
    if (!mapRef.current) return
    const points = track.map((p) => [p.lat, p.lng] as L.LatLngExpression)
    if (!trackLineRef.current) {
      trackLineRef.current = L.polyline(points, { color: '#3b82f6', weight: 3, opacity: 0.8 }).addTo(mapRef.current)
    } else {
      trackLineRef.current.setLatLngs(points)
    }
  }, [track])

  // Sync fishing spot markers
  useEffect(() => {
    if (!mapRef.current) return
    const map = mapRef.current
    const existing = spotMarkersRef.current

    // Remove deleted spots
    existing.forEach((marker, id) => {
      if (!fishingSpots.find((s) => s.id === id)) {
        marker.remove()
        existing.delete(id)
      }
    })

    // Add new spots
    fishingSpots.forEach((spot) => {
      if (!existing.has(spot.id)) {
        const marker = L.marker([spot.lat, spot.lng], { icon: fishingSpotIcon(spot.name) })
          .addTo(map)
          .bindPopup(`
            <div style="text-align:center">
              <strong>${spot.name}</strong><br/>
              <small>${spot.lat.toFixed(5)}, ${spot.lng.toFixed(5)}</small><br/>
              <button onclick="window.deleteSpot('${spot.id}')" style="margin-top:6px;padding:2px 10px;background:#ef4444;color:white;border:none;border-radius:4px;cursor:pointer">Slett</button>
            </div>
          `)
        existing.set(spot.id, marker)
      }
    })

    // Global delete handler for popup button
    ;(window as unknown as Record<string, unknown>).deleteSpot = (id: string) => {
      removeFishingSpot(id)
      map.closePopup()
    }
  }, [fishingSpots, removeFishingSpot])

  return (
    <>
      <div ref={containerRef} className="w-full h-full" />
      {pendingSpot && (
        <FishingSpotDialog
          lat={pendingSpot.lat}
          lng={pendingSpot.lng}
          onClose={() => setPendingSpot(null)}
        />
      )}
    </>
  )
}
