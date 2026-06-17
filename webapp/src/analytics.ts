import { supabase } from './supabase'

const sessionId = (() => {
  let id = localStorage.getItem('bk_sid')
  if (!id) { id = crypto.randomUUID(); localStorage.setItem('bk_sid', id) }
  return id
})()

export function track(event: string, payload?: Record<string, unknown>) {
  supabase.from('events').insert({ session_id: sessionId, event, payload }).then(() => {})
}
