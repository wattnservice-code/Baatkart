import { supabase } from '../supabase'
import type { SavedTrack } from '../store/useMapStore'

// Map mellom lokal SavedTrack og rad i public.trips
function toRow(t: SavedTrack, userId: string) {
  return {
    id: t.id,
    user_id: userId,
    name: t.name,
    trip_date: t.date,
    distance_m: t.distanceM,
    duration_s: t.durationS ?? 0,
    avg_speed_ms: t.avgSpeedMs ?? 0,
    max_speed_ms: t.maxSpeedMs ?? 0,
    icon: t.icon ?? null,
    points: t.points,
  }
}

type Row = {
  id: string; name: string; trip_date: string; distance_m: number
  duration_s: number; avg_speed_ms: number; max_speed_ms: number
  icon: string | null; points: { lat: number; lng: number }[]
}

function fromRow(r: Row): SavedTrack {
  return {
    id: r.id,
    name: r.name,
    date: r.trip_date,
    points: r.points ?? [],
    distanceM: r.distance_m,
    durationS: r.duration_s,
    avgSpeedMs: r.avg_speed_ms,
    maxSpeedMs: r.max_speed_ms,
    icon: r.icon ?? undefined,
  }
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id ?? null
}

// Skriv (eller oppdater) én tur til skyen. Stille no-op om ikke innlogget.
export async function pushTrip(t: SavedTrack): Promise<void> {
  const uid = await currentUserId()
  if (!uid) return
  const { error } = await supabase.from('trips').upsert(toRow(t, uid))
  if (error) console.warn('Tur-sync (push) feilet:', error.message)
}

export async function deleteTripRemote(id: string): Promise<void> {
  const uid = await currentUserId()
  if (!uid) return
  const { error } = await supabase.from('trips').delete().eq('id', id)
  if (error) console.warn('Tur-sync (slett) feilet:', error.message)
}

// Hent alle turer for innlogget bruker.
export async function fetchTrips(): Promise<SavedTrack[]> {
  const uid = await currentUserId()
  if (!uid) return []
  const { data, error } = await supabase
    .from('trips').select('*').order('trip_date', { ascending: false })
  if (error) { console.warn('Tur-sync (hent) feilet:', error.message); return [] }
  return (data as Row[]).map(fromRow)
}

// Last opp lokale turer som ennå ikke finnes i skyen.
export async function pushMissing(local: SavedTrack[], remoteIds: Set<string>): Promise<void> {
  const uid = await currentUserId()
  if (!uid) return
  const missing = local.filter((t) => !remoteIds.has(t.id))
  if (missing.length === 0) return
  const { error } = await supabase.from('trips').upsert(missing.map((t) => toRow(t, uid)))
  if (error) console.warn('Tur-sync (opplasting) feilet:', error.message)
}
