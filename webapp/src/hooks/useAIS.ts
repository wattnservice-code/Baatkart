import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { useMapStore } from '../store/useMapStore'
import { getMapInstance } from '../mapInstance'
import { collisionAlarm } from '../audio'

// ── Data model ────────────────────────────────────────────────────────────────

interface AISVessel {
  mmsi: number
  lat: number
  lng: number
  heading: number    // true heading, 0-359 (511 = unavailable)
  cog: number        // course over ground
  sog: number        // speed over ground, knots
  navStatus: number  // AIS nav status code
  rot: number        // rate of turn (-128 = not available)
  name: string
  shipType: number
  length: number
  beam: number
  draught: number
  destination: string
  callSign: string
  imo: number
  msgtime: string
  eta: string
}

// Raw Barentswatch /v1/latest/combined response fields.
// Field names verified against Barentswatch AIS Live API (2024).
// If the API changes casing, adjust the mapping in bwToVessel() below.
interface BwRaw {
  mmsi: number
  name?: string
  latitude: number
  longitude: number
  speedOverGround?: number
  courseOverGround?: number
  trueHeading?: number      // 511 = not available
  navigationalStatus?: number
  rateOfTurn?: number
  shipType?: number
  length?: number
  width?: number            // beam
  draught?: number
  destination?: string
  callSign?: string
  imoNumber?: number
  msgtime?: string
  eta?: string
  // Some responses use lowercase field names — accept both
  sog?: number; cog?: number; heading?: number; navStatus?: number; rot?: number
  imo?: number; iMONumber?: number; imoNr?: number
}

function bwToVessel(r: BwRaw): AISVessel {
  const hdg = r.trueHeading ?? r.heading ?? 511
  return {
    mmsi:        r.mmsi,
    lat:         r.latitude,
    lng:         r.longitude,
    sog:         r.speedOverGround ?? r.sog ?? 0,
    cog:         r.courseOverGround ?? r.cog ?? 0,
    heading:     hdg >= 360 ? 511 : hdg,
    navStatus:   r.navigationalStatus ?? r.navStatus ?? 15,
    rot:         r.rateOfTurn ?? r.rot ?? -128,
    name:        r.name ?? '',
    shipType:    r.shipType ?? 0,
    length:      r.length ?? 0,
    beam:        r.width ?? 0,
    draught:     r.draught ?? 0,
    destination: r.destination ?? '',
    callSign:    r.callSign ?? '',
    imo:         r.imoNumber ?? r.iMONumber ?? r.imoNr ?? r.imo ?? 0,
    msgtime:     r.msgtime ?? '',
    eta:         r.eta ?? '',
  }
}

// ── Visuals ───────────────────────────────────────────────────────────────────

// Ship type → icon color (overridden to red when danger)
function vesselTypeColor(t: number): string {
  if (t >= 80 && t <= 89) return '#fb923c'  // tanker — oransje
  if (t >= 70 && t <= 79) return '#4ade80'  // last — grønn
  if (t >= 60 && t <= 69) return '#60a5fa'  // passasjer — blå
  if (t >= 40 && t <= 49) return '#f97316'  // hurtigbåt — dyp oransje
  if (t === 30)            return '#facc15'  // fiske — gul
  if (t === 36)            return '#c084fc'  // seil — lilla
  if (t === 37)            return '#34d399'  // fritid — teal
  if (t === 31 || t === 32 || (t >= 50 && t <= 55)) return '#a78bfa' // slep/tjeneste — lys lilla
  if (t === 35)            return '#ef4444'  // militær — rød
  return '#38bdf8'                           // ukjent/annet — cyan
}

