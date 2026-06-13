import { useState } from 'react'
import { Save, Trash2 } from 'lucide-react'
import { useMapStore } from '../store/useMapStore'

interface Props { onClose: () => void }

export default function SaveTrackDialog({ onClose }: Props) {
  const track            = useMapStore((s) => s.track)
  const saveCurrentTrack = useMapStore((s) => s.saveCurrentTrack)
  const clearTrack       = useMapStore((s) => s.clearTrack)

  const [name, setName] = useState('')

  const handleSave = () => {
    // The date is stored as metadata regardless; fall back to it if no name given
    const fallback = new Date().toLocaleDateString('no-NO', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })
    saveCurrentTrack(name.trim() || fallback)
    clearTrack()
    onClose()
  }

  return (
    <div className="dialog-overlay">
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">Lagre tur?</div>
        <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 12 }}>
          {track.length} GPS-punkter registrert. Gi turen et navn:
        </p>
        <input
          className="dialog-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Navn på tur"
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
        />
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
