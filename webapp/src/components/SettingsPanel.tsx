import { useState } from 'react'
import { APP_VERSION } from '../version'
import { X, Ship, Layers, Circle, Compass, Gauge, WifiOff, User, Info, RotateCw } from 'lucide-react'
import { useSwipeDismiss } from '../hooks/useSwipeDismiss'
import { useMapStore } from '../store/useMapStore'
import OfflinePanel from './OfflinePanel'
import BoatInfoPanel from './BoatInfoPanel'
import InfoPanel from './InfoPanel'

function formatRingLabel(r: null | number): string {
  if (r === null) return 'Auto'
  return r >= 1000 ? `${r / 1000} km` : `${r} m`
}

const subhead: React.CSSProperties = {
  padding: '14px 16px 4px', fontSize: 11, fontWeight: 700,
  color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px',
}

interface Props { onClose: () => void }

export default function SettingsPanel({ onClose }: Props) {
  const [offlineOpen, setOfflineOpen]     = useState(false)
  const [boatInfoOpen, setBoatInfoOpen]   = useState(false)
  const [infoOpen, setInfoOpen]           = useState(false)
  const seamarkVisible = useMapStore((s) => s.seamarkVisible)
  const compassEnabled = useMapStore((s) => s.compassEnabled)
  const speedUnit      = useMapStore((s) => s.speedUnit)
  const distUnit       = useMapStore((s) => s.distUnit)
  const customRingRadius = useMapStore((s) => s.customRingRadius)
  const rotateEnabled  = useMapStore((s) => s.rotateEnabled)
  const toggleSeamark  = useMapStore((s) => s.toggleSeamark)
  const toggleCompass  = useMapStore((s) => s.toggleCompass)
  const toggleRotateEnabled = useMapStore((s) => s.toggleRotateEnabled)
  const toggleSpeedUnit = useMapStore((s) => s.toggleSpeedUnit)
  const cycleDistUnit  = useMapStore((s) => s.cycleDistUnit)
  const autoTrack      = useMapStore((s) => s.autoTrack)
  const toggleAutoTrack = useMapStore((s) => s.toggleAutoTrack)
  const cycleRingRadius      = useMapStore((s) => s.cycleRingRadius)
  const aisVisible              = useMapStore((s) => s.aisVisible)
  const toggleAis               = useMapStore((s) => s.toggleAis)
  const aisShowStationary       = useMapStore((s) => s.aisShowStationary)
  const toggleAisShowStationary = useMapStore((s) => s.toggleAisShowStationary)

  const handleCompassToggle = async () => {
    if (!compassEnabled) {
      // iOS requires requestPermission() from a synchronous user-gesture context.
      const DevOr = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }
      if (typeof DevOr.requestPermission === 'function') {
        try {
          const perm = await DevOr.requestPermission()
          if (perm !== 'granted') return
        } catch { return }
      }
    }
    toggleCompass()
  }

  const swipe = useSwipeDismiss(onClose)

  return (
    <>
      <div className="settings-sheet">
        <div className="settings-head" {...swipe}>
          <span className="settings-title"><User size={18} /> Meg</span>
          <button className="settings-close" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="settings-body">
          <div style={subhead}>Hjelp</div>
          <button className="menu-item" onClick={() => setInfoOpen(true)}>
            <Info size={20} /><span>Bruksanvisning og forbehold</span>
          </button>

          <div className="menu-divider" />
          <div style={subhead}>Kart</div>
          <button className="menu-item" onClick={() => setOfflineOpen(true)}>
            <WifiOff size={20} /><span>Offline kart</span>
          </button>

          <div className="menu-divider" />
          <div style={subhead}>Båt</div>
          <button className="menu-item" onClick={() => setBoatInfoOpen(true)}>
            <Ship size={20} /><span>Båtinfo</span>
          </button>

          <div className="menu-divider" />
          <div style={subhead}>Kartvisning</div>
          <button className="menu-item" style={{ color: seamarkVisible ? '#60a5fa' : undefined }} onClick={toggleSeamark}>
            <Layers size={20} /><span>Sjømerke {seamarkVisible ? '(på)' : '(av)'}</span>
          </button>
          <button className="menu-item" onClick={cycleRingRadius}>
            <Circle size={20} /><span>Avstandsring: {formatRingLabel(customRingRadius)}</span>
          </button>
          <button className="menu-item" style={{ color: compassEnabled ? '#60a5fa' : undefined }} onClick={handleCompassToggle}>
            <Compass size={20} /><span>Kompass {compassEnabled ? '(på)' : '(av)'}</span>
          </button>
          <button className="menu-item" style={{ color: rotateEnabled ? '#60a5fa' : undefined }} onClick={toggleRotateEnabled}>
            <RotateCw size={20} /><span>Vri kart med to fingre {rotateEnabled ? '(på)' : '(av)'}</span>
          </button>

          <div className="menu-divider" />
          <div style={subhead}>Sporing</div>
          <button className="menu-item" style={{ color: autoTrack ? '#60a5fa' : undefined }} onClick={toggleAutoTrack}>
            <Circle size={20} /><span>Start tur-opptak automatisk {autoTrack ? '(på)' : '(av)'}</span>
          </button>

          <div className="menu-divider" />
          <div style={subhead}>AIS – fartøy på kartet</div>
          <button className="menu-item" style={{ color: aisVisible ? '#60a5fa' : undefined }} onClick={toggleAis}>
            <Ship size={20} /><span>Vis AIS-fartøy {aisVisible ? '(på)' : '(av)'}</span>
          </button>
          {aisVisible && (
            <button className="menu-item" style={{ color: aisShowStationary ? '#60a5fa' : undefined }} onClick={toggleAisShowStationary}>
              <Ship size={20} /><span>Vis fortøyde/ankrede {aisShowStationary ? '(på)' : '(av)'}</span>
            </button>
          )}

          <div className="menu-divider" />
          <div style={subhead}>Enheter</div>
          <button className="menu-item" onClick={toggleSpeedUnit}>
            <Gauge size={20} /><span>Fart: {speedUnit === 'kn' ? 'Knop → km/t' : 'km/t → Knop'}</span>
          </button>
          <button className="menu-item" onClick={cycleDistUnit}>
            <Gauge size={20} /><span>Avstand: {distUnit === 'nm' ? 'nm → m' : distUnit === 'm' ? 'm → km' : 'km → nm'}</span>
          </button>

          <div style={{ padding: '20px 16px 4px', textAlign: 'center', fontSize: 11, color: '#475569' }}>
            Båtkart v{APP_VERSION}
          </div>

        </div>
      </div>

      {offlineOpen && <OfflinePanel onClose={() => setOfflineOpen(false)} />}
      {boatInfoOpen && <BoatInfoPanel onClose={() => setBoatInfoOpen(false)} />}
      {infoOpen && <InfoPanel onClose={() => setInfoOpen(false)} />}

    </>
  )
}
