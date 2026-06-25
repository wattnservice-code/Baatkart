import { useEffect } from 'react'
import { Sun, Waves } from 'lucide-react'
import MapView from './components/MapView'
import StatusBar from './components/StatusBar'
import BottomNav from './components/BottomNav'
import MapControls from './components/MapControls'
import MobOverlay from './components/MobOverlay'
import NavOverlay from './components/NavOverlay'
import TrackFollowOverlay from './components/TrackFollowOverlay'
import MobButton from './components/MobButton'
import NavPreviewBar from './components/NavPreviewBar'
import DisclaimerModal from './components/DisclaimerModal'
import WeatherOverlay from './components/WeatherOverlay'
import TideOverlay from './components/TideOverlay'
import { useGPS } from './hooks/useGPS'
import { useCompass } from './hooks/useCompass'
import { useWakeLock } from './hooks/useWakeLock'
import { useAIS } from './hooks/useAIS'
import { useMapStore } from './store/useMapStore'
import { unlockAudio } from './audio'

export default function App() {
  useGPS()
  useWakeLock()
  useAIS()
  const compassEnabled   = useMapStore((s) => s.compassEnabled)
  const mobPoint         = useMapStore((s) => s.mobPoint)
  const navPreview       = useMapStore((s) => s.navPreview)
  const darkMode         = useMapStore((s) => s.darkMode)
  const nightVision      = useMapStore((s) => s.nightVision)
  const weatherVisible   = useMapStore((s) => s.weatherVisible)
  const tideVisible      = useMapStore((s) => s.tideVisible)
  const toggleWeather    = useMapStore((s) => s.toggleWeather)
  const toggleTide       = useMapStore((s) => s.toggleTide)
  const startTracking    = useMapStore((s) => s.startTracking)
  const clearTrack       = useMapStore((s) => s.clearTrack)
  useCompass(compassEnabled)

  // Auto-start recording on launch — only if the user opted in (Meg → Sporing).
  // Drops a stale track first so the line shows just this trip; a recent track
  // is kept so a service-worker reload mid-trip doesn't wipe the route.
  useEffect(() => {
    if (!useMapStore.getState().autoTrack) return
    const t = useMapStore.getState().track
    const last = t[t.length - 1]
    if (last && Date.now() - last.timestamp > 6 * 3600 * 1000) clearTrack()
    startTracking()
  }, [startTracking, clearTrack])

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
    <div className={`app-root ${darkMode ? '' : 'day'}${nightVision ? ' night-vision' : ''}${mobPoint ? ' mob-active' : ''}${navPreview ? ' nav-preview-active' : ''}`}>
      <DisclaimerModal />
      <div className="map-wrapper">
        <MapView />
        <MapControls />
        <button
          className={`wx-tide-toggle ${wxTideActive ? 'wx-tide-toggle-active' : ''}`}
          onClick={toggleWxTide}
          title={wxTideActive ? 'Skjul vær og tidevann' : 'Vis vær og tidevann'}
        >
          <Sun size={16} className="wx-sun-icon" />
          <Waves size={13} className="wx-tide-wave" />
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
      <MobButton />
      <StatusBar />
      <BottomNav />
    </div>
  )
}
