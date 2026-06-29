import { supabase } from '../supabase'
import type { BoatInfo } from '../store/useMapStore'

const BOAT_ID_KEY = 'boatId'
const num = (s: string): number | null => {
  const n = parseFloat((s || '').replace(',', '.'))
  return isFinite(n) ? n : null
}
const str = (v: unknown): string => (v == null ? '' : String(v))

async function currentUid(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id ?? null
}

// Lagre båt + eiernavn til skyen (offline-first: lokalt skjer i store). No-op om ikke innlogget.
export async function pushBoat(b: BoatInfo): Promise<void> {
  const uid = await currentUid()
  if (!uid) return
  let boatId = localStorage.getItem(BOAT_ID_KEY)
  if (!boatId) { boatId = crypto.randomUUID(); localStorage.setItem(BOAT_ID_KEY, boatId) }
  await supabase.from('boats').upsert({
    id: boatId, user_id: uid,
    name: b.name || null, boat_type: b.boatType || null,
    length_m: num(b.lengthM), beam_m: num(b.beamM), draught_m: num(b.draughtM),
    engine: b.engine || null, fuel_type: b.fuelType || null,
    fuel_cons_lph: num(b.fuelConsLph), cruise_speed_kn: num(b.cruiseSpeedKn),
    mmsi: b.mmsi || null, call_sign: b.callSign || null,
    phone: b.phone || null, notes: b.notes || null,
    is_default: true, updated_at: new Date().toISOString(),
  }).then(() => {}, (e) => console.warn('Båt-sync feilet:', e))
  if (b.ownerName) {
    await supabase.from('profiles')
      .update({ display_name: b.ownerName, updated_at: new Date().toISOString() })
      .eq('id', uid).then(() => {}, () => {})
  }
}

// Hent båt + eiernavn fra skyen (ved innlogging / panel-åpning).
export async function fetchBoat(): Promise<Partial<BoatInfo> | null> {
  const uid = await currentUid()
  if (!uid) return null
  const { data: boat } = await supabase.from('boats')
    .select('*').eq('user_id', uid).eq('is_default', true).limit(1).maybeSingle()
  const { data: prof } = await supabase.from('profiles')
    .select('display_name').eq('id', uid).maybeSingle()
  if (!boat && !prof?.display_name) return null
  if (boat?.id) localStorage.setItem(BOAT_ID_KEY, boat.id)
  return {
    ownerName: str(prof?.display_name),
    name: str(boat?.name), boatType: str(boat?.boat_type),
    lengthM: str(boat?.length_m), beamM: str(boat?.beam_m), draughtM: str(boat?.draught_m),
    engine: str(boat?.engine), fuelType: str(boat?.fuel_type),
    fuelConsLph: str(boat?.fuel_cons_lph), cruiseSpeedKn: str(boat?.cruise_speed_kn),
    mmsi: str(boat?.mmsi), callSign: str(boat?.call_sign),
    phone: str(boat?.phone), notes: str(boat?.notes),
  }
}
