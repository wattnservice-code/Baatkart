import { useMapStore } from '../store/useMapStore'

export default function MobButton() {
  const mobPoint    = useMapStore((s) => s.mobPoint)
  const position    = useMapStore((s) => s.position)
  const setMob      = useMapStore((s) => s.setMob)
  const activePanel = useMapStore((s) => s.activePanel)

  const handleMob = () => {
    if (mobPoint || !position) return
    navigator.vibrate?.([200, 100, 200, 100, 400])
    setMob({ lat: position.lat, lng: position.lng })
  }

  // Only show on the map view — hide while a panel (Naviger/Steder/Meg) is open
  if (activePanel) return null

  return (
    <button
      className={`mob-btn ${mobPoint ? 'mob-btn-active' : ''}`}
      onClick={handleMob}
      title="Mann over bord"
      disabled={!!mobPoint}
    >
      MOB
    </button>
  )
}
