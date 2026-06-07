import { useState } from 'react'
import { Fish, X, Check } from 'lucide-react'
import { useMapStore } from '../store/useMapStore'

interface Props {
  lat: number
  lng: number
  onClose: () => void
}

export default function FishingSpotDialog({ lat, lng, onClose }: Props) {
  const [name, setName] = useState('')
  const addFishingSpot = useMapStore((s) => s.addFishingSpot)

  const save = () => {
    if (!name.trim()) return
    addFishingSpot({
      id: `${Date.now()}`,
      lat,
      lng,
      name: name.trim(),
    })
    onClose()
  }

  return (
    <div className="dialog-overlay">
      <div className="dialog">
        <div className="dialog-header">
          <Fish size={20} className="text-blue-400" />
          <span>Ny fiskeplass</span>
          <button onClick={onClose} className="ml-auto"><X size={20} /></button>
        </div>

        <input
          autoFocus
          className="dialog-input"
          placeholder="Navn på fiskeplass..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
        />

        <div className="dialog-coords">
          {lat.toFixed(5)}, {lng.toFixed(5)}
        </div>

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
