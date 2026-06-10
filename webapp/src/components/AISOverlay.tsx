import { useEffect, useRef, useCallback } from 'react'
import L from 'leaflet'
import { useMapStore } from '../store/useMapStore'
import { getMapInstance } from '../mapInstance'

interface AISVessel {
  mmsi: number
  name: string
  latitude: number
  longitude: number
  speedOverGround: number
  courseOverGround: number
  trueHeading: number
  shipType: number
  msgtime: string
  destination?: string
}

function shipColor(t: number): string {
  if (t >= 70 && t <= 79) return '#f97316' // cargo
  if (t >= 80 && t <= 89) return '#ef4444' // tanker
  if (t >= 60 && t <= 69) return '#60a5fa' // passenger
  if (t === 30 || (t >= 31 && t <= 33)) return '#4ade80' // fishing
  if (t >= 40 && t <= 49) return '#34d399' // high speed
  if (t === 35 || t === 36) return '#e2e8f0' // sailing
  return '#94a3b8'
}

function shipLabel(t: number): string {
  if (t >= 70 && t <= 79) return 'Lasteskip'
  if (t >= 80 && t <= 89) return 'Tanker'
  if (t >= 60 && t <= 69) return 'Passasjerskip'
  if (t === 30 || (t >= 31 && t <= 33)) return 'Fiskefartøy'
  if (t >= 40 && t <= 49) return 'Hurtigbåt'
  if (t === 35 || t === 36) return 'Seilbåt'
  return 'Fartøy'
}

function vesselIcon(heading: number, shipType: number): L.DivIcon {
  const color = shipColor(shipType)
  const size = 20
  const h = heading >= 0 && heading <= 360 ? heading : 0
  return L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;transform:rotate(${h}deg);filter:drop-shadow(0 1px 3px rgba(0,0,0,0.8))">
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2 L20 20 L12 16 L4 20 Z" fill="${color}" stroke="rgba(0,0,0,0.6)" stroke-width="1.5" stroke-linejoin="round"/>
      </svg>
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

export default function AISOverlay() {
  const aisVisible  = useMapStore((s) => s.aisVisible)
  const mapBounds   = useMapStore((s) => s.mapBounds)
  const markersRef  = useRef<Map<number, L.Marker>>(new Map())
  const pollRef     = useRef<ReturnType<typeof setInterval> | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const boundsRef   = useRef(mapBounds)

  useEffect(() => { boundsRef.current = mapBounds }, [mapBounds])

  const fetchAIS = useCallback(async () => {
    const b = boundsRef.current
    const map = getMapInstance()
    if (!b || !map) return
    try {
      const res = await fetch(
        `/.netlify/functions/ais` +
        `?north=${b.north.toFixed(4)}&south=${b.south.toFixed(4)}` +
        `&east=${b.east.toFixed(4)}&west=${b.west.toFixed(4)}`
      )
      if (!res.ok) return
      const vessels: AISVessel[] = await res.json()

      const seen = new Set<number>()
      vessels.forEach((v) => {
        if (!v.latitude || !v.longitude) return
        seen.add(v.mmsi)
        const hdg = v.trueHeading > 0 && v.trueHeading <= 360
          ? v.trueHeading
          : v.courseOverGround
        const icon = vesselIcon(hdg, v.shipType)
        const existing = markersRef.current.get(v.mmsi)
        if (existing) {
          existing.setLatLng([v.latitude, v.longitude]).setIcon(icon)
        } else {
          const m = L.marker([v.latitude, v.longitude], { icon, zIndexOffset: 300 })
          m.bindPopup(
            `<div style="font-size:13px;line-height:1.6;min-width:150px">
               <strong>${v.name || 'Ukjent'}</strong><br/>
               ${shipLabel(v.shipType)}<br/>
               MMSI: ${v.mmsi}<br/>
               Fart: ${v.speedOverGround.toFixed(1)} kn<br/>
               Kurs: ${Math.round(v.courseOverGround)}°${v.destination ? `<br/>Til: ${v.destination}` : ''}
             </div>`,
            { maxWidth: 220 }
          )
          m.addTo(map)
          markersRef.current.set(v.mmsi, m)
        }
      })

      markersRef.current.forEach((m, mmsi) => {
        if (!seen.has(mmsi)) { m.remove(); markersRef.current.delete(mmsi) }
      })
    } catch { /* nettverksfeil – prøv igjen ved neste poll */ }
  }, [])

  // Start/stopp polling
  useEffect(() => {
    if (!aisVisible) {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
      markersRef.current.forEach((m) => m.remove())
      markersRef.current.clear()
      return
    }
    fetchAIS()
    pollRef.current = setInterval(fetchAIS, 60_000)
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    }
  }, [aisVisible, fetchAIS])

  // Hent nye fartøy når kartvinduet endres (debounced)
  useEffect(() => {
    if (!aisVisible) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(fetchAIS, 800)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [mapBounds, aisVisible, fetchAIS])

  return null
}
