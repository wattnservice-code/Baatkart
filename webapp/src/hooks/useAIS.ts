import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { useMapStore } from '../store/useMapStore'
import type { DistUnit, SpeedUnit } from '../store/useMapStore'
import { getMapInstance } from '../mapInstance'
import { collisionAlarm } from '../audio'
import { formatDist } from '../components/NavOverlay'
import { destPoint, cardinal } from '../geo'
import { computeCPA, isDanger, KN_TO_MS, type OwnState, type CpaInfo } from '../collision'

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

// UN/LOCODE → norsk stedsnavn. Dekker norske havner + vanlige europeiske.
const LOCODE: Record<string, string> = {
  // Norge
  'NOOSL':'Oslo','NOSVG':'Stavanger','NOBGO':'Bergen','NOTRH':'Trondheim',
  'NOTOS':'Tromsø','NOAES':'Ålesund','NOKRS':'Kristiansand','NODRA':'Drammen',
  'NOTON':'Tønsberg','NOHAU':'Haugesund','NOHAR':'Harstad','NOMOS':'Moss',
  'NOLAR':'Larvik','NONVK':'Narvik','NOBOO':'Bodø','NOFRO':'Florø',
  'NOMOL':'Molde','NOSKE':'Skien','NOSAN':'Sandefjord','NOPOR':'Porsgrunn',
  'NOFRK':'Fredrikstad','NOFUS':'Fusa','NOHRS':'Hørsand','NOLES':'Leknes',
  'NOSVV':'Svolvær','NOAND':'Andenes','NOBNN':'Brønnøysund','NOMSS':'Mosjøen',
  'NOSTO':'Stord','NOKOP':'Kopervika','NOLTA':'Leirvik','NOASN':'Åsgårdstrand',
  // Danmark
  'DKAAR':'Aarhus','DKCPH':'København','DKFRC':'Fredericia','DKAAL':'Aalborg',
  'DKODE':'Odense','DKESB':'Esbjerg','DKKAL':'Kalundborg','DKRAN':'Randers',
  // Sverige
  'SEGOT':'Gøteborg','SESTO':'Stockholm','SEAHU':'Ahus','SEHAL':'Halmstad',
  'SEKAR':'Karlskrona','SEHEL':'Helsingborg','SEMAL':'Malmø','SENYH':'Nynäshamn',
  'SEOXE':'Oxelösund','SEUDD':'Uddevalla','SEVAR':'Varberg',
  // Finland
  'FIHEL':'Helsinki','FIRAU':'Rauma','FITUR':'Turku','FIPOR':'Pori',
  'FIKTK':'Kotka','FIOUL':'Oulu','FIHAM':'Hamina','FIMAN':'Mäntyluoto',
  // Tyskland
  'DEHAM':'Hamburg','DEBRE':'Bremen','DEBHV':'Bremerhaven','DEROS':'Rostock',
  'DEKIL':'Kiel','DELBC':'Lübeck','DEWIS':'Wismar','DESTD':'Stralsund',
  // Nederland
  'NLRTM':'Rotterdam','NLAMS':'Amsterdam','NLMOE':'Moerdijk','NLTER':'Terneuzen',
  'NLVLI':'Vlissingen','NLGRQ':'Groningen',
  // Belgia
  'BEANR':'Antwerpen','BEBRU':'Brussel','BEGNE':'Gent','BEZEE':'Zeebrugge',
  // Storbritannia
  'GBFXT':'Felixstowe','GBSOU':'Southampton','GBLIV':'Liverpool',
  'GBIMM':'Immingham','GBHUL':'Hull','GBLTH':'Leith','GBABD':'Aberdeen',
  'GBINV':'Inverness','GBGLW':'Glasgow',
  // Frankrike
  'FRMAR':'Marseille','FRLEH':'Le Havre','FRDKK':'Dunkerque','FRNCE':'Nice',
  // Spania
  'ESBCN':'Barcelona','ESVLC':'Valencia','ESALG':'Algeciras','ESBIO':'Bilbao',
  // Polen
  'PLGDY':'Gdynia','PLGDN':'Gdansk','PLSZZ':'Szczecin',
  // Baltikum
  'EETLL':'Tallinn','LVRIX':'Riga','LTKLA':'Klaipeda',
  // Russland
  'RULED':'St. Petersburg','RUMUR':'Murmansk',
  // Andre
  'USNYC':'New York','USLAX':'Los Angeles','CNTAO':'Qingdao','CNSHA':'Shanghai',
  'SGSIN':'Singapore','JPOSA':'Osaka','JPTYO':'Tokyo','KRPUS':'Busan',
  'AESJA':'Sharjah','AEAUH':'Abu Dhabi','AEDXB':'Dubai',
}

