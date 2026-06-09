import { useState } from 'react'
import { Flag } from 'lucide-react'

interface Props {
  lat: number
  lng: number
  index: number
  onSave: (name: string) => void
  onClose: () => void
}

export default function WaypointDialog({ lat, lng, index, onSave, onClose }: Props) {
  const [name, setName] = useState(`WP${index}`)

  const fmt = (n: number) => n.toFixed(5)

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <Flag size={18} style={{ color: '#a78bfa' }} />
          Legg til waypoint
        </div>
        <input
          className="dialog-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={`WP${index}`}
          autoFocus
        />
        <div className="dialog-coords">{fmt(lat)}, {fmt(lng)}</div>
        <div className="dialog-actions">
          <button className="btn-secondary" onClick={onClose}>Avbryt</button>
          <button
            className="btn-primary"
            style={{ background: '#7c3aed' }}
            onClick={() => onSave(name.trim() || `WP${index}`)}
          >
            <Flag size={15} /> Legg til
          </button>
        </div>
      </div>
    </div>
  )
}