// MID (first 3 digits of MMSI) → flag emoji
function mmsiFlag(mmsi: number): string {
  const mid = Math.floor(mmsi / 1_000_000)
  const f: Record<number, string> = {
    201:'🇦🇱',203:'🇦🇹',209:'🇨🇾',210:'🇨🇾',211:'🇩🇪',212:'🇨🇾',
    213:'🇬🇪',214:'🇲🇩',215:'🇲🇹',218:'🇩🇪',219:'🇩🇰',220:'🇩🇰',
    224:'🇪🇸',225:'🇪🇸',226:'🇫🇷',227:'🇫🇷',228:'🇫🇷',229:'🇲🇹',
    230:'🇫🇮',231:'🇫🇴',232:'🇬🇧',233:'🇬🇧',234:'🇬🇧',235:'🇬🇧',
    236:'🇬🇮',237:'🇬🇷',238:'🇭🇷',239:'🇬🇷',240:'🇬🇷',241:'🇬🇷',
    242:'🇲🇦',243:'🇭🇺',244:'🇳🇱',245:'🇳🇱',246:'🇳🇱',247:'🇮🇹',
    248:'🇲🇹',249:'🇲🇹',250:'🇮🇪',251:'🇮🇸',252:'🇱🇮',253:'🇱🇺',
    254:'🇲🇨',255:'🇵🇹',256:'🇲🇹',257:'🇳🇴',258:'🇳🇴',259:'🇳🇴',
    261:'🇵🇱',262:'🇲🇪',263:'🇵🇹',264:'🇷🇴',265:'🇸🇪',266:'🇸🇪',
    267:'🇸🇰',268:'🇸🇲',269:'🇨🇭',270:'🇪🇪',271:'🇱🇹',272:'🇺🇦',
    273:'🇷🇺',274:'🇱🇻',275:'🇱🇻',276:'🇱🇹',277:'🇧🇾',278:'🇧🇬',
    279:'🇷🇺',305:'🇦🇬',306:'🇦🇼',308:'🇧🇸',309:'🇧🇸',310:'🇧🇲',
    311:'🇦🇳',316:'🇨🇦',319:'🇰🇾',338:'🇺🇸',339:'🇵🇷',351:'🇵🇦',
    352:'🇵🇦',353:'🇵🇦',354:'🇵🇦',355:'🇵🇦',356:'🇵🇦',357:'🇵🇦',
    366:'🇺🇸',367:'🇺🇸',368:'🇺🇸',369:'🇺🇸',370:'🇵🇦',371:'🇵🇦',
    372:'🇵🇦',373:'🇵🇦',374:'🇵🇦',378:'🇻🇬',379:'🇵🇦',
    431:'🇯🇵',432:'🇯🇵',440:'🇰🇷',441:'🇰🇷',477:'🇭🇰',
    503:'🇦🇺',518:'🇨🇰',525:'🇮🇩',538:'🇲🇭',553:'🇵🇬',
    572:'🇵🇼',574:'🇻🇳',577:'🇵🇭',
    620:'🇸🇴',636:'🇱🇷',654:'🇹🇿',657:'🇸🇱',667:'🇸🇱',
  }
  return f[mid] ?? ''
}

// Human-readable age of AIS position fix
function dataAge(msgtime: string): string {
  if (!msgtime) return ''
  const secs = (Date.now() - new Date(msgtime).getTime()) / 1000
  if (secs < 0 || isNaN(secs)) return ''
  if (secs < 90)   return `${Math.round(secs)}s`
  if (secs < 3600) return `${Math.round(secs / 60)} min`
  return `${Math.round(secs / 3600)}t`
}

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
  const R = 6371000, δ = meters / R, θ = headingDeg * Math.PI / 180
  const φ1 = lat * Math.PI / 180, λ1 = lng * Math.PI / 180
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ))
  const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2))
  return [φ2 * 180 / Math.PI, λ2 * 180 / Math.PI]
}

function vesselIcon(vessel: AISVessel, danger: boolean, zoom: number): L.DivIcon {
  const sz = vesselSize(zoom)
  const hdg = vessel.heading > 0 && vessel.heading < 360 ? vessel.heading : vessel.cog
  const color = danger ? '#ef4444' : vesselTypeColor(vessel.shipType)
  const wrapCls = danger ? 'ais-danger-wrap' : ''
  const html = `<div class="${wrapCls}" style="width:${sz}px;height:${sz}px;">
    <div style="width:${sz}px;height:${sz}px;transform:rotate(${hdg}deg);
      filter:drop-shadow(0 0 3px rgba(255,255,255,0.7)) drop-shadow(0 0 6px rgba(0,0,0,1));">
      <svg width="${sz}" height="${sz}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <polygon points="12,2 21,22 12,17 3,22" fill="${color}" stroke="#0f172a" stroke-width="2" stroke-linejoin="round"/>
      </svg>
    </div>
  </div>`
  return L.divIcon({ className: '', html, iconSize: [sz, sz], iconAnchor: [sz / 2, sz / 2] })
}

