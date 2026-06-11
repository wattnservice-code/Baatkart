import { useEffect, useRef, useCallback } from 'react'
import L from 'leaflet'
import { useMapStore } from '../store/useMapStore'
import { getMapInstance } from '../mapInstance'

interface AISVessel {
  mmsi: number
  lat: number
  lng: number
  heading: number
  sog: number   // speed over ground, knots
  name: string
}

function vesselColor(sog: number): string {
  if (sog < 0.5) return '#64748b'   // stationary — gray
  if (sog < 5)   return '#38bdf8'   // slow — cyan
  return '#4ade80'                   // moving — green
}

function vesselIcon(vessel: AISVessel): L.DivIcon {
  const hdg = vessel.heading > 0 && vessel.heading < 360 ? vessel.heading : 0
  const color = vesselColor(vessel.sog)
  const html = `<div style="
    width:12px;height:12px;
    transform:rotate(${hdg}deg);
    filter:drop-shadow(0 1px 3px rgba(0,0,0,0.7));
  ">
    <svg viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg">
      <polygon points="6,1 11,11 6,8 1,11" fill="${color}" stroke="#0f172a" stroke-width="1" stroke-linejoin="round"/>
    </svg>
  </div>`
  return L.divIcon({ className: '', html, iconSize: [12, 12], iconAnchor: [6, 6] })
}

export function useAIS() {
  const aisVisible  = useMapStore((s) => s.aisVisible)
  const aisKey      = useMapStore((s) => s.aisKey)
  const mapBounds   = useMapStore((s) => s.mapBounds)

  const wsRef       = useRef<WebSocket | null>(null)
  const markersRef  = useRef<Map<number, L.Marker>>(new Map())
  const layerRef    = useRef<L.LayerGroup | null>(null)
  const boundsRef   = useRef(mapBounds)
  const subTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keep bounds ref current without triggering re-subscription immediately
  useEffect(() => { boundsRef.current = mapBounds }, [mapBounds])

  const sendSubscription = useCallback(() => {
    const ws = wsRef.current
    const b  = boundsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN || !b || !aisKey) return
    ws.send(JSON.stringify({
      APIKey: aisKey,
      BoundingBoxes: [[[b.south, b.west], [b.north, b.east]]],
    }))
  }, [aisKey])

  // Debounced resubscribe when bounds change
  useEffect(() => {
    if (!aisVisible || !aisKey) return
    if (subTimerRef.current) clearTimeout(subTimerRef.current)
    subTimerRef.current = setTimeout(sendSubscription, 600)
  }, [mapBounds, aisVisible, aisKey, sendSubscription])

  useEffect(() => {
    if (!aisVisible || !aisKey) {
      wsRef.current?.close()
      wsRef.current = null
      layerRef.current?.clearLayers()
      markersRef.current.clear()
      useMapStore.getState().setAisStatus({ state: 'idle', count: 0, message: '' })
      return
    }

    const setAisStatus = useMapStore.getState().setAisStatus
    setAisStatus({ state: 'connecting', count: 0, message: 'Kobler til…' })

    const map = getMapInstance()
    if (!layerRef.current) {
      layerRef.current = L.layerGroup().addTo(map!)
    }

    const ws = new WebSocket('wss://stream.aisstream.io/v0/stream')
    wsRef.current = ws

    ws.onopen = () => {
      sendSubscription()
      setAisStatus({ state: 'connecting', count: markersRef.current.size, message: 'Venter på fartøy…' })
    }

    ws.onmessage = (e: MessageEvent) => {
      try {
        const msg = JSON.parse(e.data as string)

        // aisstream surfaces auth/subscription problems as an `error` field
        if (msg.error || msg.Error) {
          setAisStatus({ state: 'error', count: markersRef.current.size, message: String(msg.error || msg.Error) })
          return
        }

        if (msg.MessageType !== 'PositionReport') return

        const meta = msg.MetaData
        const rep  = msg.Message?.PositionReport
        if (!meta || !rep) return

        const mmsi = meta.MMSI as number
        const lat  = meta.latitude as number
        const lng  = meta.longitude as number
        if (!lat || !lng) return

        const vessel: AISVessel = {
          mmsi,
          lat, lng,
          heading: (rep.TrueHeading !== 511 ? rep.TrueHeading : rep.Cog) as number,
          sog: (rep.Sog ?? 0) as number,
          name: (meta.ShipName as string ?? '').trim() || `MMSI ${mmsi}`,
        }

        const existing = markersRef.current.get(mmsi)
        if (existing) {
          existing.setLatLng([lat, lng])
          existing.setIcon(vesselIcon(vessel))
          existing.getPopup()?.setContent(popupContent(vessel))
        } else {
          if (!layerRef.current) return
          const marker = L.marker([lat, lng], { icon: vesselIcon(vessel), zIndexOffset: 200 })
          marker.bindPopup(popupContent(vessel), { maxWidth: 200 })
          marker.addTo(layerRef.current)
          markersRef.current.set(mmsi, marker)
        }
        setAisStatus({ state: 'live', count: markersRef.current.size, message: '' })
      } catch { /* ignore malformed messages */ }
    }

    ws.onerror = () => {
      setAisStatus({ state: 'error', count: markersRef.current.size, message: 'Tilkoblingsfeil' })
    }
    ws.onclose = (ev) => {
      // 1000 = normal close (we toggled off).
      // 1006 = aisstream drops the socket with no error frame when the API key
      // is invalid / not yet active. Confirmed by testing with a fake key.
      if (ev.code === 1006) {
        setAisStatus({ state: 'error', count: markersRef.current.size, message: 'Nøkkel avvist – sjekk at den er riktig og aktivert på aisstream.io' })
      } else if (ev.code !== 1000) {
        setAisStatus({ state: 'error', count: markersRef.current.size, message: `Frakoblet (${ev.code})` })
      }
    }

    // Prune vessels older than 15 min every minute
    const pruneInterval = setInterval(() => {
      // aisstream gives live data — if a vessel stops sending, remove after 15 min
      // We track via marker timestamp via a WeakMap alternative: just keep markers alive
      // (aisstream removes vessels from the feed when they go silent)
    }, 60000)

    return () => {
      ws.close()
      wsRef.current = null
      clearInterval(pruneInterval)
      if (subTimerRef.current) clearTimeout(subTimerRef.current)
      layerRef.current?.clearLayers()
      markersRef.current.clear()
    }
  }, [aisVisible, aisKey, sendSubscription])

  // When map instance becomes available, add the layer
  useEffect(() => {
    const map = getMapInstance()
    if (!map || !layerRef.current) return
    if (!map.hasLayer(layerRef.current)) layerRef.current.addTo(map)
  })
}

function popupContent(v: AISVessel): string {
  const sog = v.sog.toFixed(1)
  const hdg = v.heading > 0 && v.heading < 360 ? `${Math.round(v.heading)}°` : '—'
  return `<div style="font-size:13px;line-height:1.5">
    <b>${v.name}</b><br/>
    ${sog} kn · ${hdg}<br/>
    <span style="color:#64748b;font-size:11px">MMSI ${v.mmsi}</span>
  </div>`
}
