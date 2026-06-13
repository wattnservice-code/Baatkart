import { create } from 'zustand'

interface Position {
  lat: number
  lng: number
  speed: number
  heading: number
  accuracy: number
  timestamp: number
}

interface TrackPoint {
  lat: number
  lng: number
  timestamp: number
}

export interface SavedSpot {
  id: string
  lat: number
  lng: number
  name: string
  icon?: string   // category key from spotIcons (pin/fish/swim/…)
}

export interface MobPoint {
  lat: number
  lng: number
  timestamp: number
}

export type SpeedUnit = 'kn' | 'kmh'
export type DistUnit = 'm' | 'km' | 'nm'

export interface BoatInfo {
  name: string
  mmsi: string
  phone: string
  boatType: string
  notes: string
}

export interface SavedTrack {
  id: string
  name: string
  date: string
  points: { lat: number; lng: number }[]
  distanceM: number
  icon?: string   // category key from spotIcons
}

function _haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const φ1 = (lat1 * Math.PI) / 180, φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180, Δλ = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const RING_CYCLE = [null, 200, 500, 1000, 2000, 5000] as const
export type RingSize = typeof RING_CYCLE[number]

interface MapStore {
  position: Position | null
  isTracking: boolean
  track: TrackPoint[]
  savedSpots: SavedSpot[]
  mobPoint: MobPoint | null
  mobTrack: TrackPoint[]
  followBoat: boolean
  addingSpot: boolean
  activePanel: 'spots' | 'turer' | 'meg' | null
  compassEnabled: boolean
  darkMode: boolean
  nightVision: boolean
  seamarkVisible: boolean
  weatherVisible: boolean
  tideVisible: boolean
  speedUnit: SpeedUnit
  distUnit: DistUnit
  customRingRadius: RingSize
  flyTo: { lat: number; lng: number } | null
  searchPin: { lat: number; lng: number; name: string } | null
  spotMenu: { lat: number; lng: number; name: string; id?: string } | null
  navPreview: { lat: number; lng: number; name: string } | null
  navTarget: { lat: number; lng: number; name: string } | null
  mapBounds: { north: number; south: number; east: number; west: number } | null
  tileSource: 'offline' | 'online' | 'mixed' | null
  activeSpotId: string | null
  compassHeading: number | null
  currentWeather: { windSpeed: number; windDir: number; temp: number } | null
  offlineOnly: boolean
  offlineDownload: { status: 'downloading' | 'done' | 'error'; progress: number; total: number; skipped: number; areaName: string } | null
  aisVisible: boolean
  aisKey: string
  aisStatus: { state: 'idle' | 'connecting' | 'live' | 'warn' | 'error'; count: number; message: string }
  boatInfo: BoatInfo
  lookAhead: boolean
  headingUp: boolean
  savedTracks: SavedTrack[]
  followingTrack: SavedTrack | null

  setPosition: (pos: Position) => void
  setHeading: (heading: number) => void
  startTracking: () => void
  stopTracking: () => void
  clearTrack: () => void
  addSpot: (spot: SavedSpot) => void
  removeSpot: (id: string) => void
  setMob: (pos: { lat: number; lng: number }) => void
  clearMob: () => void
  setFollowBoat: (v: boolean) => void
  setAddingSpot: (v: boolean) => void
  setActivePanel: (p: 'spots' | 'turer' | 'meg' | null) => void
  toggleCompass: () => void
  toggleDarkMode: () => void
  toggleNightVision: () => void
  cycleDisplayMode: () => void   // day → night → night-vision → day
  toggleSeamark: () => void
  toggleWeather: () => void
  toggleTide: () => void
  hideWxTide: () => void
  toggleSpeedUnit: () => void
  cycleDistUnit: () => void
  cycleRingRadius: () => void
  setFlyTo: (pos: { lat: number; lng: number } | null) => void
  setSearchPin: (pin: { lat: number; lng: number; name: string } | null) => void
  setSpotMenu: (spot: { lat: number; lng: number; name: string; id?: string } | null) => void
  setNavPreview: (target: { lat: number; lng: number; name: string }) => void
  confirmNav: () => void
  clearNavPreview: () => void
  setNavTarget: (target: { lat: number; lng: number; name: string }) => void
  clearNav: () => void
  setMapBounds: (b: { north: number; south: number; east: number; west: number }) => void
  setTileSource: (source: 'offline' | 'online' | 'mixed') => void
  setActiveSpot: (id: string | null) => void
  setCompassHeading: (h: number) => void
  setCurrentWeather: (w: { windSpeed: number; windDir: number; temp: number } | null) => void
  toggleOfflineOnly: () => void
  setOfflineOnly: (v: boolean) => void
  setOfflineDownload: (d: { status: 'downloading' | 'done' | 'error'; progress: number; total: number; skipped: number; areaName: string } | null) => void
  toggleAis: () => void
  setAisKey: (key: string) => void
  setAisStatus: (s: { state: 'idle' | 'connecting' | 'live' | 'warn' | 'error'; count: number; message: string }) => void
  setBoatInfo: (info: Partial<BoatInfo>) => void
  toggleLookAhead: () => void
  toggleHeadingUp: () => void
  saveCurrentTrack: (name: string, icon?: string) => void
  deleteSavedTrack: (id: string) => void
  startFollowingTrack: (track: SavedTrack) => void
  stopFollowingTrack: () => void
}

