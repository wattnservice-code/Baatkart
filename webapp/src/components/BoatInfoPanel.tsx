import { useState } from 'react'
import { X, Save, Ship } from 'lucide-react'
import { useMapStore, type BoatInfo } from '../store/useMapStore'

interface Props { onClose: () => void }

const FIELDS: { key: keyof BoatInfo; label: string; placeholder: string; type?: string; hint?: string }[] = [
  { key: 'name',     label: 'Båtnavn',       placeholder: 'f.eks. Havørn' },
  { key: 'boatType', label: 'Type',          placeholder: 'f.eks. Aquador 28 HT' },
  { key: 'mmsi',     label: 'MMSI-nummer',   placeholder: '9 siffer (VHF/AIS)', type: 'tel',
    hint: 'Maritime Mobile Service Identity' },
  { key: 'phone',    label: 'Mobilnummer',   placeholder: '+47 000 00 000', type: 'tel' },
  { key: 'notes',    label: 'Andre notater', placeholder: 'Kjennetegn, farge, forsikring…' },
]

export default function BoatInfoPanel({ onClose }: Props) {
  const boatInfo    = useMapStore((s) => s.boatInfo)
  const setBoatInfo = useMapStore((s) => s.setBoatInfo)

  const [draft, setDraft] = useState<BoatInfo>({ ...boatInfo })
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setBoatInfo(draft)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const hasChanges = JSON.stringify(draft) !== JSON.stringify(boatInfo)

  return (
    <div className="offline-panel">
      <div className="settings-head">
        <span className="settings-title"><Ship size={18} /> Båtinfo</span>
        <button className="settings-close" onClick={onClose}><X size={20} /></button>
      </div>
      <div className="settings-body">
      <div className="boat-info-form">
        {FIELDS.map((f) => (
          <div key={f.key} className="boat-info-field">
            <label className="boat-info-label">{f.label}</label>
            {f.hint && <div className="boat-info-hint">{f.hint}</div>}
            <input
              className="offline-name-input"
              type={f.type ?? 'text'}
              placeholder={f.placeholder}
              value={draft[f.key]}
              onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
            />
          </div>
        ))}
      </div>

      <div className="offline-actions">
        <button
          className={`offline-btn ${hasChanges ? 'offline-btn-primary' : ''}`}
          style={!hasChanges ? { background: 'rgba(255,255,255,0.07)', color: '#64748b' } : undefined}
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
      </div>{/* settings-body */}
    </div>
  )
}
