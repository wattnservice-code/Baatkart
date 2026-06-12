import { useEffect, useRef, useCallback } from 'react'
import L from 'leaflet'
import { useMapStore } from '../store/useMapStore'
import { getMapInstance } from '../mapInstance'
import { collisionAlarm } from '../audio'

interface AISVessel {
  mmsi: number
  lat: number
  lng: number
  heading: number
  sog: number   // speed over ground, knots
  name: string
}

// Static/voyage data (AIS message type 5) — arrives separately from position
// reports and rarely changes, so we cache it per MMSI and merge into the popup.
interface ShipStatic {
  type?: string        // readable category, e.g. "Lasteskip"
  length?: number      // metres
  beam?: number        // metres
  draught?: number     // metres
  destination?: string
  callSign?: string
  imo?: number
}

// AIS ship-type code → Norwegian label (broad categories)
function shipTypeLabel(code: number): string | undefined {
  if (!code) return undefined
  if (code === 30) return 'Fiskefartøy'
  if (code === 31 || code === 32 || code === 52) return 'Slepebåt'
  if (code === 35) return 'Militært'
  if (code === 36) return 'Seilbåt'
  if (code === 37) return 'Fritidsbåt'
  if (code >= 40 && code <= 49) return 'Hurtigbåt'
  if (code === 50) return 'Losbåt'
  if (code === 51) return 'Redningsfartøy'
  if (code === 53) return 'Arbeidsbåt'
  if (code === 55) return 'Myndighet'
  if (code >= 60 && code <= 69) return 'Passasjerskip'
  if (code >= 70 && code <= 79) return 'Lasteskip'
  if (code >= 80 && code <= 89) return 'Tankskip'
  return undefined
}

function vesselColor(sog: number): string {
  if (sog < 5) return '#38bdf8'   // slow — cyan
  return '#4ade80'                 // moving — green
}

function vesselSize(zoom: number): number {
  if (zoom >= 16) return 30
  if (zoom >= 14) return 24
  if (zoom >= 12) return 20
  return 16
}

// ── Collision (CPA/TCPA) ──────────────────────────────────────────────
// CPA = Closest Point of Approach (how near we'd pass if both hold course)
// TCPA = Time to CPA in minutes (positive = approaching, negative = opening)
const DANGER_CPA_M   = 926    // 0.5 nautical miles
const DANGER_TCPA_MIN = 15    // warn if closest approach is within 15 min
const KN_TO_MS = 0.514444

interface OwnState { lat: number; lng: number; speedMs: number; courseDeg: number }
interface CpaInfo { cpaM: number; tcpaMin: number }

function computeCPA(own: OwnState, t: AISVessel): CpaInfo | null {
  const R = 6371000
  const latRad = (own.lat * Math.PI) / 180
  // Target position relative to own (own at origin), in metres. x=east, y=north.
  const px = ((t.lng - own.lng) * Math.PI / 180) * R * Math.cos(latRad)
  const py = ((t.lat - own.lat) * Math.PI / 180) * R
  // Velocity vectors (m/s). Course 0=N, clockwise. vx=east, vy=north.
  const ovx = own.speedMs * Math.sin((own.courseDeg * Math.PI) / 180)
  const ovy = own.speedMs * Math.cos((own.courseDeg * Math.PI) / 180)
  const tSpeed = t.sog * KN_TO_MS
  const tCourse = t.heading > 0 && t.heading < 360 ? t.heading : 0
  const tvx = tSpeed * Math.sin((tCourse * Math.PI) / 180)
  const tvy = tSpeed * Math.cos((tCourse * Math.PI) / 180)
  // Relative velocity (target − own)
  const rvx = tvx - ovx
  const rvy = tvy - ovy
  const rv2 = rvx * rvx + rvy * rvy
  if (rv2 < 1e-4) return { cpaM: Math.hypot(px, py), tcpaMin: 0 }  // no relative motion
  const tcpaSec = -(px * rvx + py * rvy) / rv2
  const cx = px + rvx * tcpaSec
  const cy = py + rvy * tcpaSec
  return { cpaM: Math.hypot(cx, cy), tcpaMin: tcpaSec / 60 }
}

