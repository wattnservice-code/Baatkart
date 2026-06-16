import { X, Navigation, Trash2 } from 'lucide-react'
import { useMapStore } from '../store/useMapStore'
import { formatDist } from './NavOverlay'
import { useSwipeDismiss } from '../hooks/useSwipeDismiss'
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
    <div className="quickpin-row-lg">
      <span className="quickpin-num-lg">{idx + 1}</span>
      <button className="quickpin-info-lg" onClick={onFly}>
        <span className="quickpin-label-lg">{pin.label}</span>
        {dist !== null && (
          <span className="quickpin-dist-lg">{formatDist(dist, distUnit as 'nm'|'m'|'km')} · {Math.round(brg!)}°</span>
        )}
      </button>
      <button className="quickpin-nav-btn-lg" onClick={onNav} title="Navigér hit">
        <Navigation size={20} />
      </button>
      <button className="quickpin-del-btn-lg" onClick={onRemove} title="Fjern merke">
        <X size={20} />
      </button>
    </div>
  )
}

export default function QuickPinBar({ onClose }: { onClose: () => void }) {
  const quickPins      = useMapStore((s) => s.quickPins)
  const position       = useMapStore((s) => s.position)
  const distUnit       = useMapStore((s) => s.distUnit)
  const removeQuickPin = useMapStore((s) => s.removeQuickPin)
  const clearQuickPins = useMapStore((s) => s.clearQuickPins)
  const setNavTarget   = useMapStore((s) => s.setNavTarget)
  const setFlyTo       = useMapStore((s) => s.setFlyTo)
  const swipe          = useSwipeDismiss(onClose)

  const withDist = quickPins.map((p) => ({
    pin: p,
    dist: position ? haversineM(position.lat, position.lng, p.lat, p.lng) : null,
    brg:  position ? bearingDeg(position.lat, position.lng, p.lat, p.lng) : null,
  })).sort((a, b) => (a.dist ?? 0) - (b.dist ?? 0))

  return (
    <div className="offline-panel">
      <div className="settings-head" {...swipe}>
        <span className="settings-title">⊕ Merker {quickPins.length > 0 && `(${quickPins.length})`}</span>
        <button className="settings-close" onClick={onClose}><X size={20} /></button>
      </div>
      <div className="settings-body">
        {quickPins.length === 0 ? (
          <div className="quickpin-empty">Ingen merker. Trykk ⊕-knappen på kartet for å merke et sted.</div>
        ) : (
          <>
            <button className="quickpin-clear-all-lg" onClick={clearQuickPins}>
              <Trash2 size={16} /> Fjern alle merker
            </button>
            <div className="quickpin-list-lg">
              {withDist.map(({ pin, dist, brg }) => (
                <PinRow
                  key={pin.id}
                  pin={pin}
                  idx={quickPins.indexOf(pin)}
                  dist={dist}
                  brg={brg}
                  distUnit={distUnit}
                  onNav={() => { setNavTarget({ lat: pin.lat, lng: pin.lng, name: `Merke ${pin.label}` }); removeQuickPin(pin.id); onClose() }}
                  onRemove={() => removeQuickPin(pin.id)}
                  onFly={() => { setFlyTo({ lat: pin.lat, lng: pin.lng }); onClose() }}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
