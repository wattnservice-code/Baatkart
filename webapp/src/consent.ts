import { supabase } from './supabase'

// Bump denne når bruksvilkårene endres vesentlig → brukeren må godta på nytt.
export const TOS_VERSION = '2026-06-29'

const KEY = 'tosAcceptance'

export interface TosAcceptance { version: string; acceptedAt: string; termsHash?: string }

export function getAcceptance(): TosAcceptance | null {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null') } catch { return null }
}

export function isCurrentAccepted(): boolean {
  return getAcceptance()?.version === TOS_VERSION
}

// SHA-256 av den eksakte vilkårsteksten brukeren så → bevis på *hva* som ble godtatt.
async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

// Best-effort logging til Supabase (bevis på samtykke for innloggede brukere).
async function logToServer(acc: TosAcceptance): Promise<void> {
  const { data } = await supabase.auth.getSession()
  const uid = data.session?.user.id
  if (!uid) return
  await supabase.from('tos_acceptances').upsert(
    { user_id: uid, version: acc.version, accepted_at: acc.acceptedAt, terms_hash: acc.termsHash ?? null },
    { onConflict: 'user_id,version', ignoreDuplicates: true },
  ).then(() => {}, () => {})
}

export async function recordAcceptance(termsText: string): Promise<TosAcceptance> {
  const acc: TosAcceptance = {
    version: TOS_VERSION,
    acceptedAt: new Date().toISOString(),
    termsHash: await sha256(termsText),
  }
  localStorage.setItem(KEY, JSON.stringify(acc))
  void logToServer(acc)
  return acc
}

// Kalles ved innlogging: logg lokal aksept til server (idempotent).
export async function syncAcceptanceOnLogin(): Promise<void> {
  const acc = getAcceptance()
  if (acc) await logToServer(acc)
}
