import type { SavedTrack } from './store/useMapStore'

const hm = (iso: string) => new Date(iso).toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' })
const md = (iso: string) => new Date(iso).toLocaleDateString('no-NO', { day: '2-digit', month: '2-digit' })

// Dato for turen (startdato hvis tilgjengelig, ellers lagringsdato)
export function tripDate(t: SavedTrack): string {
  return new Date(t.startedAt ?? t.date).toLocaleDateString('no-NO', {
    weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

// Start–slutt-klokkeslett. Hvis turen krysser midnatt vises sluttdato i tillegg.
export function tripTimeRange(t: SavedTrack): string {
  const { startedAt: s, endedAt: e } = t
  if (s && e) {
    const sameDay = new Date(s).toDateString() === new Date(e).toDateString()
    return sameDay ? `${hm(s)} – ${hm(e)}` : `${hm(s)} – ${md(e)} ${hm(e)}`
  }
  return hm(t.date)   // gammel tur uten tidsstempler
}
