import { useState } from 'react'
import { LogIn, LogOut, Mail, Check, Cloud } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

export default function AccountSection() {
  const { user, loading, sendCode, verifyCode, signOut } = useAuth()
  const [email, setEmail] = useState('')
  const [code, setCode]   = useState('')
  const [step, setStep]   = useState<'email' | 'code'>('email')
  const [busy, setBusy]   = useState(false)
  const [error, setError] = useState<string | null>(null)

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
        <button className="account-btn account-btn-out" onClick={() => signOut()}>
          <LogOut size={16} /> Logg ut
        </button>
      </div>
    )
  }

  const handleSend = async () => {
    if (!email.trim()) return
    setBusy(true); setError(null)
    const { error } = await sendCode(email)
    setBusy(false)
    if (error) { setError(error.message); return }
    setStep('code')
  }

  const handleVerify = async () => {
    if (!code.trim()) return
    setBusy(true); setError(null)
    const { error } = await verifyCode(email, code)
    setBusy(false)
    if (error) { setError('Feil eller utløpt kode. Prøv igjen.'); return }
    // onAuthStateChange oppdaterer user → komponenten viser innlogget-visning
  }

  return (
    <div className="account-box">
      <div className="account-intro">
        <Cloud size={18} className="account-cloud" />
        <span>Logg inn for å lagre turene dine i skyen og få dem på alle enheter.</span>
      </div>

      {step === 'email' ? (
        <>
          <div className="account-field">
            <Mail size={16} />
            <input
              className="account-input"
              type="email" inputMode="email" autoComplete="email"
              placeholder="din@epost.no"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            />
          </div>
          <button className="account-btn account-btn-in" onClick={handleSend} disabled={busy || !email.trim()}>
            <LogIn size={16} /> {busy ? 'Sender…' : 'Send kode på e-post'}
          </button>
        </>
      ) : (
        <>
          <div className="account-field">
            <Check size={16} />
            <input
              className="account-input"
              type="text" inputMode="numeric" autoComplete="one-time-code"
              placeholder="6-sifret kode"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
              autoFocus
            />
          </div>
          <button className="account-btn account-btn-in" onClick={handleVerify} disabled={busy || !code.trim()}>
            <Check size={16} /> {busy ? 'Sjekker…' : 'Logg inn'}
          </button>
          <button className="account-btn account-btn-ghost" onClick={() => { setStep('email'); setCode(''); setError(null) }}>
            Bruk annen e-post
          </button>
        </>
      )}

      {error && <div className="account-error">{error}</div>}
    </div>
  )
}
