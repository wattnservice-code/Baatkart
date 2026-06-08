import { useState } from 'react'
import { Anchor } from 'lucide-react'
import { useMapStore } from '../store/useMapStore'

const RADII = [20, 30, 50, 75, 100, 150, 200]

interface Props { onClose: () => void }

export default function AnchorDialog({ onClose }: Props) {
  const position    = useMapStore((s) => s.position)
  const anchorRadius = useMapStore((s) => s.anchorRadius)
  const setAnchor   = useMapStore((s) => s.setAnchor)
  const [radius, setRadius] = useState(anchorRadius)

  const confirm = () => {
    if (!position) return
    setAnchor({ lat: position.lat, lng: position.lng }, radius)
    onClose()
  }

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <Anchor size={20} color="#f59e0b" /> Sett anker
        </div>
        <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 14 }}>
          Alarm hvis båten driver mer enn:
        </p>
        <div className="anchor-radii">
          {RADII.map((r) => (
            <button
              key={r}
              className={`anchor-radius-btn ${radius === r ? 'anchor-radius-active' : ''}`}
              onClick={() => setRadius(r)}
            >
              {r} m
            </button>
          ))}
        </div>
        <div className="dialog-actions" style={{ marginTop: 16 }}>
          <button className="btn-secondary" onClick={onClose}>Avbryt</button>
          <button className="btn-primary" onClick={confirm} disabled={!position}>
            <Anchor size={15} /> Sett anker
          </button>
        </div>
      </div>
    </div>
  )
}
