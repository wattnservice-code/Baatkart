import { Map, Navigation, Star, User } from 'lucide-react'
import { useMapStore } from '../store/useMapStore'

type Tab = 'kart' | 'naviger' | 'steder' | 'meg'

const ITEMS: { key: Tab; label: string; Icon: typeof Map }[] = [
  { key: 'kart',    label: 'Kart',    Icon: Map },
  { key: 'naviger', label: 'Naviger', Icon: Navigation },
  { key: 'steder',  label: 'Steder',  Icon: Star },
  { key: 'meg',     label: 'Meg',     Icon: User },
]

export default function BottomNav() {
  const activePanel    = useMapStore((s) => s.activePanel)
  const setActivePanel = useMapStore((s) => s.setActivePanel)

  // 'kart' = no panel open; the others map 1:1 to a panel id
  const active: Tab =
    activePanel === 'search' ? 'naviger'
    : activePanel === 'spots' ? 'steder'
    : activePanel === 'meg'   ? 'meg'
    : 'kart'

  const select = (tab: Tab) => {
    setActivePanel(
      tab === 'naviger' ? 'search'
      : tab === 'steder' ? 'spots'
      : tab === 'meg'    ? 'meg'
      : null
    )
  }

  return (
    <nav className="bottom-nav">
      {ITEMS.map(({ key, label, Icon }) => (
        <button
          key={key}
          className={`bottom-nav-item ${active === key ? 'bottom-nav-item-active' : ''}`}
          onClick={() => select(key)}
        >
          <Icon size={22} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  )
}
