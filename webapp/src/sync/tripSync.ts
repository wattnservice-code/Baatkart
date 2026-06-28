import { supabase } from '../supabase'
import { useMapStore } from '../store/useMapStore'
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
    started_at: t.startedAt ?? null,
    ended_at: t.endedAt ?? null,
    icon: t.icon ?? null,
    points: t.points,
  }
}

type Row = {
  id: string; name: string; trip_date: string; distance_m: number
  duration_s: number; avg_speed_ms: number; max_speed_ms: number
  started_at: string | null; ended_at: string | null
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
    startedAt: r.started_at ?? undefined,
    endedAt: r.ended_at ?? undefined,
    icon: r.icon ?? undefined,
  }
}

function report(status: 'idle' | 'syncing' | 'ok' | 'error', message?: string) {
  useMapStore.getState().setSyncState(status, message)
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id ?? null
}

// Skriv (eller oppdater) én tur til skyen. Stille no-op om ikke innlogget.
export async function pushTrip(t: SavedTrack): Promise<void> {
  const uid = await currentUserId()
  if (!uid) return
  report('syncing', 'Lagrer tur i skyen…')
  const { error } = await supabase.from('trips').upsert(toRow(t, uid))
  if (error) { report('error', `Sky-lagring feilet: ${error.message}`); console.warn(error) }
  else report('ok', 'Tur lagret i skyen ✓')
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
  if (error) { report('error', `Henting feilet: ${error.message}`); return [] }
  return (data as Row[]).map(fromRow)
}

// Last opp lokale turer som ennå ikke finnes i skyen.
export async function pushMissing(local: SavedTrack[], remoteIds: Set<string>): Promise<void> {
  const uid = await currentUserId()
  if (!uid) return
  const missing = local.filter((t) => !remoteIds.has(t.id))
  if (missing.length === 0) return
  const { error } = await supabase.from('trips').upsert(missing.map((t) => toRow(t, uid)))
  if (error) report('error', `Opplasting feilet: ${error.message}`)
  else report('ok', `Lastet opp ${missing.length} tur${missing.length > 1 ? 'er' : ''} ✓`)
}

// Full synk: hent sky → flett → last opp lokale som mangler. Brukes av "Synk nå".
export async function syncNow(): Promise<void> {
  const uid = await currentUserId()
  if (!uid) { report('error', 'Ikke innlogget'); return }
  report('syncing', 'Synker…')
  const remote = await fetchTrips()
  if (useMapStore.getState().syncStatus === 'error') return
  useMapStore.getState().mergeRemoteTrips(remote)
  const remoteIds = new Set(remote.map((t) => t.id))
  await pushMissing(useMapStore.getState().savedTracks, remoteIds)
  if (useMapStore.getState().syncStatus !== 'error') report('ok', 'Alt synkronisert ✓')
}