function loadSpots(): SavedSpot[] {
  try { return JSON.parse(localStorage.getItem('fishingSpots') || '[]') } catch { return [] }
}
function saveSpots(spots: SavedSpot[]) {
  localStorage.setItem('fishingSpots', JSON.stringify(spots))
}

function loadTrack(): TrackPoint[] {
  try { return JSON.parse(localStorage.getItem('currentTrack') || '[]') } catch { return [] }
}
function saveTrack(track: TrackPoint[]) {
  localStorage.setItem('currentTrack', JSON.stringify(track))
}

function loadMob(): MobPoint | null {
  try { return JSON.parse(localStorage.getItem('mobPoint') || 'null') } catch { return null }
}
function saveMob(mob: MobPoint | null) {
  localStorage.setItem('mobPoint', JSON.stringify(mob))
}

const BOAT_INFO_KEY = 'baatkart-boatinfo'
function loadBoatInfo(): BoatInfo {
  try { return { name: '', mmsi: '', phone: '', boatType: '', notes: '', ...JSON.parse(localStorage.getItem(BOAT_INFO_KEY) ?? '{}') } }
  catch { return { name: '', mmsi: '', phone: '', boatType: '', notes: '' } }
}

function loadSavedTracks(): SavedTrack[] {
  try { return JSON.parse(localStorage.getItem('savedTracks') || '[]') } catch { return [] }
}
function persistSavedTracks(tracks: SavedTrack[]) {
  localStorage.setItem('savedTracks', JSON.stringify(tracks))
}

function loadBool(key: string, def: boolean): boolean {
  const v = localStorage.getItem(key)
  return v === null ? def : v === 'true'
}

function loadDarkMode(): boolean { return loadBool('darkMode', true) }
function loadSpeedUnit(): SpeedUnit { return (localStorage.getItem('speedUnit') as SpeedUnit) || 'kmh' }
function loadDistUnit(): DistUnit { return (localStorage.getItem('distUnit') as DistUnit) || 'm' }
function loadSeamark(): boolean { return loadBool('seamarkVisible', false) }
function loadWeather(): boolean { return loadBool('weatherVisible', false) }
function loadTide(): boolean { return loadBool('tideVisible', false) }
function loadCompass(): boolean { return loadBool('compassEnabled', false) }
function loadRingRadius(): RingSize {
  const v = localStorage.getItem('ringRadius')
  if (!v || v === 'null') return null
  const n = Number(v)
  return (RING_CYCLE as readonly (number | null)[]).includes(n) ? n as RingSize : null
}

