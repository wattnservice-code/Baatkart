import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string

// persistSession: hold brukeren innlogget på tvers av reload (nødvendig for tursync)
export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true },
})
