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
}

export interface MobPoint {
  lat: number
  lng: number
  timestamp: number
}

export type SpeedUnit = 'kn' | 'kmh'
export type DistUnit = 'm' | 'km' | 'nm'

const RING_CYCLE = [null, 200, 500, 1000, 2000, 5000] as const
export type RingSize = typeof RING_CYCLE[number]

interface MapStore {
  position: Position | null
  isTracking: boolean
  track: TrackPoint[]
  savedSpots: SavedSpot[]
  mobPoint: MobPoint | null
  mobTrack: TrackPoint[]
  anchorPoint: { lat: number; lng: number } | null
  anchorRadius: number
  anchorAlarm: boolean
  followBoat: boolean
  addingSpot: boolean
  compassEnabled: boolean
  darkMode: boolean
  seamarkVisible: boolean
  weatherVisible: boolean
  tideVisible: boolean
  speedUnit: SpeedUnit
  distUnit: DistUnit
  customRingRadius: RingSize
  flyTo: { lat: number; lng: number } | null
  navPreview: { lat: number; lng: number; name: string } | null
  navTarget: { lat: number; lng: number; name: string } | null
  mapBounds: { north: number; south: number; east: number; west: number } | null

  setPosition: (pos: Position) => void
  setHeading: (heading: number) => void
  startTracking: () => void
  stopTracking: () => void
  clearTrack: () => void
  addSpot: (spot: SavedSpot) => void
  removeSpot: (id: string) => void
  setMob: (pos: { lat: number; lng: number }) => void
  clearMob: () => void
  setAnchor: (pos: { lat: number; lng: number }, radius: number) => void
  clearAnchor: () => void
  setAnchorRadius: (r: number) => void
  setFollowBoat: (v: boolean) => void
  setAddingSpot: (v: boolean) => void
  toggleCompass: () => void
  toggleDarkMode: () => void
  toggleSeamark: () => void
  toggleWeather: () => void
  toggleTide: () => void
  toggleSpeedUnit: () => void
  cycleDistUnit: () => void
  cycleRingRadius: () => void
  setFlyTo: (pos: { lat: number; lng: number } | null) => void
  setNavPreview: (target: { lat: number; lng: number; name: string }) => void
  confirmNav: () => void
  clearNavPreview: () => void
  setNavTarget: (target: { lat: number; lng: number; name: string }) => void
  clearNav: () => void
  setMapBounds: (b: { north: number; south: number; east: number; west: number }) => void
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

function loadDarkMode(): boolean {
  return localStorage.getItem('darkMode') !== 'false'
}

function loadSpeedUnit(): SpeedUnit {
  return (localStorage.getItem('speedUnit') as SpeedUnit) || 'kmh'
}

function loadDistUnit(): DistUnit {
  return (localStorage.getItem('distUnit') as DistUnit) || 'm'
}

export const useMapStore = create<MapStore>((set) => ({
  position: null,
  isTracking: false,
  track: loadTrack(),
  savedSpots: loadSpots(),
  mobPoint: loadMob(),
  mobTrack: [],
  anchorPoint: null,
  anchorRadius: 50,
  anchorAlarm: false,
  followBoat: true,
  addingSpot: false,
  compassEnabled: false,
  darkMode: loadDarkMode(),
  seamarkVisible: true,
  weatherVisible: false,
  tideVisible: false,
  speedUnit: loadSpeedUnit(),
  distUnit: loadDistUnit(),
  customRingRadius: null,
  flyTo: null,
  navPreview: null,
  navTarget: null,
  mapBounds: null,

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
      if (state.anchorPoint) {
        const R = 6371000
        const φ1 = state.anchorPoint.lat * Math.PI / 180, φ2 = pos.lat * Math.PI / 180
        const Δφ = (pos.lat - state.anchorPoint.lat) * Math.PI / 180
        const Δλ = (pos.lng - state.anchorPoint.lng) * Math.PI / 180
        const a = Math.sin(Δφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2
        const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
        updates.anchorAlarm = dist > state.anchorRadius
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
  toggleCompass: () => set((s) => ({ compassEnabled: !s.compassEnabled })),
  toggleSeamark: () => set((s) => ({ seamarkVisible: !s.seamarkVisible })),
  toggleWeather: () => set((s) => ({ weatherVisible: !s.weatherVisible })),
  toggleTide: () => set((s) => ({ tideVisible: !s.tideVisible })),
  toggleDarkMode: () => set((s) => {
    const next = !s.darkMode
    localStorage.setItem('darkMode', String(next))
    return { darkMode: next }
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
    return { customRingRadius: RING_CYCLE[(idx + 1) % RING_CYCLE.length] }
  }),

  setAnchor: (pos, radius) => set({ anchorPoint: pos, anchorRadius: radius, anchorAlarm: false }),
  clearAnchor: () => set({ anchorPoint: null, anchorAlarm: false }),
  setAnchorRadius: (r) => set({ anchorRadius: r, anchorAlarm: false }),

  setFlyTo: (pos) => set({ flyTo: pos, followBoat: false }),
  setNavPreview: (target) => set({ navPreview: target, navTarget: null, followBoat: false }),
  confirmNav: () => set((s) => ({ navTarget: s.navPreview, navPreview: null })),
  clearNavPreview: () => set({ navPreview: null }),
  setNavTarget: (target) => set({ navTarget: target, navPreview: null, followBoat: false }),
  clearNav: () => set({ navTarget: null, navPreview: null }),
  setMapBounds: (b) => set({ mapBounds: b }),
}))
