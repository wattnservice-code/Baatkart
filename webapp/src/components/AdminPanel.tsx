import { useEffect, useState, useCallback } from 'react'
import { X, UserPlus, UserMinus, RefreshCw, ShieldCheck } from 'lucide-react'
import { useSwipeDismiss } from '../hooks/useSwipeDismiss'
import { supabase } from '../supabase'

interface Props { onClose: () => void }

interface AccessRow {
  email: string
  feature_key: string
  active: boolean
  source: string
  valid_until: string | null
  updated_at: string
}

export default function AdminPanel({ onClose }: Props) {
  const swipe = useSwipeDismiss(onClose)
  const [email, setEmail]   = useState('')
  const [days, setDays]     = useState('')   // tomt = evig
  const [busy, setBusy]     = useState(false)
  const [msg, setMsg]       = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [rows, setRows]     = useState<AccessRow[]>([])

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('admin_list_access')
    if (!error && data) setRows(data as AccessRow[])
  }, [])

  useEffect(() => { void load() }, [load])

  const grant = async () => {
    if (!email.trim()) return
    setBusy(true); setMsg(null)
    const valid_until = days.trim()
      ? new Date(Date.now() + Number(days) * 86400000).toISOString()
      : null
    const { error } = await supabase.rpc('admin_grant_access', {
      p_email: email.trim(), p_feature: 'premium', p_valid_until: valid_until,
    })
    setBusy(false)
    if (error) { setMsg({ kind: 'err', text: error.message }); return }
    setMsg({ kind: 'ok', text: `Gratis tilgang gitt til ${email.trim()}` })
    setEmail(''); setDays(''); void load()
  }

  const revoke = async (mail: string) => {
    setBusy(true); setMsg(null)
    const { error } = await supabase.rpc('admin_revoke_access', { p_email: mail, p_feature: 'premium' })
    setBusy(false)
    if (error) { setMsg({ kind: 'err', text: error.message }); return }
    setMsg({ kind: 'ok', text: `Tilgang fjernet for ${mail}` })
    void load()
  }

  return (
    <div className="settings-sheet">
      <div className="settings-head" {...swipe}>
        <span className="settings-title"><ShieldCheck size={18} /> Admin</span>
        <button className="settings-close" onClick={onClose}><X size={20} /></button>
      </div>

      <div className="settings-body">
        <div style={{ padding: '4px 16px' }}>
          <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 12 }}>
            Gi gratis tilgang (premium) til en bruker via e-post. La «dager» stå tomt for evig.
          </div>
          <div className="admin-field">
            <input className="admin-input" type="email" inputMode="email" placeholder="bruker@epost.no"
              value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="admin-field">
            <input className="admin-input" type="number" inputMode="numeric" placeholder="Dager (tomt = evig)"
              value={days} onChange={(e) => setDays(e.target.value)} />
          </div>
          <button className="admin-btn admin-btn-grant" onClick={grant} disabled={busy || !email.trim()}>
            <UserPlus size={18} /> {busy ? 'Jobber…' : 'Gi gratis tilgang'}
          </button>
          {msg && <div className={msg.kind === 'ok' ? 'admin-ok' : 'admin-err'}>{msg.text}</div>}
        </div>

        <div className="menu-divider" />
        <div className="admin-list-head">
          <span>Tilganger ({rows.length})</span>
          <button className="admin-refresh" onClick={() => void load()}><RefreshCw size={16} /></button>
        </div>
        {rows.length === 0 && <div style={{ padding: '8px 16px', color: '#94a3b8', fontSize: 13 }}>Ingen tilganger ennå</div>}
        {rows.map((r) => (
          <div key={r.email + r.feature_key} className="admin-row">
            <div className="admin-row-info">
              <span className="admin-row-email">{r.email}</span>
              <span className="admin-row-meta">
                {r.feature_key} · {r.source} · {r.active ? 'aktiv' : 'inaktiv'}
                {r.valid_until ? ` · til ${new Date(r.valid_until).toLocaleDateString('no-NO')}` : ' · evig'}
              </span>
            </div>
            {r.active && (
              <button className="admin-row-revoke" onClick={() => revoke(r.email)} disabled={busy} title="Fjern tilgang">
                <UserMinus size={18} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