function isDanger(cpa: CpaInfo | null): boolean {
  return !!cpa && cpa.tcpaMin > 0 && cpa.tcpaMin < DANGER_TCPA_MIN && cpa.cpaM < DANGER_CPA_M
}

function vesselIcon(vessel: AISVessel, danger: boolean, zoom: number): L.DivIcon {
  const sz = vesselSize(zoom)
  const hdg = vessel.heading > 0 && vessel.heading < 360 ? vessel.heading : 0
  const color = danger ? '#ef4444' : vesselColor(vessel.sog)
  const wrapCls = danger ? 'ais-danger-wrap' : ''
  const html = `<div class="${wrapCls}" style="width:${sz}px;height:${sz}px;">
    <div style="
      width:${sz}px;height:${sz}px;
      transform:rotate(${hdg}deg);
      filter:drop-shadow(0 1px 4px rgba(0,0,0,0.85));
    ">
      <svg width="${sz}" height="${sz}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <polygon points="12,2 21,22 12,17 3,22" fill="${color}" stroke="#ffffff" stroke-width="1.8" stroke-linejoin="round"/>
      </svg>
    </div>
  </div>`
  return L.divIcon({ className: '', html, iconSize: [sz, sz], iconAnchor: [sz / 2, sz / 2] })
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
  const dangerRef     = useRef<Set<number>>(new Set())
  const lastAlarmRef  = useRef(0)
  const staticRef     = useRef<Map<number, ShipStatic>>(new Map())

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
      FilterMessageTypes: ['PositionReport', 'ShipStaticData'],
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
      dangerRef.current.clear()
      staticRef.current.clear()
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

          // Static/voyage data — cache it and refresh the popup if open
          if (msg.MessageType === 'ShipStaticData') {
            const sd = msg.Message?.ShipStaticData
            const m  = msg.MetaData
            if (!sd || !m) return
            const mmsi = m.MMSI as number
            const dim  = sd.Dimension ?? {}
            const stat: ShipStatic = {
              type: shipTypeLabel(sd.Type as number),
              length: dim.A != null && dim.B != null ? dim.A + dim.B : undefined,
              beam: dim.C != null && dim.D != null ? dim.C + dim.D : undefined,
              draught: sd.MaximumStaticDraught || undefined,
              destination: (sd.Destination as string ?? '').trim() || undefined,
              callSign: (sd.CallSign as string ?? '').trim() || undefined,
              imo: sd.ImoNumber || undefined,
            }
            staticRef.current.set(mmsi, stat)
            const mk = markersRef.current.get(mmsi)
            if (mk?.isPopupOpen()) {
              const name = (m.ShipName as string ?? '').trim() || `MMSI ${mmsi}`
              const ll = mk.getLatLng()
              mk.getPopup()?.setContent(popupContent(
                { mmsi, lat: ll.lat, lng: ll.lng, heading: 0, sog: 0, name },
                null, dangerRef.current.has(mmsi), stat,
              ))
            }
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

          const sog = (rep.Sog ?? 0) as number

          // Drop stationary vessels — they're clutter, not navigation hazards
          if (sog < 0.5) {
            const old = markersRef.current.get(mmsi)
            if (old) { old.remove(); markersRef.current.delete(mmsi) }
            dangerRef.current.delete(mmsi)
            return
          }

          const vessel: AISVessel = {
            mmsi,
            lat, lng,
            heading: (rep.TrueHeading !== 511 ? rep.TrueHeading : rep.Cog) as number,
            sog,
            name: (meta.ShipName as string ?? '').trim() || `MMSI ${mmsi}`,
          }

          const zoom = getMapInstance()?.getZoom() ?? 13

          // Collision check against own boat (needs a GPS fix)
          const pos = useMapStore.getState().position
          const cpa = pos
            ? computeCPA({ lat: pos.lat, lng: pos.lng, speedMs: pos.speed ?? 0, courseDeg: pos.heading ?? 0 }, vessel)
            : null
          const danger = isDanger(cpa)
          const wasDanger = dangerRef.current.has(mmsi)
          if (danger) dangerRef.current.add(mmsi)
          else dangerRef.current.delete(mmsi)

          // Sound + vibrate when a NEW vessel turns into a threat (throttled 8s)
          if (danger && !wasDanger) {
            const now = Date.now()
            if (now - lastAlarmRef.current > 8000) {
              lastAlarmRef.current = now
              collisionAlarm()
            }
          }

          const stat = staticRef.current.get(mmsi)
          const existing = markersRef.current.get(mmsi)
          if (existing) {
            existing.setLatLng([lat, lng])
            existing.setIcon(vesselIcon(vessel, danger, zoom))
            existing.getPopup()?.setContent(popupContent(vessel, cpa, danger, stat))
          } else {
            if (!layerRef.current) return
            const marker = L.marker([lat, lng], { icon: vesselIcon(vessel, danger, zoom), zIndexOffset: danger ? 600 : 200 })
            marker.bindPopup(popupContent(vessel, cpa, danger, stat), { maxWidth: 240 })
            marker.addTo(layerRef.current)
            markersRef.current.set(mmsi, marker)
          }

          const dn = dangerRef.current.size
          setAisStatus({
            state: dn > 0 ? 'warn' : 'live',
            count: markersRef.current.size,
            message: dn > 0 ? `⚠ ${dn} på kollisjonskurs` : '',
          })
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
      dangerRef.current.clear()
      staticRef.current.clear()
    }
  }, [aisVisible, aisKey, sendSubscription])

  // When map instance becomes available, add the layer
  useEffect(() => {
    const map = getMapInstance()
    if (!map || !layerRef.current) return
    if (!map.hasLayer(layerRef.current)) layerRef.current.addTo(map)
  })
}

