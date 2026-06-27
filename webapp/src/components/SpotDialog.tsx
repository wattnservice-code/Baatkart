import { useState } from 'react'
import { MapPin, X, Check } from 'lucide-react'
import { useMapStore } from '../store/useMapStore'
import IconPicker from './IconPicker'
import { DEFAULT_SPOT_ICON } from '../spotIcons'

interface Props {
  lat: number
  lng: number
  onClose: () => void
}

export default function SpotDialog({ lat, lng, onClose }: Props) {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState(DEFAULT_SPOT_ICON)
  const addSpot = useMapStore((s) => s.addSpot)

  const save = () => {
    if (!name.trim()) return
    addSpot({ id: `${Date.now()}`, lat, lng, name: name.trim(), icon })
    navigator.vibrate?.(50)
    onClose()
  }

  return (
    <div className="dialog-overlay">
      <div className="dialog">
        <div className="dialog-header">
          <MapPin size={20} className="text-blue-400" />
          <span>Nytt lagret sted</span>
          <button onClick={onClose} className="ml-auto"><X size={20} /></button>
        </div>
        <input
          autoFocus
          className="dialog-input"
          placeholder="Navn på sted..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
        />
        <IconPicker value={icon} onChange={setIcon} />
        <div className="dialog-coords">{lat.toFixed(5)}, {lng.toFixed(5)}</div>
        <div className="dialog-actions">
          <button className="btn-secondary" onClick={onClose}>Avbryt</button>
          <button className="btn-primary" onClick={save} disabled={!name.trim()}>
            <Check size={16} /> Lagre
          </button>
        </div>
      </div>
    </div>
  )
}
