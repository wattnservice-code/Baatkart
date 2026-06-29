import { useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { isCurrentAccepted, recordAcceptance } from '../consent'
import terms from '../content/bruksvilkar.md?raw'

export default function DisclaimerModal() {
  const [accepted, setAccepted] = useState(isCurrentAccepted)
  const [showTerms, setShowTerms] = useState(false)

  if (accepted) return null

  const accept = () => {
    recordAcceptance()   // lagrer versjon + tidsstempel (lokalt + sky om innlogget)
    setAccepted(true)
  }

  return (
    <div className="dialog-overlay disclaimer-overlay">
      <div className="dialog disclaimer-dialog">
        <div className="dialog-header">
          <AlertTriangle size={20} color="#f59e0b" />
          Bruksvilkår
        </div>

        <p className="disclaimer-text">
          Batkart er et <strong>hjelpemiddel</strong> og bruker OpenSeaMap-kart som
          ikke er offisielt godkjent for navigasjon.
        </p>
        <p className="disclaimer-text">
          Appen skal <strong>ikke brukes som eneste navigasjonsmiddel.</strong>{' '}
          Du er selv ansvarlig for fartøyet, sikkerheten og egne
          navigasjonsbeslutninger. Følg alltid offisielle sjøkart og sjøveisreglene.
        </p>
        <p className="disclaimer-text disclaimer-small">
          Så langt loven tillater fraskriver utvikleren seg ansvar for tap eller skade
          som følge av bruk av appen.
        </p>

        <button className="disclaimer-terms-toggle" onClick={() => setShowTerms((v) => !v)}>
          {showTerms ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          {showTerms ? 'Skjul fullstendige bruksvilkår' : 'Les fullstendige bruksvilkår'}
        </button>
        {showTerms && (
          <div className="disclaimer-terms info-md">
            <ReactMarkdown>{terms}</ReactMarkdown>
          </div>
        )}

        <button className="disclaimer-accept" onClick={accept}>
          Jeg har lest og godtar bruksvilkårene
        </button>
      </div>
    </div>
  )
}
