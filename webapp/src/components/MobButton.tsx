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

  // Only show on the map view, and only while idle — once MOB is triggered the
  // alarm overlay takes over as the indicator, so the trigger button hides.
  if (activePanel || mobPoint) return null

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
