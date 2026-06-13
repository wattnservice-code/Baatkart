import { X, AlertTriangle } from 'lucide-react'

interface Props { onClose: () => void }

export default function InfoPanel({ onClose }: Props) {
  return (
    <div className="settings-sheet">
      <div className="settings-head">
        <span className="settings-title">Bruksanvisning og forbehold</span>
        <button className="settings-close" onClick={onClose}><X size={20} /></button>
      </div>

      <div className="settings-body info-body">
        <div className="info-disclaimer">
          <AlertTriangle size={18} />
          <div>
            <b>Viktig forbehold</b>
            <p>
              Båtkart er et hjelpemiddel og <b>erstatter ikke</b> offisielle sjøkart,
              kartplotter eller godkjent navigasjonsutstyr. Posisjon, dybder, sjømerker,
              vær, tidevann og AIS kan være unøyaktige eller forsinket. Bruk alltid
              offisielle kilder og godt sjømannskap. Du er selv ansvarlig for sikker
              navigering.
            </p>
          </div>
        </div>

        <h3 className="info-h">Kom i gang</h3>
        <ul className="info-list">
          <li><b>Posisjon:</b> blå pil viser båten. Trykk «sentrer»-knappen for å følge.</li>
          <li><b>Dag / natt / nattsyn:</b> sol-/øye-knappen på kartet sykler mellom modusene.</li>
          <li><b>Vær og tidevann:</b> sol-/bølge-knappen på kartet viser nærmeste data.</li>
        </ul>

        <h3 className="info-h">Steder</h3>
        <ul className="info-list">
          <li>Trykk på kartet for å slippe en pin og lagre stedet.</li>
          <li>Åpne <b>Steder</b>: søk på nett og se dine lagrede steder samlet.</li>
          <li>Velg et symbol (fiske, bading, ankring, vrak, fare, iland) ved lagring.</li>
        </ul>

        <h3 className="info-h">Turer</h3>
        <ul className="info-list">
          <li>Sporing starter automatisk når appen åpnes.</li>
          <li>Trykk <b>REC</b> i statuslinja for å åpne Turer – lagre eller forkast.</li>
          <li>Lagrede turer kan følges på nytt senere.</li>
        </ul>

        <h3 className="info-h">Mann over bord (MOB)</h3>
        <ul className="info-list">
          <li>Røde <b>MOB</b>-knappen merker posisjonen umiddelbart.</li>
          <li>Vis avstand/peiling, kopier koordinater og naviger tilbake.</li>
          <li>Ved nød: ring <b>120</b> (sjøredning) eller <b>112</b>.</li>
        </ul>

        <h3 className="info-h">AIS</h3>
        <ul className="info-list">
          <li>Legg inn gratis API-nøkkel fra aisstream.io under Meg.</li>
          <li>Andre fartøy vises på kartet med kurs og kollisjonsvarsel.</li>
        </ul>

        <h3 className="info-h">Offline</h3>
        <ul className="info-list">
          <li>Kart caches automatisk. Last ned område på forhånd via «Kart uten nett».</li>
        </ul>
      </div>
    </div>
  )
}
