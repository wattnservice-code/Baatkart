import { X, Navigation } from 'lucide-react'
import { useMapStore } from '../store/useMapStore'
import { formatDist } from './NavOverlay'

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000
  const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180
  const Δφ = (lat2 - lat1) * Math.PI / 180, Δλ = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function bearingDeg(lat1: number, lng1: number, lat2: number, lng2: number) {
  const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180
  const Δλ = (lng2 - lng1) * Math.PI / 180
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360
}

export default function QuickPinBar() {
  const quickPin      = useMapStore((s) => s.quickPin)
  const position      = useMapStore((s) => s.position)
  const distUnit      = useMapStore((s) => s.distUnit)
  const setQuickPin   = useMapStore((s) => s.setQuickPin)
  const setNavTarget  = useMapStore((s) => s.setNavTarget)
  const setFlyTo      = useMapStore((s) => s.setFlyTo)

  if (!quickPin) return null

  const dist = position ? haversineM(position.lat, position.lng, quickPin.lat, quickPin.lng) : null
  const brg  = position ? bearingDeg(position.lat, position.lng, quickPin.lat, quickPin.lng) : null

  return (
    <div className="quickpin-bar">
      <span className="quickpin-icon">⊕</span>
      <button className="quickpin-coords" onClick={() => setFlyTo({ lat: quickPin.lat, lng: quickPin.lng })}>
        {dist !== null
          ? <><b>{formatDist(dist, distUnit)}</b> · {Math.round(brg!)}°</>
          : `${quickPin.lat.toFixed(4)}° ${quickPin.lng.toFixed(4)}°`
        }
      </button>
      <button className="quickpin-nav" onClick={() => {
        setNavTarget({ lat: quickPin.lat, lng: quickPin.lng, name: 'Hurtigmerke' })
        setQuickPin(null)
      }}>
        <Navigation size={14} /> Navigér
      </button>
      <button className="quickpin-clear" onClick={() => setQuickPin(null)} title="Fjern hurtigmerke">
        <X size={16} />
      </button>
    </div>
  )
}
