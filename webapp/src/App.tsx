import MapView from './components/MapView'
import StatusBar from './components/StatusBar'
import { useGPS } from './hooks/useGPS'
import { useAppUpdate } from './hooks/useAppUpdate'

export default function App() {
  useGPS()
  const { showPrompt, update } = useAppUpdate()

  return (
    <div className="relative w-full h-full">
      <MapView />
      <StatusBar />
      {showPrompt && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-3 text-sm">
          <span>Ny versjon tilgjengelig</span>
          <button
            onClick={update}
            className="bg-white text-blue-600 font-semibold px-3 py-1 rounded-full text-xs"
          >
            Oppdater
          </button>
        </div>
      )}
    </div>
  )
}
