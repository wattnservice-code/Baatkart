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
  cog: number        // course over ground (where it's actually going)
  sog: number        // speed over ground, knots
  navStatus: number  // AIS navigational status code
  rot: number        // rate of turn (-128 = not available)
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
  return 17
}

function navStatusLabel(code: number): string | undefined {
  switch (code) {
    case 1: return 'For anker'
    case 2: return 'Manøvreringsudyktig'
    case 3: return 'Begrenset manøvreringsevne'
    case 4: return 'Begrenset av dypgang'
    case 5: return 'Fortøyd'
    case 6: return 'Grunnstøtt'
    case 7: return 'Fisker'
    default: return undefined
  }
}

function destPointAIS(lat: number, lng: number, headingDeg: number, meters: number): [number, number] {
  const R = 6371000
  const δ = meters / R
  const θ = headingDeg * Math.PI / 180
  const φ1 = lat * Math.PI / 180
  const λ1 = lng * Math.PI / 180
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ))
  const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2))
  return [φ2 * 180 / Math.PI, λ2 * 180 / Math.PI]
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
      filter:drop-shadow(0 0 3px rgba(255,255,255,0.7)) drop-shadow(0 0 6px rgba(0,0,0,1));
    ">
      <svg width="${sz}" height="${sz}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <polygon points="12,2 21,22 12,17 3,22" fill="${color}" stroke="#0f172a" stroke-width="2" stroke-linejoin="round"/>
      </svg>
    </div>
  </div>`
  return L.divIcon({ className: '', html, iconSize: [sz, sz], iconAnchor: [sz / 2, sz / 2] })
}

interface Bounds { north: number; south: number; east: number; west: number }

// Max bounding box half-size in degrees. Prevents aisstream from rejecting the
// subscription or flooding the socket when the user zooms out far. 4° ≈ 440 km.
const MAX_BOX_HALF_DEG = 4

// Produce a valid aisstream box [[south,west],[north,east]]. Clamps to legal
// lat/lon, caps the area to MAX_BOX_HALF_DEG around the box centre (so a wide
// zoom-out doesn't cause aisstream errors), fixes inverted corners, and avoids
// a zero-size box. Falls back to a small box around Oslofjord when not ready.
function clampBox(b: Bounds | null): number[][] {
  if (!b || ![b.north, b.south, b.east, b.west].every(Number.isFinite)) {
    return [[59, 9], [60, 11]]
  }
  let s = Math.max(-90, Math.min(90, Math.min(b.south, b.north)))
  let n = Math.max(-90, Math.min(90, Math.max(b.south, b.north)))
  let w = Math.max(-180, Math.min(180, Math.min(b.west, b.east)))
  let e = Math.max(-180, Math.min(180, Math.max(b.west, b.east)))
  // Cap to MAX_BOX_HALF_DEG from the box centre on each axis
  const latC = (s + n) / 2, lngC = (w + e) / 2
  if (n - s > MAX_BOX_HALF_DEG * 2) { s = latC - MAX_BOX_HALF_DEG; n = latC + MAX_BOX_HALF_DEG }
  if (e - w > MAX_BOX_HALF_DEG * 2) { w = lngC - MAX_BOX_HALF_DEG; e = lngC + MAX_BOX_HALF_DEG }
  s = Math.max(-90, s); n = Math.min(90, n); w = Math.max(-180, w); e = Math.min(180, e)
  if (n - s < 0.02) { n = Math.min(90, n + 0.01); s = Math.max(-90, s - 0.01) }
  if (e - w < 0.02) { e = Math.min(180, e + 0.01); w = Math.max(-180, w - 0.01) }
  return [[s, w], [n, e]]
}

export function useAIS() {
  const aisVisible  = useMapStore((s) => s.aisVisible)
  const aisKey      = useMapStore((s) => s.aisKey)
  const mapBounds   = useMapStore((s) => s.mapBounds)

  const wsRef         = useRef<WebSocket | null>(null)
  const markersRef    = useRef<Map<number, L.Marker>>(new Map())
  const courseLinesRef = useRef<Map<number, L.Polyline>>(new Map())
  const layerRef      = useRef<L.LayerGroup | null>(null)
  const boundsRef     = useRef(mapBounds)
  const subTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dangerRef     = useRef<Set<number>>(new Set())
  const lastAlarmRef  = useRef(0)
  const staticRef     = useRef<Map<number, ShipStatic>>(new Map())
  const lastMsgRef    = useRef(0)        // timestamp of last frame (for the watchdog)
  const watchdogRef   = useRef<ReturnType<typeof setInterval> | null>(null)

  // Keep bounds ref current without triggering re-subscription immediately
  useEffect(() => { boundsRef.current = mapBounds }, [mapBounds])

  const sendSubscription = useCallback(() => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN || !aisKey) return
    // aisstream closes the socket (code 1006) if no subscription arrives within
    // 3 s of connecting, and rejects malformed/degenerate boxes with an error.
    // Clamp to valid ranges and guarantee a sane, non-zero box; fall back to a
    // wide box around Norway if the map bounds aren't ready yet.
    ws.send(JSON.stringify({
      APIKey: aisKey,
      BoundingBoxes: [clampBox(boundsRef.current)],
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
      if (watchdogRef.current) { clearInterval(watchdogRef.current); watchdogRef.current = null }
      wsRef.current?.close(1000)
      wsRef.current = null
      layerRef.current?.clearLayers()
      markersRef.current.clear()
      courseLinesRef.current.clear()
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

    // Single place that schedules a reconnect. Guarded so overlapping triggers
    // (onclose + error + watchdog) can't stack into a reconnect storm. `detail`
    // carries the WebSocket close code/reason so the cause is visible in-app.
    const scheduleReconnect = (reason: string, fixedDelay?: number, detail?: string) => {
      if (cancelled || reconnectRef.current) return
      if (watchdogRef.current) { clearInterval(watchdogRef.current); watchdogRef.current = null }
      try { wsRef.current?.close() } catch { /* already closing */ }
      attempt += 1
      // Gentle backoff: two quick tries, then back right off to 60s so we don't
      // hammer aisstream (which can get the account throttled and cause 1006).
      const delayMs = fixedDelay ?? (attempt <= 2 ? 4000 * attempt : 60000)
      if (attempt >= 3) {
        // Persistent failure. Show the real close code/reason instead of a guess.
        const tail = detail ? ` (${detail})` : ''
        setAisStatus({ state: 'error', count: markersRef.current.size, message: `AIS får ikke kontakt${tail} – sjekk nøkkel/konto` })
      } else if (reason) {
        setAisStatus({ state: 'connecting', count: markersRef.current.size, message: reason })
      }
      reconnectRef.current = setTimeout(() => { reconnectRef.current = null; connect() }, delayMs)
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
        // Watchdog: a silently-dead socket sometimes never fires onclose. If no
        // frame arrives for a while, force a reconnect so AIS self-heals.
        lastMsgRef.current = Date.now()
        if (watchdogRef.current) clearInterval(watchdogRef.current)
        watchdogRef.current = setInterval(() => {
          if (cancelled) return
          if (Date.now() - lastMsgRef.current > 60000) {
            attempt = 0   // silence isn't a connection conflict — don't escalate to "opptatt"
            scheduleReconnect('Ingen data – kobler til på nytt…')
          }
        }, 5000)
      }

      ws.onmessage = (e: MessageEvent) => {
        lastMsgRef.current = Date.now()
        try {
          const raw = typeof e.data === 'string'
            ? e.data
            : new TextDecoder().decode(e.data as ArrayBuffer)
          const msg = JSON.parse(raw)

          // aisstream surfaces auth/subscription problems as an `error` field.
          // Show the real reason and self-heal (retry in 15 s) instead of freezing.
          if (msg.error || msg.Error) {
            setAisStatus({ state: 'error', count: markersRef.current.size, message: `AIS: ${String(msg.error || msg.Error)}` })
            scheduleReconnect('', 15000)
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
                { mmsi, lat: ll.lat, lng: ll.lng, heading: 0, cog: 0, sog: 0, navStatus: 15, rot: -128, name },
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
            const cl = courseLinesRef.current.get(mmsi)
            if (cl) { cl.remove(); courseLinesRef.current.delete(mmsi) }
            dangerRef.current.delete(mmsi)
            return
          }

          const cogRaw = (rep.Cog ?? 360) as number
          const cog    = cogRaw < 360 ? cogRaw : 0
          const vessel: AISVessel = {
            mmsi,
            lat, lng,
            heading: (rep.TrueHeading !== 511 ? rep.TrueHeading : cog) as number,
            cog,
            sog,
            navStatus: (rep.NavigationalStatus ?? 15) as number,
            rot: (rep.RateOfTurn ?? -128) as number,
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
          // Course line: 2 min ahead at current SOG, min 150 m, max 1500 m
          const lineM = Math.max(150, Math.min(sog * KN_TO_MS * 120, 1500))
          const lineDir = vessel.cog > 0 ? vessel.cog : vessel.heading
          const lineEnd = destPointAIS(lat, lng, lineDir, lineM)
          const lineColor = danger ? '#ef4444' : vesselColor(sog)

          const existing = markersRef.current.get(mmsi)
          if (existing) {
            existing.setLatLng([lat, lng])
            existing.setIcon(vesselIcon(vessel, danger, zoom))
            existing.getPopup()?.setContent(popupContent(vessel, cpa, danger, stat))
            const cl = courseLinesRef.current.get(mmsi)
            if (cl) { cl.setLatLngs([[lat, lng], lineEnd]); cl.setStyle({ color: lineColor }) }
          } else {
            if (!layerRef.current) return
            const marker = L.marker([lat, lng], { icon: vesselIcon(vessel, danger, zoom), zIndexOffset: danger ? 600 : 200 })
            marker.bindPopup(popupContent(vessel, cpa, danger, stat), { maxWidth: 260 })
            marker.addTo(layerRef.current)
            markersRef.current.set(mmsi, marker)
            const cl = L.polyline([[lat, lng], lineEnd], { color: lineColor, weight: 2, opacity: 0.85, dashArray: '6 4' })
            cl.addTo(layerRef.current)
            courseLinesRef.current.set(mmsi, cl)
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
        if (watchdogRef.current) { clearInterval(watchdogRef.current); watchdogRef.current = null }
        if (cancelled || ev.code === 1000) return   // intentional shutdown
        // Surface the real close code/reason so we stop guessing. 1006 = server
        // dropped the socket with no frame (usually auth/limit); 1008 = policy.
        const detail = ev.reason ? `${ev.code}: ${ev.reason}` : `kode ${ev.code}`
        const delayMs = Math.min(4000 * (attempt + 1), 30000)
        scheduleReconnect(`Frakoblet (${detail}) – nytt forsøk om ${Math.round(delayMs / 1000)}s…`, undefined, detail)
      }
    }

    connect()

    return () => {
      cancelled = true
      if (reconnectRef.current) { clearTimeout(reconnectRef.current); reconnectRef.current = null }
      if (subTimerRef.current) clearTimeout(subTimerRef.current)
      if (watchdogRef.current) { clearInterval(watchdogRef.current); watchdogRef.current = null }
      wsRef.current?.close(1000)
      wsRef.current = null
      layerRef.current?.clearLayers()
      markersRef.current.clear()
      courseLinesRef.current.clear()
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
  const sog = v.sog > 0 ? `${v.sog.toFixed(1)} kn` : ''
  const hdg = v.heading > 0 && v.heading < 360 ? `${Math.round(v.heading)}° (stavn)` : ''
  const cogStr = v.cog > 0 && v.cog < 360 ? `${Math.round(v.cog)}° (kurs)` : ''
  // Show COG separately only if it differs meaningfully from heading (drift/current)
  const showCog = cogStr && hdg && Math.abs(v.cog - v.heading) > 5

  const navStat = navStatusLabel(v.navStatus)
  const turning = v.rot !== -128 && Math.abs(v.rot) > 15
    ? (v.rot > 0 ? '→ Dreier styrbord' : '← Dreier babord') : ''

  let cpaLine = ''
  if (cpa && cpa.tcpaMin > 0 && isFinite(cpa.tcpaMin)) {
    const nm  = (cpa.cpaM / 1852).toFixed(2)
    const min = Math.round(cpa.tcpaMin)
    cpaLine = danger
      ? `<div style="margin-top:4px;color:#ef4444;font-weight:700">⚠ Kollisjonskurs<br/>Passerer ${nm} nm om ${min} min</div>`
      : `<div style="margin-top:4px;color:#94a3b8;font-size:12px">Nærmeste: ${nm} nm om ${min} min</div>`
  }

  // Static/voyage lines
  let staticLines = ''
  if (stat) {
    const rows: string[] = []
    if (stat.type) rows.push(stat.type)
    if (stat.length) rows.push(`${Math.round(stat.length)}${stat.beam ? `×${Math.round(stat.beam)}` : ''} m`)
    if (stat.draught) rows.push(`dypg. ${stat.draught.toFixed(1)} m`)
    const line1 = rows.join(' · ')
    const dest = stat.destination ? `<div style="color:#94a3b8;font-size:12px">→ ${stat.destination}</div>` : ''
    const imo  = stat.imo ? `<div style="color:#64748b;font-size:11px">IMO ${stat.imo}</div>` : ''
    if (line1 || dest || imo) {
      staticLines = `<div style="margin-top:3px;color:#cbd5e1;font-size:12px">${line1}</div>${dest}${imo}`
    }
  }

  const speedLine  = [sog, hdg].filter(Boolean).join(' · ')
  const cogLine    = showCog ? `<div style="color:#94a3b8;font-size:12px">${cogStr}</div>` : ''
  const statusLine = navStat  ? `<div style="margin-top:2px;color:#fbbf24;font-size:12px">${navStat}</div>` : ''
  const turnLine   = turning  ? `<div style="color:#f97316;font-size:12px">${turning}</div>` : ''

  return `<div style="font-size:13px;line-height:1.5">
    <b>${v.name}</b><br/>
    ${speedLine}
    ${cogLine}
    ${statusLine}
    ${turnLine}
    ${staticLines}
    <div style="color:#64748b;font-size:11px;margin-top:2px">MMSI ${v.mmsi}${stat?.callSign ? ` · ${stat.callSign}` : ''}</div>
    ${cpaLine}
  </div>`
}
