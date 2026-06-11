import { useEffect } from 'react'
import { CloudSun, Waves } from 'lucide-react'
import MapView from './components/MapView'
import StatusBar from './components/StatusBar'
import BottomNav from './components/BottomNav'
import MapControls from './components/MapControls'
import MobOverlay from './components/MobOverlay'
import NavOverlay from './components/NavOverlay'
import TrackFollowOverlay from './components/TrackFollowOverlay'
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
  const compassEnabled   = useMapStore((s) => s.compassEnabled)
  const darkMode         = useMapStore((s) => s.darkMode)
  const weatherVisible   = useMapStore((s) => s.weatherVisible)
  const tideVisible      = useMapStore((s) => s.tideVisible)
  const toggleWeather    = useMapStore((s) => s.toggleWeather)
  const toggleTide       = useMapStore((s) => s.toggleTide)
  useCompass(compassEnabled)

  const wxTideActive = weatherVisible || tideVisible
  const toggleWxTide = () => {
    const showBoth = !wxTideActive
    if (weatherVisible !== showBoth) toggleWeather()
    if (tideVisible   !== showBoth) toggleTide()
  }

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
        <button
          className={`wx-tide-toggle ${wxTideActive ? 'wx-tide-toggle-active' : ''}`}
          onClick={toggleWxTide}
          title={wxTideActive ? 'Skjul vær og tidevann' : 'Vis vær og tidevann'}
        >
          <CloudSun size={15} />
          <Waves size={11} className="wx-tide-wave" />
        </button>
        <div className="map-left-panels">
          <WeatherOverlay />
          <TideOverlay />
        </div>
        <MobOverlay />
        <NavPreviewBar />
        <TrackFollowOverlay />
        <NavOverlay />
      </div>
      <StatusBar />
      <BottomNav />
    </div>
  )
}
