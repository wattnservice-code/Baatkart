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

export interface FishingSpot {
  id: string
  lat: number
  lng: number
  name: string
}

interface MapStore {
  position: Position | null
  isTracking: boolean
  track: TrackPoint[]
  fishingSpots: FishingSpot[]
  followBoat: boolean
  addingSpot: boolean

  setPosition: (pos: Position) => void
  startTracking: () => void
  stopTracking: () => void
  clearTrack: () => void
  addFishingSpot: (spot: FishingSpot) => void
  removeFishingSpot: (id: string) => void
  setFollowBoat: (v: boolean) => void
  setAddingSpot: (v: boolean) => void
}

function loadSpots(): FishingSpot[] {
  try { return JSON.parse(localStorage.getItem('fishingSpots') || '[]') } catch { return [] }
}

function saveSpots(spots: FishingSpot[]) {
  localStorage.setItem('fishingSpots', JSON.stringify(spots))
}

export const useMapStore = create<MapStore>((set) => ({
  position: null,
  isTracking: false,
  track: [],
  fishingSpots: loadSpots(),
  followBoat: true,
  addingSpot: false,

  setPosition: (pos) =>
    set((state) => ({
      position: pos,
      track: state.isTracking
        ? [...state.track, { lat: pos.lat, lng: pos.lng, timestamp: pos.timestamp }]
        : state.track,
    })),

  startTracking: () => set({ isTracking: true }),
  stopTracking: () => set({ isTracking: false }),
  clearTrack: () => set({ track: [] }),

  addFishingSpot: (spot) =>
    set((state) => {
      const spots = [...state.fishingSpots, spot]
      saveSpots(spots)
      return { fishingSpots: spots, addingSpot: false }
    }),

  removeFishingSpot: (id) =>
    set((state) => {
      const spots = state.fishingSpots.filter((s) => s.id !== id)
      saveSpots(spots)
      return { fishingSpots: spots }
    }),

  setFollowBoat: (v) => set({ followBoat: v }),
  setAddingSpot: (v) => set({ addingSpot: v }),
}))
