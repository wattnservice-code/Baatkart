import { useState, useEffect } from 'react'
import { X, Ship, Sun, Moon, Layers, Circle, Compass, Wind, Waves, Gauge, WifiOff, Globe, Trash2, User, Play } from 'lucide-react'
import { useMapStore } from '../store/useMapStore'
import { formatDist } from './NavOverlay'
import { useOnline } from '../hooks/useOnline'
import { openGoogleEarth } from '../googleEarth'
import { getMapInstance } from '../mapInstance'
import OfflinePanel from './OfflinePanel'
import BoatInfoPanel from './BoatInfoPanel'

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
  const [aisKeyInput, setAisKeyInput]     = useState('')
  const [confirmTrack, setConfirmTrack]   = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [confirmDelKey, setConfirmDelKey] = useState(false)

  const isOnline       = useOnline()
  const position       = useMapStore((s) => s.position)
  const track          = useMapStore((s) => s.track)
  const clearTrack     = useMapStore((s) => s.clearTrack)
  const darkMode       = useMapStore((s) => s.darkMode)
  const seamarkVisible = useMapStore((s) => s.seamarkVisible)
  const compassEnabled = useMapStore((s) => s.compassEnabled)
  const weatherVisible = useMapStore((s) => s.weatherVisible)
  const tideVisible    = useMapStore((s) => s.tideVisible)
  const speedUnit      = useMapStore((s) => s.speedUnit)
  const distUnit       = useMapStore((s) => s.distUnit)
  const customRingRadius = useMapStore((s) => s.customRingRadius)
  const toggleDarkMode = useMapStore((s) => s.toggleDarkMode)
  const toggleSeamark  = useMapStore((s) => s.toggleSeamark)
  const toggleCompass  = useMapStore((s) => s.toggleCompass)
  const toggleWeather  = useMapStore((s) => s.toggleWeather)
  const toggleTide     = useMapStore((s) => s.toggleTide)
  const toggleSpeedUnit = useMapStore((s) => s.toggleSpeedUnit)
  const cycleDistUnit  = useMapStore((s) => s.cycleDistUnit)
  const cycleRingRadius      = useMapStore((s) => s.cycleRingRadius)
  const aisKey               = useMapStore((s) => s.aisKey)
  const setAisKey            = useMapStore((s) => s.setAisKey)
  useEffect(() => { setAisKeyInput(aisKey) }, [aisKey])
  const savedTracks          = useMapStore((s) => s.savedTracks)
  const followingTrack       = useMapStore((s) => s.followingTrack)
  const deleteSavedTrack     = useMapStore((s) => s.deleteSavedTrack)
  const startFollowingTrack  = useMapStore((s) => s.startFollowingTrack)
  const stopFollowingTrack   = useMapStore((s) => s.stopFollowingTrack)

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

  const showEarth = () => {
    const c = position ?? getMapInstance()?.getCenter() ?? { lat: 59.9, lng: 10.7 }
    openGoogleEarth(c.lat, c.lng)
  }

  return (
    <>
      <div className="settings-sheet">
        <div className="settings-head">
          <span className="settings-title"><User size={18} /> Meg</span>
          <button className="settings-close" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="settings-body">
          <div style={subhead}>Båt</div>
          <button className="menu-item" onClick={() => setBoatInfoOpen(true)}>
            <Ship size={20} /><span>Båtinfo</span>
          </button>

          <div className="menu-divider" />
          <div style={subhead}>Kartvisning</div>
          <button className="menu-item" onClick={toggleDarkMode}>
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            <span>{darkMode ? 'Dagmodus' : 'Nattmodus'}</span>
          </button>
          <button className="menu-item" style={{ color: seamarkVisible ? '#60a5fa' : undefined }} onClick={toggleSeamark}>
            <Layers size={20} /><span>Sjømerke {seamarkVisible ? '(på)' : '(av)'}</span>
          </button>
          <button className="menu-item" onClick={cycleRingRadius}>
            <Circle size={20} /><span>Avstandsring: {formatRingLabel(customRingRadius)}</span>
          </button>

          <div className="menu-divider" />
          <div style={subhead}>Vær og sensorer</div>
          <button className="menu-item" style={{ color: weatherVisible ? '#60a5fa' : undefined }} onClick={toggleWeather}>
            <Wind size={20} /><span>Vær og vind {weatherVisible ? '(på)' : '(av)'}</span>
          </button>
          <button className="menu-item" style={{ color: tideVisible ? '#60a5fa' : undefined }} onClick={toggleTide}>
            <Waves size={20} /><span>Tidevann {tideVisible ? '(på)' : '(av)'}</span>
          </button>
          <button className="menu-item" style={{ color: compassEnabled ? '#60a5fa' : undefined }} onClick={handleCompassToggle}>
            <Compass size={20} /><span>Kompass {compassEnabled ? '(på)' : '(av)'}</span>
          </button>

          <div className="menu-divider" />
          <div style={subhead}>AIS – fartøy på kartet</div>
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

          <div className="menu-divider" />
          <div style={subhead}>Kart og 3D</div>
          <button className="menu-item" onClick={() => setOfflineOpen(true)}>
            <WifiOff size={20} /><span>Kart uten nett</span>
          </button>
          {isOnline && (
            <button className="menu-item" style={{ color: '#34d399' }} onClick={showEarth}>
              <Globe size={20} /><span>Vis i Google Earth (3D)</span>
            </button>
          )}

          {track.length > 0 && (
            <>
              <div className="menu-divider" />
              <div style={subhead}>Aktivt spor</div>
              <button className="menu-item" style={{ color: '#f87171' }} onClick={() => setConfirmTrack(true)}>
                <Trash2 size={20} /><span>Slett aktivt spor ({track.length} pkt)</span>
              </button>
            </>
          )}

          {savedTracks.length > 0 && (
            <>
              <div className="menu-divider" />
              <div style={subhead}>Lagrede turer ({savedTracks.length})</div>
              {savedTracks.map((t) => (
                <div key={t.id} className="saved-track-row">
                  <div className="saved-track-info">
                    <span className="saved-track-name">{t.name}</span>
                    <span className="saved-track-meta">
                      {formatDist(t.distanceM, distUnit)} · {new Date(t.date).toLocaleDateString('no-NO')}
                    </span>
                  </div>
                  <div className="saved-track-btns">
                    {followingTrack?.id === t.id ? (
                      <button className="saved-track-btn saved-track-stop" onClick={() => { stopFollowingTrack(); onClose() }}>
                        Stopp
                      </button>
                    ) : (
                      <button className="saved-track-btn saved-track-follow" onClick={() => { startFollowingTrack(t); onClose() }}>
                        <Play size={14} /> Følg
                      </button>
                    )}
                    <button className="saved-track-btn saved-track-del" onClick={() => setConfirmDeleteId(t.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {offlineOpen && <OfflinePanel onClose={() => setOfflineOpen(false)} />}
      {boatInfoOpen && <BoatInfoPanel onClose={() => setBoatInfoOpen(false)} />}

      {confirmDeleteId && (
        <div className="dialog-overlay" onClick={() => setConfirmDeleteId(null)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">Slett tur</div>
            <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 16 }}>
              Slette «{savedTracks.find((t) => t.id === confirmDeleteId)?.name}»?
            </p>
            <div className="dialog-actions">
              <button className="btn-secondary" onClick={() => setConfirmDeleteId(null)}>Avbryt</button>
              <button className="btn-primary" style={{ background: '#dc2626' }} onClick={() => { deleteSavedTrack(confirmDeleteId); setConfirmDeleteId(null) }}>
                <Trash2 size={15} /> Slett
              </button>
            </div>
          </div>
        </div>
      )}

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

      {confirmTrack && (
        <div className="dialog-overlay" onClick={() => setConfirmTrack(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">Slett spor</div>
            <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 16 }}>
              Slette sporet ({track.length} punkter)?
            </p>
            <div className="dialog-actions">
              <button className="btn-secondary" onClick={() => setConfirmTrack(false)}>Avbryt</button>
              <button className="btn-primary" style={{ background: '#dc2626' }} onClick={() => { clearTrack(); setConfirmTrack(false) }}>
                <Trash2 size={15} /> Slett
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
