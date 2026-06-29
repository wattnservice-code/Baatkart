import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../supabase'

// Sjekker (server-side) om innlogget bruker er admin. Frontend-gating er kun UX –
// de faktiske admin-funksjonene håndhever is_admin selv.
export function useAdmin(user: User | null): boolean {
  const [isAdmin, setIsAdmin] = useState(false)
  useEffect(() => {
    if (!user) { setIsAdmin(false); return }
    let cancelled = false
    supabase.rpc('is_admin').then(({ data }) => {
      if (!cancelled) setIsAdmin(data === true)
    })
    return () => { cancelled = true }
  }, [user])
  return isAdmin
}
