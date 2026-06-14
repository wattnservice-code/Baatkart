import { useState, useEffect } from 'react'
import { X, Trash2, Play, Square, Circle } from 'lucide-react'
import { useMapStore } from '../store/useMapStore'
import { formatDist } from './NavOverlay'
import { iconEmoji } from '../spotIcons'
import SaveTrackDialog from './SaveTrackDialog'
import type { SpeedUnit } from '../store/useMapStore'

interface Props { onClose: () => void }

function formatDuration(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)
  if (h > 0) return `${h}t ${m.toString().padStart(2, '0')}m`
  return `${m}m ${sec.toString().padStart(2, '0')}s`
}

function formatSpd(ms: number, unit: SpeedUnit): string {
  if (ms <= 0) return '—'
  return unit === 'kn'
    ? `${(ms * 1.94384).toFixed(1)} kn`
    : `${(ms * 3.6).toFixed(1)} km/t`
}

export default function TripsPanel({ onClose }: Props) {
  const isTracking          = useMapStore((s) => s.isTracking)
  const track               = useMapStore((s) => s.track)
  const startTracking       = useMapStore((s) => s.startTracking)
  const stopTracking        = useMapStore((s) => s.stopTracking)
  const clearTrack          = useMapStore((s) => s.clearTrack)
  const distUnit            = useMapStore((s) => s.distUnit)
  const speedUnit           = useMapStore((s) => s.speedUnit)
  const savedTracks         = useMapStore((s) => s.savedTracks)
  const followingTrack      = useMapStore((s) => s.followingTrack)
  const startFollowingTrack = useMapStore((s) => s.startFollowingTrack)
  const stopFollowingTrack  = useMapStore((s) => s.stopFollowingTrack)
  const deleteSavedTrack    = useMapStore((s) => s.deleteSavedTrack)
  const trackDistanceM      = useMapStore((s) => s.trackDistanceM)
  const trackMaxSpeed       = useMapStore((s) => s.trackMaxSpeed)

  const [showSave, setShowSave]       = useState(false)
  const [confirmId, setConfirmId]     = useState<string | null>(null)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (!isTracking) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [isTracking])

  const elapsedS = isTracking && track.length > 0 ? (now - track[0].timestamp) / 1000 : 0
  const avgSpeedMs = elapsedS > 0 ? trackDistanceM / elapsedS : 0

  const stopAndSave = () => {
    stopTracking()
    if (track.length > 1) setShowSave(true)
    else clearTrack()
  }

  return (
    <>
      <div className="settings-sheet">
        <div className="settings-head">
          <span className="settings-title">Turer</span>
          <button className="settings-close" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="settings-body">
          {/* Current trip */}
          <div className="spot-section-head">Aktiv tur</div>
          <div className="trip-current">
            {isTracking ? (
              <>
                <div className="trip-current-info">
                  <span className="trip-rec-dot">●</span>
                  <span className="trip-current-stat">{formatDist(trackDistanceM, distUnit)}</span>
                  <span className="trip-current-sub">{formatDuration(elapsedS)}</span>
                </div>
                <div className="trip-stats-row">
                  <div className="trip-stat-cell">
                    <span className="trip-stat-label">Max</span>
                    <span className="trip-stat-val">{formatSpd(trackMaxSpeed, speedUnit)}</span>
                  </div>
                  <div className="trip-stat-cell">
                    <span className="trip-stat-label">Snitt</span>
                    <span className="trip-stat-val">{formatSpd(avgSpeedMs, speedUnit)}</span>
                  </div>
                </div>
                <div className="trip-current-btns">
                  <button className="trip-btn trip-btn-stop" onClick={stopAndSave}>
                    <Square size={15} /> Stopp og lagre
                  </button>
                  <button className="trip-btn trip-btn-discard" onClick={() => setConfirmDiscard(true)} disabled={track.length === 0}>
                    <Trash2 size={15} /> Forkast
                  </button>
                </div>
              </>
            ) : (
              <button className="trip-btn trip-btn-start" onClick={startTracking}>
                <Circle size={15} /> Start ny tur
              </button>
            )}
          </div>

          {/* Saved trips */}
          <div className="spot-section-head">Lagrede turer{savedTracks.length ? ` (${savedTracks.length})` : ''}</div>
          {savedTracks.length === 0 && (
            <div className="spot-panel-empty">Ingen lagrede turer ennå</div>
          )}
          {savedTracks.map((t) => (
            <div key={t.id} className="saved-track-row">
              <div className="saved-track-info">
                <span className="saved-track-name">{iconEmoji(t.icon)} {t.name}</span>
                <span className="saved-track-meta">
                  {formatDist(t.distanceM, distUnit)} · {new Date(t.date).toLocaleDateString('no-NO')}
                  {t.durationS != null && ` · ${formatDuration(t.durationS)}`}
                </span>
                {(t.maxSpeedMs != null || t.avgSpeedMs != null) && (
                  <span className="saved-track-speeds">
                    {t.maxSpeedMs != null && `Max ${formatSpd(t.maxSpeedMs, speedUnit)}`}
                    {t.maxSpeedMs != null && t.avgSpeedMs != null && '  ·  '}
                    {t.avgSpeedMs != null && `Snitt ${formatSpd(t.avgSpeedMs, speedUnit)}`}
                  </span>
                )}
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
                <button className="saved-track-btn saved-track-del" onClick={() => setConfirmId(t.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showSave && <SaveTrackDialog onClose={() => { setShowSave(false); onClose() }} />}

      {confirmDiscard && (
        <div className="dialog-overlay" onClick={() => setConfirmDiscard(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">Forkast tur</div>
            <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 16 }}>
              Forkaste denne turen ({track.length} pkt) uten å lagre?
            </p>
            <div className="dialog-actions">
              <button className="btn-secondary" onClick={() => setConfirmDiscard(false)}>Avbryt</button>
              <button className="btn-primary" style={{ background: '#dc2626' }} onClick={() => { stopTracking(); clearTrack(); setConfirmDiscard(false) }}>
                <Trash2 size={15} /> Forkast
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmId && (
        <div className="dialog-overlay" onClick={() => setConfirmId(null)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">Slett tur</div>
            <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 16 }}>
              Slette «{savedTracks.find((t) => t.id === confirmId)?.name}»?
            </p>
            <div className="dialog-actions">
              <button className="btn-secondary" onClick={() => setConfirmId(null)}>Avbryt</button>
              <button className="btn-primary" style={{ background: '#dc2626' }} onClick={() => { deleteSavedTrack(confirmId); setConfirmId(null) }}>
                <Trash2 size={15} /> Slett
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
