import { Star, Route, User } from 'lucide-react'
import { useMapStore } from '../store/useMapStore'
import { track } from '../analytics'

type Tab = 'steder' | 'turer' | 'meg'

const ITEMS: { key: Tab; label: string; Icon: typeof Star }[] = [
  { key: 'steder', label: 'Steder', Icon: Star },
  { key: 'turer',  label: 'Turer',  Icon: Route },
  { key: 'meg',    label: 'Meg',    Icon: User },
]

const PANEL = { steder: 'spots', turer: 'turer', meg: 'meg' } as const

export default function BottomNav() {
  const activePanel    = useMapStore((s) => s.activePanel)
  const setActivePanel = useMapStore((s) => s.setActivePanel)
  const isTracking     = useMapStore((s) => s.isTracking)

  const active: Tab | null =
    activePanel === 'spots' ? 'steder'
    : activePanel === 'turer' ? 'turer'
    : activePanel === 'meg' ? 'meg'
    : null

  // Trykk på fane åpner panelet; trykk på aktiv fane lukker (tilbake til kart).
  const select = (tab: Tab) => {
    if (active === tab) { setActivePanel(null); return }
    track('panel_open', { panel: tab })
    setActivePanel(PANEL[tab])
  }

  return (
    <nav className="bottom-nav">
      {ITEMS.map(({ key, label, Icon }) => (
        <button
          key={key}
          className={`bottom-nav-item ${active === key ? 'bottom-nav-item-active' : ''}`}
          onClick={() => select(key)}
        >
          <div className="bottom-nav-icon-wrap">
            <Icon size={22} />
            {key === 'turer' && isTracking && <span className="bottom-nav-rec" />}
          </div>
          <span>{label}</span>
        </button>
      ))}
    </nav>
  )
}