export const useMapStore = create<MapStore>((set) => ({
  position: null,
  isTracking: false,
  track: loadTrack(),
  savedSpots: loadSpots(),
  mobPoint: loadMob(),
  mobTrack: [],
  followBoat: true,
  addingSpot: false,
  activePanel: null,
  compassEnabled: loadCompass(),
  darkMode: loadDarkMode(),
  nightVision: loadBool('nightVision', false),
  seamarkVisible: loadSeamark(),
  weatherVisible: loadWeather(),
  tideVisible: loadTide(),
  speedUnit: loadSpeedUnit(),
  distUnit: loadDistUnit(),
  customRingRadius: loadRingRadius(),
  flyTo: null,
  searchPin: null,
  spotMenu: null,
  navPreview: null,
  navTarget: null,
  mapBounds: null,
  tileSource: null,
  activeSpotId: null,
  compassHeading: null,
  currentWeather: null,
  offlineOnly: loadBool('offlineOnly', false),
  offlineDownload: null,
  aisVisible: loadBool('aisVisible', false),
  aisKey: localStorage.getItem('aisKey') ?? '',
  aisStatus: { state: 'idle', count: 0, message: '' },
  boatInfo: loadBoatInfo(),
  lookAhead: loadBool('lookAhead', false),
  headingUp: loadBool('headingUp', false),
  savedTracks: loadSavedTracks(),
  followingTrack: null,

  setPosition: (pos) =>
    set((state) => {
      const updates: Partial<MapStore> = { position: pos }
      if (state.isTracking) {
        const track = [...state.track, { lat: pos.lat, lng: pos.lng, timestamp: pos.timestamp }]
        saveTrack(track)
        updates.track = track
      }
      if (state.mobPoint) {
        updates.mobTrack = [...state.mobTrack, { lat: pos.lat, lng: pos.lng, timestamp: pos.timestamp }]
      }
      return updates
    }),

  setHeading: (heading) =>
    set((s) => ({ position: s.position ? { ...s.position, heading } : s.position })),

  startTracking: () => set({ isTracking: true }),
  stopTracking: () => set({ isTracking: false }),
  clearTrack: () => { saveTrack([]); return set({ track: [] }) },

  addSpot: (spot) =>
    set((state) => {
      const spots = [...state.savedSpots, spot]
      saveSpots(spots)
      return { savedSpots: spots, addingSpot: false }
    }),

  removeSpot: (id) =>
    set((state) => {
      const spots = state.savedSpots.filter((s) => s.id !== id)
      saveSpots(spots)
      return { savedSpots: spots }
    }),

  setMob: (pos) => {
    const mob = { ...pos, timestamp: Date.now() }
    saveMob(mob)
    return set({ mobPoint: mob, mobTrack: [] })
  },
  clearMob: () => { saveMob(null); return set({ mobPoint: null, mobTrack: [] }) },

  setFollowBoat: (v) => set({ followBoat: v }),
  setAddingSpot: (v) => set({ addingSpot: v }),
  setActivePanel: (p) => set({ activePanel: p }),
  toggleCompass: () => set((s) => { const v = !s.compassEnabled; localStorage.setItem('compassEnabled', String(v)); return { compassEnabled: v } }),
  toggleSeamark: () => set((s) => { const v = !s.seamarkVisible; localStorage.setItem('seamarkVisible', String(v)); return { seamarkVisible: v } }),
  toggleWeather: () => set((s) => { const v = !s.weatherVisible; localStorage.setItem('weatherVisible', String(v)); return { weatherVisible: v } }),
  toggleTide: () => set((s) => { const v = !s.tideVisible; localStorage.setItem('tideVisible', String(v)); return { tideVisible: v } }),
  hideWxTide: () => { localStorage.setItem('weatherVisible', 'false'); localStorage.setItem('tideVisible', 'false'); set({ weatherVisible: false, tideVisible: false }) },
  toggleDarkMode: () => set((s) => {
    const next = !s.darkMode
    localStorage.setItem('darkMode', String(next))
    return { darkMode: next }
  }),
  toggleNightVision: () => set((s) => {
    const next = !s.nightVision
    localStorage.setItem('nightVision', String(next))
    // Night vision only makes sense on a dark base — force dark mode on when enabling.
    if (next && s.darkMode === false) {
      localStorage.setItem('darkMode', 'true')
      return { nightVision: next, darkMode: true }
    }
    return { nightVision: next }
  }),
  // Single button cycles the three display modes:
  // 1 day (light) → 2 night (dark) → 3 night-vision (dark + red) → back to day
  cycleDisplayMode: () => set((s) => {
    let darkMode: boolean, nightVision: boolean
    if (!s.darkMode && !s.nightVision)      { darkMode = true;  nightVision = false } // day → night
    else if (s.darkMode && !s.nightVision)  { darkMode = true;  nightVision = true  } // night → night-vision
    else                                    { darkMode = false; nightVision = false } // → day
    localStorage.setItem('darkMode', String(darkMode))
    localStorage.setItem('nightVision', String(nightVision))
    return { darkMode, nightVision }
  }),
  toggleSpeedUnit: () => set((s) => {
    const next: SpeedUnit = s.speedUnit === 'kn' ? 'kmh' : 'kn'
    localStorage.setItem('speedUnit', next)
    return { speedUnit: next }
  }),
  cycleDistUnit: () => set((s) => {
    const order: DistUnit[] = ['nm', 'm', 'km']
    const next = order[(order.indexOf(s.distUnit) + 1) % order.length]
    localStorage.setItem('distUnit', next)
    return { distUnit: next }
  }),
  cycleRingRadius: () => set((s) => {
    const idx = RING_CYCLE.indexOf(s.customRingRadius)
    const next = RING_CYCLE[(idx + 1) % RING_CYCLE.length]
    localStorage.setItem('ringRadius', String(next))
    return { customRingRadius: next }
  }),

  setFlyTo: (pos) => set({ flyTo: pos, followBoat: false }),
  setSearchPin: (pin) => set({ searchPin: pin }),
  setSpotMenu: (spot) => set({ spotMenu: spot }),
  setNavPreview: (target) => set({ navPreview: target, navTarget: null, followBoat: false }),
  confirmNav: () => set((s) => ({ navTarget: s.navPreview, navPreview: null })),
  clearNavPreview: () => set({ navPreview: null }),
  setNavTarget: (target) => set({ navTarget: target, navPreview: null, followBoat: false }),
  clearNav: () => set({ navTarget: null, navPreview: null }),
  setMapBounds: (b) => set({ mapBounds: b }),
  setTileSource: (source) => set({ tileSource: source }),
  setActiveSpot: (id) => set({ activeSpotId: id }),
  setCompassHeading: (h) => set({ compassHeading: h }),
  setCurrentWeather: (w) => set({ currentWeather: w }),
  toggleOfflineOnly: () => set((s) => { const v = !s.offlineOnly; localStorage.setItem('offlineOnly', String(v)); return { offlineOnly: v } }),
  setOfflineOnly: (v) => { localStorage.setItem('offlineOnly', String(v)); set({ offlineOnly: v }) },
  setOfflineDownload: (d) => set({ offlineDownload: d }),
  toggleAis: () => set((s) => { const v = !s.aisVisible; localStorage.setItem('aisVisible', String(v)); return { aisVisible: v } }),
  setAisKey: (key) => {
    localStorage.setItem('aisKey', key)
    const extra = key ? {} : { aisVisible: false }
    if (!key) localStorage.setItem('aisVisible', 'false')
    set({ aisKey: key, ...extra })
  },
  setAisStatus: (s) => set({ aisStatus: s }),
  toggleLookAhead: () => set((s) => { const v = !s.lookAhead; localStorage.setItem('lookAhead', String(v)); return { lookAhead: v } }),
  toggleHeadingUp: () => set((s) => { const v = !s.headingUp; localStorage.setItem('headingUp', String(v)); return { headingUp: v } }),

  saveCurrentTrack: (name, icon) => set((s) => {
    if (s.track.length < 2) return {}
    const pts = s.track.map((p) => ({ lat: p.lat, lng: p.lng }))
    const dist = pts.reduce((acc, pt, i) => {
      if (i === 0) return 0
      return acc + _haversineM(pts[i - 1].lat, pts[i - 1].lng, pt.lat, pt.lng)
    }, 0)
    const saved: SavedTrack = { id: Date.now().toString(), name, date: new Date().toISOString(), points: pts, distanceM: dist, icon }
    const tracks = [...s.savedTracks, saved]
    persistSavedTracks(tracks)
    return { savedTracks: tracks }
  }),
  deleteSavedTrack: (id) => set((s) => {
    const tracks = s.savedTracks.filter((t) => t.id !== id)
    persistSavedTracks(tracks)
    return { savedTracks: tracks, followingTrack: s.followingTrack?.id === id ? null : s.followingTrack }
  }),
  startFollowingTrack: (track) => set({ followingTrack: track }),
  stopFollowingTrack: () => set({ followingTrack: null }),

  setBoatInfo: (info) => set((s) => {
    const updated = { ...s.boatInfo, ...info }
    localStorage.setItem(BOAT_INFO_KEY, JSON.stringify(updated))
    return { boatInfo: updated }
  }),
}))
