import { useMapStore } from '../store/useMapStore'

function msToKnots(ms: number) {
  return (ms * 1.94384).toFixed(1)
}

export default function StatusBar() {
  const position = useMapStore((s) => s.position)
  const isTracking = useMapStore((s) => s.isTracking)
  const track = useMapStore((s) => s.track)
  const startTracking = useMapStore((s) => s.startTracking)
  const stopTracking = useMapStore((s) => s.stopTracking)
  const clearTrack = useMapStore((s) => s.clearTrack)

  return (
    <div className="absolute bottom-0 left-0 right-0 z-30 bg-slate-900/90 text-white flex items-center gap-4 px-4 py-2 text-sm">
      <span className="font-mono text-lg font-bold">
        {position ? `${msToKnots(position.speed)} kn` : '-- kn'}
      </span>

      <span className="text-slate-400">
        {position
          ? `${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}`
          : 'Ingen GPS'}
      </span>

      <span className="text-slate-400 ml-auto">
        {position ? `${Math.round(position.heading)}°` : ''}
      </span>

      <div className="flex gap-2">
        {!isTracking ? (
          <button
            onClick={startTracking}
            className="bg-green-600 hover:bg-green-500 px-3 py-1 rounded text-xs font-medium"
          >
            Start spor
          </button>
        ) : (
          <button
            onClick={stopTracking}
            className="bg-red-600 hover:bg-red-500 px-3 py-1 rounded text-xs font-medium"
          >
            Stopp spor
          </button>
        )}
        {track.length > 0 && (
          <button
            onClick={clearTrack}
            className="bg-slate-600 hover:bg-slate-500 px-3 py-1 rounded text-xs font-medium"
          >
            Slett
          </button>
        )}
      </div>
    </div>
  )
}
