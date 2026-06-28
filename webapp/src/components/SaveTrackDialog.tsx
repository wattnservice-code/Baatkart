import { useState } from 'react'
import { Save, Trash2, Play } from 'lucide-react'
import { useMapStore } from '../store/useMapStore'
import { formatDist } from './NavOverlay'
import IconPicker from './IconPicker'
import { DEFAULT_SPOT_ICON } from '../spotIcons'
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
  return unit === 'kn' ? `${(ms * 1.94384).toFixed(1)} kn` : `${(ms * 3.6).toFixed(1)} km/t`
}

export default function SaveTrackDialog({ onClose }: Props) {
  const track            = useMapStore((s) => s.track)
  const saveCurrentTrack = useMapStore((s) => s.saveCurrentTrack)
  const clearTrack       = useMapStore((s) => s.clearTrack)
  const resumeTracking   = useMapStore((s) => s.resumeTracking)
  const trackDistanceM   = useMapStore((s) => s.trackDistanceM)
  const trackMaxSpeed    = useMapStore((s) => s.trackMaxSpeed)
  const distUnit         = useMapStore((s) => s.distUnit)
  const speedUnit        = useMapStore((s) => s.speedUnit)

  const [name, setName] = useState('')
  const [icon, setIcon] = useState(DEFAULT_SPOT_ICON)

  const durationS  = track.length > 1 ? (track[track.length - 1].timestamp - track[0].timestamp) / 1000 : 0
  const avgSpeedMs = durationS > 0 ? trackDistanceM / durationS : 0

  const handleSave = () => {
    const fallback = new Date().toLocaleDateString('no-NO', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })
    saveCurrentTrack(name.trim() || fallback, icon)
    clearTrack()
    onClose()
  }

  return (
    <div className="dialog-overlay">
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">Lagre tur?</div>

        <div className="tracksave-stats">
          <div className="tracksave-stat">
            <span className="tracksave-stat-label">Distanse</span>
            <span className="tracksave-stat-val">{formatDist(trackDistanceM, distUnit)}</span>
          </div>
          <div className="tracksave-stat">
            <span className="tracksave-stat-label">Tid</span>
            <span className="tracksave-stat-val">{formatDuration(durationS)}</span>
          </div>
          <div className="tracksave-stat">
            <span className="tracksave-stat-label">Snitt</span>
            <span className="tracksave-stat-val">{formatSpd(avgSpeedMs, speedUnit)}</span>
          </div>
          <div className="tracksave-stat">
            <span className="tracksave-stat-label">Maks</span>
            <span className="tracksave-stat-val">{formatSpd(trackMaxSpeed, speedUnit)}</span>
          </div>
        </div>

        <input
          className="dialog-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Navn på tur"
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
        />
        <IconPicker value={icon} onChange={setIcon} />

        <button className="tracksave-resume" onClick={() => { resumeTracking(); onClose() }}>
          <Play size={15} /> Fortsett opptak
        </button>
        <div className="dialog-actions">
          <button className="btn-secondary" onClick={() => { clearTrack(); onClose() }}>
            <Trash2 size={15} /> Forkast
          </button>
          <button className="btn-primary" onClick={handleSave}>
            <Save size={15} /> Lagre
          </button>
        </div>
      </div>
    </div>
  )
}
