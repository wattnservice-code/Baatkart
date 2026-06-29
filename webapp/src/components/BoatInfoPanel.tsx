import { useState, useEffect } from 'react'
import { X, Save, Ship } from 'lucide-react'
import { useMapStore, type BoatInfo } from '../store/useMapStore'
import { pushBoat, fetchBoat } from '../sync/boatSync'

interface Props { onClose: () => void }

type Field = { key: keyof BoatInfo; label: string; placeholder: string; type?: string; hint?: string }

const GROUPS: { title: string; fields: Field[] }[] = [
  { title: 'Eier', fields: [
    { key: 'ownerName', label: 'Eier (navn)', placeholder: 'f.eks. Frode', hint: 'Brukes til personlig tiltale i e-post og rapporter' },
  ]},
  { title: 'Båt', fields: [
    { key: 'name',     label: 'Båtnavn', placeholder: 'f.eks. Havørn' },
    { key: 'boatType', label: 'Type',    placeholder: 'f.eks. Aquador 28 HT' },
  ]},
  { title: 'Mål', fields: [
    { key: 'lengthM',  label: 'Lengde (m)',  placeholder: 'f.eks. 8.5', type: 'number' },
    { key: 'beamM',    label: 'Bredde (m)',  placeholder: 'f.eks. 2.9', type: 'number' },
    { key: 'draughtM', label: 'Dypgang (m)', placeholder: 'f.eks. 0.9', type: 'number' },
  ]},
  { title: 'Motor og drivstoff', fields: [
    { key: 'engine',        label: 'Motor', placeholder: 'f.eks. Volvo Penta D4 260 hk' },
    { key: 'fuelConsLph',   label: 'Forbruk (liter/time)', placeholder: 'f.eks. 18', type: 'number', hint: 'Ved marsjfart – brukes til drivstoff-/kostnadsestimat' },
    { key: 'cruiseSpeedKn', label: 'Marsjfart (knop)', placeholder: 'f.eks. 22', type: 'number' },
  ]},
  { title: 'Kontakt', fields: [
    { key: 'mmsi',     label: 'MMSI-nummer', placeholder: '9 siffer (VHF/AIS)', type: 'tel', hint: 'Maritime Mobile Service Identity' },
    { key: 'callSign', label: 'Kallesignal', placeholder: 'f.eks. LK1234' },
    { key: 'phone',    label: 'Mobilnummer', placeholder: '+47 000 00 000', type: 'tel' },
  ]},
  { title: 'Annet', fields: [
    { key: 'notes', label: 'Notater', placeholder: 'Kjennetegn, farge, forsikring…' },
  ]},
]

const FUEL_OPTIONS = ['', 'diesel', 'bensin', 'el', 'hybrid']

export default function BoatInfoPanel({ onClose }: Props) {
  const boatInfo    = useMapStore((s) => s.boatInfo)
  const setBoatInfo = useMapStore((s) => s.setBoatInfo)

  const [draft, setDraft] = useState<BoatInfo>({ ...boatInfo })
  const [saved, setSaved] = useState(false)

  // Hent fra sky ved åpning (om innlogget) og flett inn
  useEffect(() => {
    fetchBoat().then((cloud) => {
      if (cloud) { setDraft((d) => ({ ...d, ...cloud })); setBoatInfo(cloud) }
    })
  }, [setBoatInfo])

  const handleSave = () => {
    setBoatInfo(draft)
    void pushBoat(draft)   // sky om innlogget; ellers no-op
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const hasChanges = JSON.stringify(draft) !== JSON.stringify(boatInfo)
  const set = (key: keyof BoatInfo, val: string) => setDraft((d) => ({ ...d, [key]: val }))

  return (
    <div className="offline-panel">
      <div className="settings-head">
        <span className="settings-title"><Ship size={18} /> Båtinfo</span>
        <button className="settings-close" onClick={onClose}><X size={20} /></button>
      </div>
      <div className="settings-body">
        <div className="boat-info-form">
          {GROUPS.map((g) => (
            <div key={g.title}>
              <div className="offline-section-label" style={{ marginTop: 10 }}>{g.title}</div>
              {g.fields.map((f) => (
                <div key={f.key} className="boat-info-field">
                  <label className="boat-info-label">{f.label}</label>
                  {f.hint && <div className="boat-info-hint">{f.hint}</div>}
                  <input
                    className="offline-name-input"
                    type={f.type ?? 'text'}
                    inputMode={f.type === 'number' ? 'decimal' : undefined}
                    placeholder={f.placeholder}
                    value={draft[f.key]}
                    onChange={(e) => set(f.key, e.target.value)}
                  />
                </div>
              ))}
              {g.title === 'Motor og drivstoff' && (
                <div className="boat-info-field">
                  <label className="boat-info-label">Drivstofftype</label>
                  <select className="offline-name-input" value={draft.fuelType} onChange={(e) => set('fuelType', e.target.value)}>
                    {FUEL_OPTIONS.map((o) => <option key={o} value={o}>{o === '' ? 'Velg…' : o}</option>)}
                  </select>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="offline-actions">
          <button
            className={`offline-btn ${hasChanges ? 'offline-btn-primary' : ''}`}
            style={!hasChanges ? { background: 'rgba(255,255,255,0.07)', color: '#94a3b8' } : undefined}
            onClick={handleSave}
            disabled={!hasChanges && !saved}
          >
            <Save size={16} />
            {saved ? 'Lagret!' : 'Lagre'}
          </button>
        </div>

        {(boatInfo.name || boatInfo.mmsi) && (
          <div className="boat-info-preview">
            <div className="offline-section-label">Vises i MOB-nødmelding</div>
            <div className="boat-info-preview-text">
              {boatInfo.name && <span>Båt: {boatInfo.name}</span>}
              {boatInfo.boatType && <span>{boatInfo.boatType}</span>}
              {boatInfo.mmsi && <span>MMSI: {boatInfo.mmsi}</span>}
              {boatInfo.phone && <span>Tlf: {boatInfo.phone}</span>}
              <span style={{ color: '#4ade80' }}>Posisjon: hentes automatisk fra GPS ved MOB</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