// ── Collision (CPA/TCPA) ──────────────────────────────────────────────────────

const DANGER_CPA_M    = 926   // 0.5 nm
const DANGER_TCPA_MIN = 15
const KN_TO_MS        = 0.514444

interface OwnState { lat: number; lng: number; speedMs: number; courseDeg: number }
interface CpaInfo  { cpaM: number; tcpaMin: number }

function computeCPA(own: OwnState, t: AISVessel): CpaInfo | null {
  const R = 6371000, latRad = (own.lat * Math.PI) / 180
  const px = ((t.lng - own.lng) * Math.PI / 180) * R * Math.cos(latRad)
  const py = ((t.lat - own.lat) * Math.PI / 180) * R
  const ovx = own.speedMs * Math.sin((own.courseDeg * Math.PI) / 180)
  const ovy = own.speedMs * Math.cos((own.courseDeg * Math.PI) / 180)
  const tSpeed = t.sog * KN_TO_MS
  const tCourse = t.heading > 0 && t.heading < 360 ? t.heading : t.cog
  const tvx = tSpeed * Math.sin((tCourse * Math.PI) / 180)
  const tvy = tSpeed * Math.cos((tCourse * Math.PI) / 180)
  const rvx = tvx - ovx, rvy = tvy - ovy
  const rv2 = rvx * rvx + rvy * rvy
  if (rv2 < 1e-4) return { cpaM: Math.hypot(px, py), tcpaMin: 0 }
  const tcpaSec = -(px * rvx + py * rvy) / rv2
  const cx = px + rvx * tcpaSec, cy = py + rvy * tcpaSec
  return { cpaM: Math.hypot(cx, cy), tcpaMin: tcpaSec / 60 }
}

function isDanger(cpa: CpaInfo | null): boolean {
  return !!cpa && cpa.tcpaMin > 0 && cpa.tcpaMin < DANGER_TCPA_MIN && cpa.cpaM < DANGER_CPA_M
}

// ── Popup ─────────────────────────────────────────────────────────────────────

function popupContent(v: AISVessel, cpa: CpaInfo | null, danger: boolean): string {
  const flag    = mmsiFlag(v.mmsi)
  const age     = dataAge(v.msgtime)
  const typeClr = danger ? '#ef4444' : vesselTypeColor(v.shipType)
  const typeLabel = shipTypeLabel(v.shipType)

  const sog    = v.sog > 0 ? `${v.sog.toFixed(1)} kn` : ''
  const hdg    = v.heading > 0 && v.heading < 360 ? `${Math.round(v.heading)}° stavn` : ''
  const cogStr = v.cog > 0 && v.cog < 360 ? `${Math.round(v.cog)}° kurs` : ''
  const showCog = cogStr && hdg && Math.abs(v.cog - v.heading) > 5
  const navStat = navStatusLabel(v.navStatus)
  const turning = v.rot !== -128 && Math.abs(v.rot) > 15
    ? (v.rot > 0 ? '→ Dreier styrbord' : '← Dreier babord') : ''

  let cpaLine = ''
  if (cpa && cpa.tcpaMin > 0 && isFinite(cpa.tcpaMin)) {
    const nm = (cpa.cpaM / 1852).toFixed(2), min = Math.round(cpa.tcpaMin)
    cpaLine = danger
      ? `<div style="margin-top:6px;padding:4px 6px;background:rgba(239,68,68,0.15);border-radius:4px;color:#ef4444;font-weight:700;font-size:12px">⚠ Kollisjonskurs · Passerer ${nm} nm om ${min} min</div>`
      : `<div style="margin-top:4px;color:#94a3b8;font-size:11px">CPA ${nm} nm om ${min} min</div>`
  }

  const dimParts: string[] = []
  if (v.length) dimParts.push(`${Math.round(v.length)}${v.beam ? `×${Math.round(v.beam)}` : ''} m`)
  if (v.draught) dimParts.push(`dypg. ${v.draught.toFixed(1)} m`)
  const dimLine  = dimParts.length ? `<div style="color:#94a3b8;font-size:11px">${dimParts.join(' · ')}</div>` : ''
  const destLine = v.destination ? `<div style="color:#94a3b8;font-size:11px">→ ${v.destination}${v.eta ? ` (ETA ${v.eta})` : ''}</div>` : ''
  const imoLine  = v.imo ? `<div style="color:#475569;font-size:10px">IMO ${v.imo}</div>` : ''
  const ageLine  = age ? `<span style="color:#475569;font-size:10px">· ${age} siden</span>` : ''

  return `<div style="min-width:170px;font-family:system-ui,sans-serif">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
      ${flag ? `<span style="font-size:16px">${flag}</span>` : ''}
      <span style="font-weight:700;font-size:14px;flex:1">${v.name || `MMSI ${v.mmsi}`}</span>
    </div>
    ${typeLabel ? `<div style="display:inline-block;padding:1px 6px;border-radius:10px;background:${typeClr}22;color:${typeClr};font-size:11px;font-weight:600;margin-bottom:4px">${typeLabel}</div>` : ''}
    <div style="color:#94a3b8;font-size:12px">${[sog, hdg, showCog ? cogStr : ''].filter(Boolean).join(' · ')}</div>
    ${navStat ? `<div style="color:#fbbf24;font-size:11px">${navStat}</div>` : ''}
    ${turning  ? `<div style="color:#94a3b8;font-size:11px">${turning}</div>` : ''}
    ${dimLine}${destLine}
    <div style="color:#475569;font-size:10px;margin-top:3px">MMSI ${v.mmsi}${v.callSign ? ` · ${v.callSign}` : ''} ${ageLine}</div>
    ${imoLine}
    ${cpaLine}
  </div>`
}

