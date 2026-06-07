import { create } from 'zustand'

interface Position {
  lat: number
  lng: number
  speed: number      // m/s
  heading: number    // degrees
  accuracy: number
  timestamp: number
}

interface TrackPoint {
  lat: number
  lng: number
  timestamp: number
}

interface FishingSpot {
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

  setPosition: (pos: Position) => void
  startTracking: () => void
  stopTracking: () => void
  clearTrack: () => void
  addFishingSpot: (spot: FishingSpot) => void
  removeFishingSpot: (id: string) => void
}

export const useMapStore = create<MapStore>((set) => ({
  position: null,
  isTracking: false,
  track: [],
  fishingSpots: [],

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
    set((state) => ({ fishingSpots: [...state.fishingSpots, spot] })),

  removeFishingSpot: (id) =>
    set((state) => ({ fishingSpots: state.fishingSpots.filter((s) => s.id !== id) })),
}))
