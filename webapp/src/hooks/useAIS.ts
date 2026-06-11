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

const ICON_SIZE = 26

function vesselIcon(vessel: AISVessel): L.DivIcon {
  const hdg = vessel.heading > 0 && vessel.heading < 360 ? vessel.heading : 0
  const color = vesselColor(vessel.sog)
  const html = `<div style="
    width:${ICON_SIZE}px;height:${ICON_SIZE}px;
    transform:rotate(${hdg}deg);
    filter:drop-shadow(0 1px 4px rgba(0,0,0,0.85));
  ">
    <svg width="${ICON_SIZE}" height="${ICON_SIZE}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <polygon points="12,2 21,22 12,17 3,22" fill="${color}" stroke="#ffffff" stroke-width="1.8" stroke-linejoin="round"/>
    </svg>
  </div>`
  return L.divIcon({ className: '', html, iconSize: [ICON_SIZE, ICON_SIZE], iconAnchor: [ICON_SIZE / 2, ICON_SIZE / 2] })
}

export function useAIS() {
  const aisVisible  = useMapStore((s) => s.aisVisible)
  const aisKey      = useMapStore((s) => s.aisKey)
  const mapBounds   = useMapStore((s) => s.mapBounds)

  const wsRef         = useRef<WebSocket | null>(null)
  const markersRef    = useRef<Map<number, L.Marker>>(new Map())
  const layerRef      = useRef<L.LayerGroup | null>(null)
  const boundsRef     = useRef(mapBounds)
  const subTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectRef  = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keep bounds ref current without triggering re-subscription immediately
  useEffect(() => { boundsRef.current = mapBounds }, [mapBounds])

  const sendSubscription = useCallback(() => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN || !aisKey) return
    // aisstream closes the socket (code 1006) if no subscription arrives within
    // 3 s of connecting. If the map bounds aren't ready yet, fall back to a
    // wide box around Norway so we always subscribe in time.
    const b = boundsRef.current
    const box = b
      ? [[b.south, b.west], [b.north, b.east]]
      : [[57, 4], [72, 32]]
    ws.send(JSON.stringify({
      APIKey: aisKey,
      BoundingBoxes: [box],
      FilterMessageTypes: ['PositionReport'],
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
      if (reconnectRef.current) { clearTimeout(reconnectRef.current); reconnectRef.current = null }
      wsRef.current?.close(1000)
      wsRef.current = null
      layerRef.current?.clearLayers()
      markersRef.current.clear()
      useMapStore.getState().setAisStatus({ state: 'idle', count: 0, message: '' })
      return
    }

    const setAisStatus = useMapStore.getState().setAisStatus
    let cancelled = false       // set on cleanup so a closing socket doesn't reconnect
    let attempt = 0             // reconnect attempt counter (for backoff)

    const map = getMapInstance()
    if (!layerRef.current) {
      layerRef.current = L.layerGroup().addTo(map!)
    }

    const connect = () => {
      if (cancelled) return
      setAisStatus({ state: 'connecting', count: markersRef.current.size, message: attempt === 0 ? 'Kobler til…' : 'Kobler til på nytt…' })

      const ws = new WebSocket('wss://stream.aisstream.io/v0/stream')
      // aisstream sends each report as a binary frame. Force ArrayBuffer so we can
      // decode it synchronously — the default 'blob' makes e.data a Blob, and
      // JSON.parse(String(blob)) === JSON.parse('[object Blob]') silently fails.
      ws.binaryType = 'arraybuffer'
      wsRef.current = ws

      ws.onopen = () => {
        sendSubscription()
        setAisStatus({ state: 'connecting', count: markersRef.current.size, message: 'Venter på fartøy…' })
      }

      ws.onmessage = (e: MessageEvent) => {
        try {
          const raw = typeof e.data === 'string'
            ? e.data
            : new TextDecoder().decode(e.data as ArrayBuffer)
          const msg = JSON.parse(raw)

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

          attempt = 0   // healthy data — reset backoff

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

      ws.onerror = () => { /* close handler decides what to do next */ }

      ws.onclose = (ev) => {
        if (cancelled || ev.code === 1000) return   // intentional shutdown

        // Unexpected close. Most common cause is aisstream's single-connection
        // limit per key: a stale socket (previous deploy) or the SAME app open on
        // another device/tab is holding the only allowed slot. Retry with backoff.
        attempt += 1
        const delayMs = Math.min(4000 * attempt, 30000)
        const secs = Math.round(delayMs / 1000)
        // After a few failed attempts it's almost certainly a competing connection,
        // not a transient hiccup — tell the user so they can close the other one.
        const msg = attempt >= 3
          ? `AIS opptatt – er appen åpen et annet sted? (forsøk ${attempt})`
          : `Frakoblet – nytt forsøk om ${secs}s…`
        setAisStatus({ state: attempt >= 3 ? 'error' : 'connecting', count: markersRef.current.size, message: msg })
        reconnectRef.current = setTimeout(connect, delayMs)
      }
    }

    connect()

    return () => {
      cancelled = true
      if (reconnectRef.current) { clearTimeout(reconnectRef.current); reconnectRef.current = null }
      if (subTimerRef.current) clearTimeout(subTimerRef.current)
      wsRef.current?.close(1000)
      wsRef.current = null
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
