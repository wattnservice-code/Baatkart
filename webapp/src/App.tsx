import { useEffect } from 'react'
import MapView from './components/MapView'
import StatusBar from './components/StatusBar'
import BottomNav from './components/BottomNav'
import MapControls from './components/MapControls'
import MobOverlay from './components/MobOverlay'
import NavOverlay from './components/NavOverlay'
import NavPreviewBar from './components/NavPreviewBar'
import WeatherOverlay from './components/WeatherOverlay'
import TideOverlay from './components/TideOverlay'
import { useGPS } from './hooks/useGPS'
import { useCompass } from './hooks/useCompass'
import { useWakeLock } from './hooks/useWakeLock'
import { useMapStore } from './store/useMapStore'
import { unlockAudio } from './audio'

export default function App() {
  useGPS()
  useWakeLock()
  const compassEnabled = useMapStore((s) => s.compassEnabled)
  const darkMode = useMapStore((s) => s.darkMode)
  useCompass(compassEnabled)

  useEffect(() => {
    document.addEventListener('touchstart', unlockAudio, { once: true, passive: true })
    document.addEventListener('click', unlockAudio, { once: true })
    return () => {
      document.removeEventListener('touchstart', unlockAudio)
      document.removeEventListener('click', unlockAudio)
    }
  }, [])

  return (
    <div className={`app-root ${darkMode ? '' : 'day'}`}>
      <div className="map-wrapper">
        <MapView />
        <MapControls />
        <div className="map-left-panels">
          <WeatherOverlay />
          <TideOverlay />
        </div>
        <MobOverlay />
        <NavPreviewBar />
        <NavOverlay />
      </div>
      <StatusBar />
      <BottomNav />
    </div>
  )
}
