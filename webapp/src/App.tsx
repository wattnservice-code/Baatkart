import MapView from './components/MapView'
import StatusBar from './components/StatusBar'
import { useGPS } from './hooks/useGPS'

export default function App() {
  useGPS()

  return (
    <div className="relative w-full h-full">
      <MapView />
      <StatusBar />
    </div>
  )
}
