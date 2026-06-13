import { SPOT_ICONS } from '../spotIcons'

interface Props {
  value: string
  onChange: (key: string) => void
}

export default function IconPicker({ value, onChange }: Props) {
  return (
    <div className="icon-picker">
      {SPOT_ICONS.map((ic) => (
        <button
          key={ic.key}
          type="button"
          className={`icon-pick ${value === ic.key ? 'icon-pick-active' : ''}`}
          onClick={() => onChange(ic.key)}
          title={ic.label}
        >
          <span className="icon-pick-emoji">{ic.emoji}</span>
          <span className="icon-pick-label">{ic.label}</span>
        </button>
      ))}
    </div>
  )
}