function decodeDest(raw: string): string {
  if (!raw || raw.trim() === '') return ''
  const key = raw.trim().toUpperCase().replace(/\s+/g, '')
  return LOCODE[key] ?? raw.trim()
}

// ETA fra Barentswatch — enten ISO-streng eller AIS-format MMDDHHmm
function formatETA(eta: string): string {
  if (!eta || eta === '00000000') return ''
  // ISO-format
  if (eta.includes('T') || eta.includes('-')) {
    const d = new Date(eta)
    if (isNaN(d.getTime())) return ''
    return d.toLocaleDateString('no-NO', { weekday: 'short', day: 'numeric', month: 'short' })
      + ' kl ' + d.toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' })
  }
  // AIS rå: MMDDHHmm
  if (/^\d{8}$/.test(eta)) {
    const month = parseInt(eta.slice(0, 2)) - 1
    const day   = parseInt(eta.slice(2, 4))
    const hour  = parseInt(eta.slice(4, 6))
    const min   = parseInt(eta.slice(6, 8))
    if (month < 0 || day === 0) return ''
    const year = new Date().getFullYear()
    const d = new Date(year, month, day, hour, min)
    if (d < new Date()) d.setFullYear(year + 1)
    return d.toLocaleDateString('no-NO', { weekday: 'short', day: 'numeric', month: 'short' })
      + ' kl ' + d.toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' })
  }
  return eta
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

function vesselIcon(vessel: AISVessel, danger: boolean, zoom: number): L.DivIcon {
  const sz = vesselSize(zoom)
  // COG (spor over grunn) først — samme prioritet som kurslinjen, så ikon og
  // strek alltid peker samme vei. heading (baug) brukes kun som fallback.
  const hdg = (vessel.cog >= 0 && vessel.cog < 360) ? vessel.cog
            : (vessel.heading > 0 && vessel.heading < 360) ? vessel.heading : 0
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
// Selve matten ligger i ../collision (ren + testbar). KN_TO_MS gjenbrukes under.

// ── Popup ─────────────────────────────────────────────────────────────────────

function popupContent(v: AISVessel, cpa: CpaInfo | null, danger: boolean, distUnit: DistUnit = 'nm', speedUnit: SpeedUnit = 'kn'): string {
  const flag    = mmsiFlag(v.mmsi)
  const age     = dataAge(v.msgtime)
  const typeClr = danger ? '#ef4444' : vesselTypeColor(v.shipType)
  const typeLabel = shipTypeLabel(v.shipType)

  const dest    = decodeDest(v.destination)
  const eta     = formatETA(v.eta)
  const navStat = navStatusLabel(v.navStatus)
  const turning = v.rot !== -128 && Math.abs(v.rot) > 15
    ? (v.rot > 0 ? '→ Dreier styrbord' : '← Dreier babord') : ''

  // Fart + retning i folkelig format
  const sogDisplay = speedUnit === 'kmh' ? `${(v.sog * 1.852).toFixed(1)} km/t` : `${v.sog.toFixed(1)} knop`
  const sogStr = v.sog > 0.5 ? sogDisplay : 'Stopper'
  const dirStr = v.cog > 0 && v.cog < 360
    ? cardinal(v.cog)
    : (v.heading > 0 && v.heading < 360 ? cardinal(v.heading) : '')
  const speedLine = [sogStr, dirStr].filter(Boolean).join(' mot ')

  let cpaLine = ''
  if (cpa && cpa.tcpaMin > 0 && isFinite(cpa.tcpaMin)) {
    const cpaStr   = formatDist(cpa.cpaM, distUnit)
    const rangeStr = formatDist(cpa.rangeM, distUnit)
    const min      = Math.round(cpa.tcpaMin)
    // Kun det som teller: avstand nå + tid til kollisjon. Gul/hvit på solid rød
    // så det leses skikkelig (rød-på-rød ble for mørkt).
    cpaLine = danger
      ? `<div style="margin-top:6px;padding:8px 10px;background:#dc2626;border-radius:6px;font-size:14px;line-height:1.6">
           <span style="color:#fde047;font-weight:800;letter-spacing:0.02em">⚠ KOLLISJONSKURS</span><br/>
           <span style="color:#ffffff;font-weight:600">
             Avstand: <b>${rangeStr}</b><br/>
             Kollisjon om: <b>${min} min</b>
           </span>
         </div>`
      : `<div style="margin-top:4px;color:#cbd5e1;font-size:13px">Nærmeste: <b style="color:#f1f5f9">${cpaStr}</b> om <b style="color:#f1f5f9">${min} min</b></div>`
  }

  const dimParts: string[] = []
  if (v.length) dimParts.push(`${Math.round(v.length)}${v.beam ? `×${Math.round(v.beam)}` : ''} m`)
  if (v.draught) dimParts.push(`dypgang ${v.draught.toFixed(1)} m`)
  const dimLine  = dimParts.length ? `<div style="color:#cbd5e1;font-size:13px;margin-top:3px">${dimParts.join(' · ')}</div>` : ''
  const destLine = dest
    ? `<div style="color:#cbd5e1;font-size:13px;margin-top:4px">📍 Til: <b style="color:#ffffff">${dest}</b>${eta ? `<br><span style="font-size:12px;color:#cbd5e1">Ankomst: ${eta}</span>` : ''}</div>`
    : ''
  const ageLine  = age ? `<span style="color:#94a3b8"> · ${age} siden</span>` : ''
  const moreLink = `<a href="https://www.vesselfinder.com/vessels/details/${v.mmsi}" target="_blank" rel="noopener"
    style="display:inline-block;margin-top:8px;font-size:13px;font-weight:600;color:#38bdf8;text-decoration:none">
    🔍 Mer info og bilde →</a>`

  return `<div style="min-width:200px;font-family:system-ui,sans-serif;line-height:1.55">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px">
      ${flag ? `<span style="font-size:20px">${flag}</span>` : ''}
      <span style="font-weight:800;font-size:17px;color:#ffffff;flex:1">${v.name || `MMSI ${v.mmsi}`}</span>
    </div>
    ${typeLabel ? `<div style="display:inline-block;padding:3px 10px;border-radius:10px;background:${typeClr};color:#0f172a;font-size:12px;font-weight:800;margin-bottom:6px">${typeLabel}</div>` : ''}
    <div style="font-size:16px;color:#ffffff;font-weight:700">${speedLine}</div>
    ${navStat ? `<div style="color:#fbbf24;font-size:13px;font-weight:600">${navStat}</div>` : ''}
    ${turning  ? `<div style="color:#e2e8f0;font-size:13px">${turning}</div>` : ''}
    ${destLine}${dimLine}
    <div style="color:#cbd5e1;font-size:13px;margin-top:5px">MMSI <b style="color:#f1f5f9">${v.mmsi}</b>${v.callSign ? ` · <b style="color:#f1f5f9">${v.callSign}</b>` : ''}${ageLine}</div>
    ${moreLink}
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
  const aisVisible        = useMapStore((s) => s.aisVisible)
  const aisShowStationary = useMapStore((s) => s.aisShowStationary)
  const mapBounds         = useMapStore((s) => s.mapBounds)

  const markersRef     = useRef<Map<number, L.Marker>>(new Map())
  const courseLinesRef = useRef<Map<number, L.Polyline>>(new Map())
  const layerRef       = useRef<L.LayerGroup | null>(null)
  const boundsRef      = useRef<Bounds | null>(mapBounds)
  const dangerRef      = useRef<Set<number>>(new Set())
  const lastAlarmRef   = useRef(0)
  const vesselsRef     = useRef<Map<number, AISVessel>>(new Map())
  const pollRef        = useRef<(() => void) | null>(null)
  const aisTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const moveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { boundsRef.current = mapBounds }, [mapBounds])

  // Hent AIS umiddelbart (debounced) når kartutsnittet endres — så fartøy dukker
  // opp med en gang du panorerer, ikke først ved neste 15-sek-poll.
  useEffect(() => {
    if (!aisVisible) return
    if (moveDebounceRef.current) clearTimeout(moveDebounceRef.current)
    moveDebounceRef.current = setTimeout(() => {
      if (aisTimerRef.current) clearTimeout(aisTimerRef.current)  // avbryt ventende poll
      pollRef.current?.()                                          // hent nå (poll planlegger neste 15 s)
    }, 400)
    return () => { if (moveDebounceRef.current) clearTimeout(moveDebounceRef.current) }
  }, [mapBounds, aisVisible])

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
          if (!cancelled) aisTimerRef.current = setTimeout(poll, POLL_MS)
          return
        }

        const raw: BwRaw[] = await r.json()
        if (cancelled) return

        const zoom      = getMapInstance()?.getZoom() ?? 13
        const pos       = useMapStore.getState().position
        const distUnit  = useMapStore.getState().distUnit
        const speedUnit = useMapStore.getState().speedUnit
        const own: OwnState | null = pos
          ? { lat: pos.lat, lng: pos.lng, speedMs: pos.speed ?? 0, courseDeg: pos.heading ?? 0 }
          : null

        const showStationary = useMapStore.getState().aisShowStationary
        // Convert; optionally skip stationary; filter to bbox client-side as safety net
        const vessels = raw
          .map(bwToVessel)
          .filter(v => showStationary || v.sog >= 0.5)
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
            vesselsRef.current.delete(mmsi)
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

          // COG er faktisk spor over grunn — riktig kilde for kurslinjen.
          // Ekskluder 511 (AIS "unavailable") fra heading-fallback.
          const lineDir = (cog >= 0 && cog < 360) ? cog
                        : (heading > 0 && heading < 360) ? heading : 0
          // Minimum synlig lengde skalerer med zoom; maks 1500 m for å unngå rot
          const minLineM = Math.max(80, Math.pow(2, 22 - zoom) / 8)
          const lineM    = Math.max(minLineM, Math.min(sog * KN_TO_MS * 120, 1500))
          const lineEnd = destPoint(lat, lng, lineDir, lineM)
          const lineColor = danger ? '#ef4444' : vesselTypeColor(vessel.shipType)

          vesselsRef.current.set(mmsi, vessel)

          const existing = markersRef.current.get(mmsi)
          if (existing) {
            existing.setLatLng([lat, lng])
            existing.setIcon(vesselIcon(vessel, danger, zoom))
            existing.getPopup()?.setContent(popupContent(vessel, cpa, danger, distUnit, speedUnit))
            const cl = courseLinesRef.current.get(mmsi)
            if (cl) { cl.setLatLngs([[lat, lng], lineEnd]); cl.setStyle({ color: lineColor }) }
          } else {
            if (!layerRef.current) continue
            const marker = L.marker([lat, lng], {
              icon: vesselIcon(vessel, danger, zoom),
              zIndexOffset: danger ? 600 : 200,
            })
            marker.bindPopup(popupContent(vessel, cpa, danger, distUnit, speedUnit), { maxWidth: 260, className: 'dark-popup', autoPan: false })
            // Refresh popup with live CPA data every time user opens it
            marker.on('popupopen', () => {
              const v = vesselsRef.current.get(mmsi)
              if (!v) return
              const p = useMapStore.getState().position
              const o = p ? { lat: p.lat, lng: p.lng, speedMs: p.speed ?? 0, courseDeg: p.heading ?? 0 } : null
              const freshCpa    = o ? computeCPA(o, v) : null
              const freshDanger = isDanger(freshCpa)
              const dUnit = useMapStore.getState().distUnit
              const sUnit = useMapStore.getState().speedUnit
              marker.getPopup()?.setContent(popupContent(v, freshCpa, freshDanger, dUnit, sUnit))
            })
            marker.addTo(layerRef.current)
            markersRef.current.set(mmsi, marker)
            const lineWeight = zoom >= 14 ? 2 : zoom >= 12 ? 2.5 : 3
            const cl = L.polyline([[lat, lng], lineEnd], {
              color: lineColor, weight: lineWeight, opacity: 0.85, dashArray: '6 4',
            })
            cl.addTo(layerRef.current)
            courseLinesRef.current.set(mmsi, cl)
          }
        }

        const dn = dangerRef.current.size
        // Find most imminent dangerous vessel (smallest positive TCPA)
        let dangerPos: { lat: number; lng: number } | undefined
        if (dn > 0 && own) {
          let best: { lat: number; lng: number; tcpa: number } | null = null
          for (const [mid, v] of vesselsRef.current) {
            if (!dangerRef.current.has(mid)) continue
            const c = computeCPA(own, v)
            if (c && c.tcpaMin > 0 && (!best || c.tcpaMin < best.tcpa)) {
              best = { lat: v.lat, lng: v.lng, tcpa: c.tcpaMin }
            }
          }
          if (best) dangerPos = { lat: best.lat, lng: best.lng }
        }
        setAisStatus({
          state:    dn > 0 ? 'warn' : 'live',
          count:    markersRef.current.size,
          message:  dn > 0 ? `${dn} på kollisjonskurs` : '',
          dangerPos,
        })

      } catch (e) {
        if (!cancelled) setAisStatus({ state: 'error', count: markersRef.current.size, message: String(e) })
      }

      if (!cancelled) aisTimerRef.current = setTimeout(poll, POLL_MS)
    }

    pollRef.current = poll
    setAisStatus({ state: 'connecting', count: 0, message: 'Kobler til…' })
    poll()

    return () => {
      cancelled = true
      if (aisTimerRef.current) clearTimeout(aisTimerRef.current)
      layerRef.current?.clearLayers()
      markersRef.current.clear()
      courseLinesRef.current.clear()
      dangerRef.current.clear()
      vesselsRef.current.clear()
    }
  }, [aisVisible, aisShowStationary])

  // Re-run CPA every 3 s using latest own position — clears alarm without waiting for next API poll
  useEffect(() => {
    if (!aisVisible) return
    const id = setInterval(() => {
      const pos = useMapStore.getState().position
      if (!pos || vesselsRef.current.size === 0) return
      const own: OwnState = { lat: pos.lat, lng: pos.lng, speedMs: pos.speed ?? 0, courseDeg: pos.heading ?? 0 }
      const distUnit  = useMapStore.getState().distUnit
      const speedUnit = useMapStore.getState().speedUnit
      const zoom = getMapInstance()?.getZoom() ?? 13
      let dn = 0
      for (const [mmsi, vessel] of vesselsRef.current) {
        const cpa    = computeCPA(own, vessel)
        const danger = isDanger(cpa)
        const wasDanger = dangerRef.current.has(mmsi)
        if (danger) { dangerRef.current.add(mmsi); dn++ }
        else        dangerRef.current.delete(mmsi)
        if (danger && !wasDanger) {
          const now = Date.now()
          if (now - lastAlarmRef.current > 8000) { lastAlarmRef.current = now; collisionAlarm() }
        }
        // Update marker icon + popup to reflect changed danger state
        const marker = markersRef.current.get(mmsi)
        if (marker && danger !== wasDanger) {
          marker.setIcon(vesselIcon(vessel, danger, zoom))
          marker.getPopup()?.setContent(popupContent(vessel, cpa, danger, distUnit, speedUnit))
          const cl = courseLinesRef.current.get(mmsi)
          if (cl) cl.setStyle({ color: danger ? '#ef4444' : vesselTypeColor(vessel.shipType) })
        }
      }
      let dangerPos2: { lat: number; lng: number } | undefined
      if (dn > 0) {
        let best: { lat: number; lng: number; tcpa: number } | null = null
        for (const [mid, v] of vesselsRef.current) {
          if (!dangerRef.current.has(mid)) continue
          const c = computeCPA(own, v)
          if (c && c.tcpaMin > 0 && (!best || c.tcpaMin < best.tcpa)) {
            best = { lat: v.lat, lng: v.lng, tcpa: c.tcpaMin }
          }
        }
        if (best) dangerPos2 = { lat: best.lat, lng: best.lng }
      }
      useMapStore.getState().setAisStatus({
        state:    dn > 0 ? 'warn' : 'live',
        count:    markersRef.current.size,
        message:  dn > 0 ? `${dn} på kollisjonskurs` : '',
        dangerPos: dangerPos2,
      })
    }, 3000)
    return () => clearInterval(id)
  }, [aisVisible])
}
