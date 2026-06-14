import { useState, useEffect } from 'react'
import { X, Ship, Layers, Circle, Compass, Gauge, WifiOff, Trash2, User, Info } from 'lucide-react'
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
  const [aisKeyInput, setAisKeyInput]     = useState('')
  const [confirmDelKey, setConfirmDelKey] = useState(false)

  const darkMode       = useMapStore((s) => s.darkMode)
  const seamarkVisible = useMapStore((s) => s.seamarkVisible)
  const compassEnabled = useMapStore((s) => s.compassEnabled)
  const speedUnit      = useMapStore((s) => s.speedUnit)
  const distUnit       = useMapStore((s) => s.distUnit)
  const customRingRadius = useMapStore((s) => s.customRingRadius)
  const toggleSeamark  = useMapStore((s) => s.toggleSeamark)
  const toggleCompass  = useMapStore((s) => s.toggleCompass)
  const toggleSpeedUnit = useMapStore((s) => s.toggleSpeedUnit)
  const cycleDistUnit  = useMapStore((s) => s.cycleDistUnit)
  const autoTrack      = useMapStore((s) => s.autoTrack)
  const toggleAutoTrack = useMapStore((s) => s.toggleAutoTrack)
  const cycleRingRadius      = useMapStore((s) => s.cycleRingRadius)
  const aisKey               = useMapStore((s) => s.aisKey)
  const setAisKey            = useMapStore((s) => s.setAisKey)
  const aisVisible           = useMapStore((s) => s.aisVisible)
  const toggleAis            = useMapStore((s) => s.toggleAis)
  useEffect(() => { setAisKeyInput(aisKey) }, [aisKey])

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

          <div className="menu-divider" />
          <div style={subhead}>Sporing</div>
          <button className="menu-item" style={{ color: autoTrack ? '#60a5fa' : undefined }} onClick={toggleAutoTrack}>
            <Circle size={20} /><span>Start tur-opptak automatisk {autoTrack ? '(på)' : '(av)'}</span>
          </button>

          <div className="menu-divider" />
          <div style={subhead}>AIS – fartøy på kartet</div>
          {aisKey && (
            <button className="menu-item" style={{ color: aisVisible ? '#60a5fa' : undefined }} onClick={toggleAis}>
              <Ship size={20} /><span>Vis AIS-fartøy {aisVisible ? '(på)' : '(av)'}</span>
            </button>
          )}
          <div style={{ padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 12, color: darkMode ? '#94a3b8' : '#475569' }}>
              Gratis nøkkel: <b style={{ color: '#38bdf8' }}>aisstream.io</b>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                placeholder="Lim inn API-nøkkel"
                value={aisKeyInput}
                onChange={(e) => setAisKeyInput(e.target.value)}
                style={{
                  flex: 1, minWidth: 0, padding: '8px 10px', borderRadius: 8,
                  background: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                  border: darkMode ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(0,0,0,0.15)',
                  color: darkMode ? 'white' : '#0f172a', fontSize: 13, outline: 'none',
                }}
              />
              {aisKeyInput.trim() !== aisKey && (
                <button
                  onClick={() => setAisKey(aisKeyInput.trim())}
                  style={{
                    flexShrink: 0, padding: '8px 14px', borderRadius: 8, border: 'none',
                    background: '#2563eb', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                  }}
                >
                  Lagre
                </button>
              )}
              {aisKeyInput.trim() !== '' && (
                <button
                  onClick={() => setConfirmDelKey(true)}
                  style={{
                    flexShrink: 0, padding: '8px 10px', borderRadius: 8, border: 'none',
                    background: '#dc2626', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                  }}
                  title="Slett nøkkel"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
            {aisKey
              ? <div style={{ fontSize: 11, color: '#16a34a' }}>✓ Nøkkel lagret — bruk Ship-knappen på kartet</div>
              : <div style={{ fontSize: 11, color: darkMode ? '#64748b' : '#94a3b8' }}>Ingen nøkkel — AIS ikke tilgjengelig</div>
            }
          </div>

          <div className="menu-divider" />
          <div style={subhead}>Enheter</div>
          <button className="menu-item" onClick={toggleSpeedUnit}>
            <Gauge size={20} /><span>Fart: {speedUnit === 'kn' ? 'Knop → km/t' : 'km/t → Knop'}</span>
          </button>
          <button className="menu-item" onClick={cycleDistUnit}>
            <Gauge size={20} /><span>Avstand: {distUnit === 'nm' ? 'nm → m' : distUnit === 'm' ? 'm → km' : 'km → nm'}</span>
          </button>

        </div>
      </div>

      {offlineOpen && <OfflinePanel onClose={() => setOfflineOpen(false)} />}
      {boatInfoOpen && <BoatInfoPanel onClose={() => setBoatInfoOpen(false)} />}
      {infoOpen && <InfoPanel onClose={() => setInfoOpen(false)} />}

      {confirmDelKey && (
        <div className="dialog-overlay" onClick={() => setConfirmDelKey(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">Slett AIS-nøkkel</div>
            <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 16 }}>
              Er du sikker på at du vil slette API-nøkkelen?
            </p>
            <div className="dialog-actions">
              <button className="btn-secondary" onClick={() => setConfirmDelKey(false)}>Avbryt</button>
              <button className="btn-primary" style={{ background: '#dc2626' }} onClick={() => { setAisKey(''); setAisKeyInput(''); setConfirmDelKey(false) }}>
                <Trash2 size={15} /> Slett
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  )
}
