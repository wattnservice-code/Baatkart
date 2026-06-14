import { X, Navigation, Trash2 } from 'lucide-react'
import { useMapStore } from '../store/useMapStore'
import { formatDist } from './NavOverlay'
import type { QuickPin } from '../store/useMapStore'

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

interface PinRowProps {
  pin: QuickPin
  idx: number
  dist: number | null
  brg: number | null
  distUnit: string
  onNav: () => void
  onRemove: () => void
  onFly: () => void
}

function PinRow({ pin, idx, dist, brg, distUnit, onNav, onRemove, onFly }: PinRowProps) {
  return (
    <div className="quickpin-row">
      <span className="quickpin-num">{idx + 1}</span>
      <button className="quickpin-info" onClick={onFly}>
        <span className="quickpin-label">{pin.label}</span>
        {dist !== null && (
          <span className="quickpin-dist">{formatDist(dist, distUnit as 'nm'|'m'|'km')} · {Math.round(brg!)}°</span>
        )}
      </button>
      <button className="quickpin-nav-btn" onClick={onNav} title="Navigér hit">
        <Navigation size={14} />
      </button>
      <button className="quickpin-del-btn" onClick={onRemove} title="Fjern merke">
        <X size={14} />
      </button>
    </div>
  )
}

export default function QuickPinBar() {
  const quickPins      = useMapStore((s) => s.quickPins)
  const position       = useMapStore((s) => s.position)
  const distUnit       = useMapStore((s) => s.distUnit)
  const removeQuickPin = useMapStore((s) => s.removeQuickPin)
  const clearQuickPins = useMapStore((s) => s.clearQuickPins)
  const setNavTarget   = useMapStore((s) => s.setNavTarget)
  const setFlyTo       = useMapStore((s) => s.setFlyTo)

  if (quickPins.length === 0) return null

  const withDist = quickPins.map((p) => ({
    pin: p,
    dist: position ? haversineM(position.lat, position.lng, p.lat, p.lng) : null,
    brg:  position ? bearingDeg(position.lat, position.lng, p.lat, p.lng) : null,
  })).sort((a, b) => (a.dist ?? 0) - (b.dist ?? 0))

  return (
    <div className="quickpin-bar">
      <div className="quickpin-header">
        <span className="quickpin-title">⊕ Merker</span>
        <button className="quickpin-clear-all" onClick={clearQuickPins} title="Fjern alle merker">
          <Trash2 size={13} /> Fjern alle
        </button>
      </div>
      {withDist.map(({ pin, dist, brg }) => (
        <PinRow
          key={pin.id}
          pin={pin}
          idx={quickPins.indexOf(pin)}
          dist={dist}
          brg={brg}
          distUnit={distUnit}
          onNav={() => { setNavTarget({ lat: pin.lat, lng: pin.lng, name: `Merke ${pin.label}` }); removeQuickPin(pin.id) }}
          onRemove={() => removeQuickPin(pin.id)}
          onFly={() => setFlyTo({ lat: pin.lat, lng: pin.lng })}
        />
      ))}
    </div>
  )
}
