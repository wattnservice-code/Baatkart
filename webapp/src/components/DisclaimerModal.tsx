import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'

const KEY = 'disclaimerAccepted'

export default function DisclaimerModal() {
  const [accepted, setAccepted] = useState(() => localStorage.getItem(KEY) === '1')

  if (accepted) return null

  const accept = () => {
    localStorage.setItem(KEY, '1')
    setAccepted(true)
  }

  return (
    <div className="dialog-overlay disclaimer-overlay">
      <div className="dialog disclaimer-dialog">
        <div className="dialog-header">
          <AlertTriangle size={20} color="#f59e0b" />
          Viktig informasjon
        </div>

        <p className="disclaimer-text">
          Batkart bruker <strong>OpenSeaMap</strong>-kart som er community-vedlikeholdt
          og ikke offisielt godkjent for navigasjon.
        </p>
        <p className="disclaimer-text">
          Appen skal <strong>ikke brukes som eneste navigasjonsmiddel.</strong>{' '}
          Følg alltid offisielle sjøkart, sett deg inn i lokale farleder og
          overhold gjeldende sjøveisregler.
        </p>
        <p className="disclaimer-text disclaimer-small">
          Utvikleren fraskriver seg ansvar for feil i kartdata eller konsekvenser
          av navigasjonsbeslutninger tatt på grunnlag av denne appen.
        </p>

        <button className="disclaimer-accept" onClick={accept}>
          Jeg forstår og godtar
        </button>
      </div>
    </div>
  )
}
