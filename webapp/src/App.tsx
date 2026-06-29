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
import SaveTrackDialog from './components/SaveTrackDialog'
import DisclaimerModal from './components/DisclaimerModal'
import WeatherOverlay from './components/WeatherOverlay'
import TideOverlay from './components/TideOverlay'
import { useAuth } from './hooks/useAuth'
import { useTripSync } from './hooks/useTripSync'
import { useGPS } from './hooks/useGPS'
import { useCompass } from './hooks/useCompass'
import { useWakeLock } from './hooks/useWakeLock'
import { useAIS } from './hooks/useAIS'
import { useMapStore } from './store/useMapStore'
import { syncAcceptanceOnLogin } from './consent'
import { unlockAudio } from './audio'

export default function App() {
  useGPS()
  useWakeLock()
  useAIS()
  const { user } = useAuth()
  useTripSync(user)
  // Logg lokal vilkårs-aksept til server når brukeren logger inn (bevis på samtykke)
  useEffect(() => { if (user) void syncAcceptanceOnLogin() }, [user])
  const compassEnabled   = useMapStore((s) => s.compassEnabled)
  const mobPoint         = useMapStore((s) => s.mobPoint)
  const navPreview       = useMapStore((s) => s.navPreview)
  const darkMode         = useMapStore((s) => s.darkMode)
  const setDarkMode      = useMapStore((s) => s.setDarkMode)
  const weatherVisible   = useMapStore((s) => s.weatherVisible)
  const tideVisible      = useMapStore((s) => s.tideVisible)
  const toggleWeather    = useMapStore((s) => s.toggleWeather)
  const toggleTide       = useMapStore((s) => s.toggleTide)
  const startTracking    = useMapStore((s) => s.startTracking)
  const clearTrack       = useMapStore((s) => s.clearTrack)
  const pendingTrackSave = useMapStore((s) => s.pendingTrackSave)
  const setPendingTrackSave = useMapStore((s) => s.setPendingTrackSave)
  useCompass(compassEnabled)

  // På oppstart: finaliser forrige økt hvis det er et opphold (>45 min siden
  // siste punkt = turen er over). Auto-lagring (Meg → Sporing) lagrer den da
  // automatisk; ellers droppes svært gamle spor som før. Korte opphold beholdes
  // så en bakgrunn/reload midt i turen ikke deler opp turen.
  useEffect(() => {
    const s = useMapStore.getState()
    const t = s.track
    const last = t[t.length - 1]
    const gapMs = last ? Date.now() - last.timestamp : 0
    const FINALIZE_GAP = 45 * 60 * 1000
    if (last && gapMs > FINALIZE_GAP) {
      if (s.autoSaveTrip && t.length >= 2) {
        const d = new Date(t[0].timestamp).toLocaleDateString('no-NO', { day: '2-digit', month: '2-digit', year: 'numeric' })
        s.saveCurrentTrack(`Tur ${d}`)
      }
      s.clearTrack()
    } else if (last && gapMs > 6 * 3600 * 1000) {
      s.clearTrack()
    }
    if (s.autoTrack) s.startTracking()
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

  // Follow system dark mode only when user hasn't set a manual preference
  useEffect(() => {
    if (localStorage.getItem('darkMode') !== null) return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => {
      if (localStorage.getItem('darkMode') === null) setDarkMode(e.matches)
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [setDarkMode])

  return (
    <div className={`app-root ${darkMode ? '' : 'day'}${mobPoint ? ' mob-active' : ''}${navPreview ? ' nav-preview-active' : ''}`}>
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
      {pendingTrackSave && <SaveTrackDialog onClose={() => setPendingTrackSave(false)} />}
    </div>
  )
}
