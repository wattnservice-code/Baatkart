import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../supabase'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  // E-post med engangskode (OTP): send kode → verifiser kode.
  const sendCode = (email: string) =>
    supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    })

  const verifyCode = (email: string, token: string) =>
    supabase.auth.verifyOtp({ email: email.trim(), token: token.trim(), type: 'email' })

  const signOut = () => supabase.auth.signOut()

  return { user, loading, sendCode, verifyCode, signOut }
}
