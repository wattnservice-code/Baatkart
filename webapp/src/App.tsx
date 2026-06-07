import MapView from './components/MapView'
import StatusBar from './components/StatusBar'
import MapControls from './components/MapControls'
import { useGPS } from './hooks/useGPS'
import { useAppUpdate } from './hooks/useAppUpdate'

export default function App() {
  useGPS()
  const { showPrompt, update } = useAppUpdate()

  return (
    <div className="app-root">
      <MapView />
      <StatusBar />
      <MapControls />

      {showPrompt && (
        <div className="update-banner">
          <span>Ny versjon tilgjengelig</span>
          <button onClick={update} className="update-btn">Oppdater</button>
        </div>
      )}
    </div>
  )
}
