import { useState } from 'react'
import { LogIn, LogOut, Mail, Lock, Cloud, UserPlus, RefreshCw } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useMapStore } from '../store/useMapStore'
import { syncNow } from '../sync/tripSync'

export default function AccountSection() {
  const { user, loading, signIn, signUp, signOut } = useAuth()
  const syncStatus  = useMapStore((s) => s.syncStatus)
  const syncMessage = useMapStore((s) => s.syncMessage)
  const [email, setEmail]     = useState('')
  const [password, setPass]   = useState('')
  const [mode, setMode]       = useState<'login' | 'signup'>('login')
  const [busy, setBusy]       = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [info, setInfo]       = useState<string | null>(null)

  if (loading) return null

  if (user) {
    return (
      <div className="account-box">
        <div className="account-status">
          <Cloud size={18} className="account-cloud" />
          <div className="account-status-text">
            <span className="account-email">{user.email}</span>
            <span className="account-sub">Turer synkes automatisk</span>
          </div>
        </div>
        {syncMessage && (
          <div className={`account-sync account-sync-${syncStatus}`}>{syncMessage}</div>
        )}
        <button className="account-btn account-btn-sync" onClick={() => syncNow()} disabled={syncStatus === 'syncing'}>
          <RefreshCw size={16} /> {syncStatus === 'syncing' ? 'Synker…' : 'Synk nå'}
        </button>
        <button className="account-btn account-btn-out" onClick={() => signOut()}>
          <LogOut size={16} /> Logg ut
        </button>
      </div>
    )
  }

  const submit = async () => {
    if (!email.trim() || password.length < 6) {
      setError('Skriv e-post og passord (minst 6 tegn).')
      return
    }
    setBusy(true); setError(null); setInfo(null)
    const fn = mode === 'login' ? signIn : signUp
    const { data, error } = await fn(email, password)
    setBusy(false)
    if (error) {
      setError(mode === 'login'
        ? 'Feil e-post eller passord.'
        : error.message)
      return
    }
    // Hvis e-postbekreftelse er på, finnes ingen sesjon ennå
    if (mode === 'signup' && !data.session) {
      setInfo('Konto opprettet. Bekreft e-posten din, så kan du logge inn.')
      setMode('login')
    }
    // ellers oppdaterer onAuthStateChange user → innlogget-visning
  }

  return (
    <div className="account-box">
      <div className="account-intro">
        <Cloud size={18} className="account-cloud" />
        <span>{mode === 'login'
          ? 'Logg inn for å lagre turene dine i skyen og få dem på alle enheter.'
          : 'Opprett konto for å synke turene dine på tvers av enheter.'}</span>
      </div>

      <div className="account-field">
        <Mail size={16} />
        <input
          className="account-input"
          type="email" inputMode="email" autoComplete="email"
          placeholder="din@epost.no"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="account-field">
        <Lock size={16} />
        <input
          className="account-input"
          type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          placeholder="Passord (minst 6 tegn)"
          value={password}
          onChange={(e) => setPass(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
      </div>

      <button className="account-btn account-btn-in" onClick={submit} disabled={busy}>
        {mode === 'login'
          ? <><LogIn size={16} /> {busy ? 'Logger inn…' : 'Logg inn'}</>
          : <><UserPlus size={16} /> {busy ? 'Oppretter…' : 'Opprett konto'}</>}
      </button>

      <button
        className="account-btn account-btn-ghost"
        onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null); setInfo(null) }}
      >
        {mode === 'login' ? 'Ny? Opprett konto' : 'Har konto? Logg inn'}
      </button>

      {error && <div className="account-error">{error}</div>}
      {info  && <div className="account-info">{info}</div>}
    </div>
  )
}