// ── Hook ──────────────────────────────────────────────────────────────────────

const POLL_MS = 15_000   // refresh every 15 s

interface Bounds { north: number; south: number; east: number; west: number }

const MAX_BOX_HALF_DEG = 4

function clampBox(b: Bounds | null): Bounds {
  if (!b || ![b.north, b.south, b.east, b.west].every(Number.isFinite)) {
    return { south: 59, north: 60, west: 9, east: 11 }
  }
  let s = Math.min(b.south, b.north), n = Math.max(b.south, b.north)
  let w = Math.min(b.west, b.east),   e = Math.max(b.west, b.east)
  const latC = (s + n) / 2, lngC = (w + e) / 2
  if (n - s > MAX_BOX_HALF_DEG * 2) { s = latC - MAX_BOX_HALF_DEG; n = latC + MAX_BOX_HALF_DEG }
  if (e - w > MAX_BOX_HALF_DEG * 2) { w = lngC - MAX_BOX_HALF_DEG; e = lngC + MAX_BOX_HALF_DEG }
  return {
    south: Math.max(-90, s), north: Math.min(90, n),
    west: Math.max(-180, w), east: Math.min(180, e),
  }
}

export function useAIS() {
  const aisVisible = useMapStore((s) => s.aisVisible)
  const mapBounds  = useMapStore((s) => s.mapBounds)

  const markersRef     = useRef<Map<number, L.Marker>>(new Map())
  const courseLinesRef = useRef<Map<number, L.Polyline>>(new Map())
  const layerRef       = useRef<L.LayerGroup | null>(null)
  const boundsRef      = useRef<Bounds | null>(mapBounds)
  const dangerRef      = useRef<Set<number>>(new Set())
  const lastAlarmRef   = useRef(0)

  useEffect(() => { boundsRef.current = mapBounds }, [mapBounds])

  useEffect(() => {
    const map = getMapInstance()
    if (!map || !layerRef.current) return
    if (!map.hasLayer(layerRef.current)) layerRef.current.addTo(map)
  })

  useEffect(() => {
    if (!aisVisible) {
      layerRef.current?.clearLayers()
      markersRef.current.clear()
      courseLinesRef.current.clear()
      dangerRef.current.clear()
      useMapStore.getState().setAisStatus({ state: 'idle', count: 0, message: '' })
      return
    }

    const setAisStatus = useMapStore.getState().setAisStatus
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const map = getMapInstance()
    if (!layerRef.current) layerRef.current = L.layerGroup().addTo(map!)

    const poll = async () => {
      if (cancelled) return

      const box = clampBox(boundsRef.current)
      const url = `/api/ais?xmin=${box.west.toFixed(4)}&ymin=${box.south.toFixed(4)}&xmax=${box.east.toFixed(4)}&ymax=${box.north.toFixed(4)}`

      try {
        const r = await fetch(url)
        if (cancelled) return

        if (!r.ok) {
          const { error } = await r.json().catch(() => ({ error: `HTTP ${r.status}` }))
          setAisStatus({ state: 'error', count: markersRef.current.size, message: error ?? `HTTP ${r.status}` })
          if (!cancelled) timer = setTimeout(poll, POLL_MS)
          return
        }

        const raw: BwRaw[] = await r.json()
        if (cancelled) return

        const zoom = getMapInstance()?.getZoom() ?? 13
        const pos  = useMapStore.getState().position
        const own: OwnState | null = pos
          ? { lat: pos.lat, lng: pos.lng, speedMs: pos.speed ?? 0, courseDeg: pos.heading ?? 0 }
          : null

        // Convert; skip stationary; filter to bbox client-side as safety net
        const vessels = raw
          .map(bwToVessel)
          .filter(v => v.sog >= 0.5)
          .filter(v =>
            v.lat >= box.south && v.lat <= box.north &&
            v.lng >= box.west  && v.lng <= box.east
          )

        const activeMMSIs = new Set(vessels.map(v => v.mmsi))

        // Remove vessels that disappeared from the response
        for (const [mmsi, marker] of markersRef.current) {
          if (!activeMMSIs.has(mmsi)) {
            marker.remove()
            markersRef.current.delete(mmsi)
            courseLinesRef.current.get(mmsi)?.remove()
            courseLinesRef.current.delete(mmsi)
            dangerRef.current.delete(mmsi)
          }
        }

        // Update or add each vessel
        for (const vessel of vessels) {
          const { mmsi, lat, lng, sog, cog, heading } = vessel
          const cpa    = own ? computeCPA(own, vessel) : null
          const danger = isDanger(cpa)
          const wasDanger = dangerRef.current.has(mmsi)
          if (danger) dangerRef.current.add(mmsi)
          else        dangerRef.current.delete(mmsi)

          if (danger && !wasDanger) {
            const now = Date.now()
            if (now - lastAlarmRef.current > 8000) { lastAlarmRef.current = now; collisionAlarm() }
          }

          const lineDir = cog > 0 ? cog : heading
          const lineM   = Math.max(150, Math.min(sog * KN_TO_MS * 120, 1500))
          const lineEnd = destPointAIS(lat, lng, lineDir, lineM)
          const lineColor = danger ? '#ef4444' : vesselTypeColor(vessel.shipType)

          const existing = markersRef.current.get(mmsi)
          if (existing) {
            existing.setLatLng([lat, lng])
            existing.setIcon(vesselIcon(vessel, danger, zoom))
            existing.getPopup()?.setContent(popupContent(vessel, cpa, danger))
            const cl = courseLinesRef.current.get(mmsi)
            if (cl) { cl.setLatLngs([[lat, lng], lineEnd]); cl.setStyle({ color: lineColor }) }
          } else {
            if (!layerRef.current) continue
            const marker = L.marker([lat, lng], {
              icon: vesselIcon(vessel, danger, zoom),
              zIndexOffset: danger ? 600 : 200,
            })
            marker.bindPopup(popupContent(vessel, cpa, danger), { maxWidth: 260 })
            marker.addTo(layerRef.current)
            markersRef.current.set(mmsi, marker)
            const cl = L.polyline([[lat, lng], lineEnd], {
              color: lineColor, weight: 2, opacity: 0.85, dashArray: '6 4',
            })
            cl.addTo(layerRef.current)
            courseLinesRef.current.set(mmsi, cl)
          }
        }

        const dn = dangerRef.current.size
        setAisStatus({
          state:   dn > 0 ? 'warn' : 'live',
          count:   markersRef.current.size,
          message: dn > 0 ? `${dn} på kollisjonskurs` : '',
        })

      } catch (e) {
        if (!cancelled) setAisStatus({ state: 'error', count: markersRef.current.size, message: String(e) })
      }

      if (!cancelled) timer = setTimeout(poll, POLL_MS)
    }

    setAisStatus({ state: 'connecting', count: 0, message: 'Kobler til…' })
    poll()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      layerRef.current?.clearLayers()
      markersRef.current.clear()
      courseLinesRef.current.clear()
      dangerRef.current.clear()
    }
  }, [aisVisible])
}
