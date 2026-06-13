// Shared category symbols for saved spots and trips. Keep the list short and
// boating-relevant — the key is stored, the emoji is rendered.
export interface SpotIconDef { key: string; emoji: string; label: string }

export const SPOT_ICONS: SpotIconDef[] = [
  { key: 'pin',    emoji: '📍', label: 'Sted' },
  { key: 'fish',   emoji: '🎣', label: 'Fiske' },
  { key: 'swim',   emoji: '🏊', label: 'Bading' },
  { key: 'anchor', emoji: '⚓', label: 'Ankring' },
  { key: 'wreck',  emoji: '🚢', label: 'Vrak' },
  { key: 'hazard', emoji: '⚠️', label: 'Fare' },
  { key: 'nature', emoji: '🏝️', label: 'Iland' },
]

export const DEFAULT_SPOT_ICON = 'pin'

export function iconEmoji(key?: string): string {
  return SPOT_ICONS.find((i) => i.key === key)?.emoji ?? '📍'
}