function popupContent(v: AISVessel, cpa: CpaInfo | null, danger: boolean, stat?: ShipStatic): string {
  const sog = v.sog.toFixed(1)
  const hdg = v.heading > 0 && v.heading < 360 ? `${Math.round(v.heading)}°` : '—'
  let cpaLine = ''
  if (cpa && cpa.tcpaMin > 0 && isFinite(cpa.tcpaMin)) {
    const nm  = (cpa.cpaM / 1852).toFixed(2)
    const min = Math.round(cpa.tcpaMin)
    cpaLine = danger
      ? `<div style="margin-top:4px;color:#ef4444;font-weight:700">⚠ Kollisjonskurs<br/>Passerer ${nm} nm om ${min} min</div>`
      : `<div style="margin-top:4px;color:#94a3b8;font-size:12px">Nærmeste: ${nm} nm om ${min} min</div>`
  }

  // Static/voyage lines — only render what we actually have
  let staticLines = ''
  if (stat) {
    const rows: string[] = []
    if (stat.type) rows.push(stat.type)
    if (stat.length) rows.push(`${Math.round(stat.length)}${stat.beam ? `×${Math.round(stat.beam)}` : ''} m`)
    if (stat.draught) rows.push(`dypg. ${stat.draught.toFixed(1)} m`)
    const line1 = rows.join(' · ')
    const dest = stat.destination ? `<div style="color:#94a3b8;font-size:12px">→ ${stat.destination}</div>` : ''
    if (line1 || dest) {
      staticLines = `<div style="margin-top:4px;color:#cbd5e1;font-size:12px">${line1}</div>${dest}`
    }
  }

  return `<div style="font-size:13px;line-height:1.5">
    <b>${v.name}</b><br/>
    ${sog} kn · ${hdg}
    ${staticLines}
    <div style="color:#64748b;font-size:11px;margin-top:2px">MMSI ${v.mmsi}${stat?.callSign ? ` · ${stat.callSign}` : ''}</div>
    ${cpaLine}
  </div>`
}
