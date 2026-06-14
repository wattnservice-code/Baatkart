import { X, AlertTriangle } from 'lucide-react'
import { useSwipeDismiss } from '../hooks/useSwipeDismiss'

interface Props { onClose: () => void }

export default function InfoPanel({ onClose }: Props) {
  const swipe = useSwipeDismiss(onClose)
  return (
    <div className="settings-sheet">
      <div className="settings-head" {...swipe}>
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
              kartplotter eller godkjent navigasjonsutstyr. Posisjon, dybder, sjømerker
              og AIS kan være unøyaktige eller forsinket. Bruk alltid offisielle kilder
              og godt sjømannskap. Du er selv ansvarlig for sikker navigering.
            </p>
          </div>
        </div>

        <h3 className="info-h">Kom i gang</h3>
        <ul className="info-list">
          <li><b>Posisjon:</b> blå pil viser båten. Trykk «sentrer»-knappen for å følge.</li>
          <li><b>Dag / natt / nattsyn:</b> sol-/øye-knappen på kartet sykler mellom modusene.</li>
          <li><b>Kartretning:</b> kompassknappen sykler – trykk én gang for GPS kjøreretning, én til for kompassretning, én til for nord-opp.</li>
        </ul>

        <h3 className="info-h">Steder</h3>
        <ul className="info-list">
          <li>Trykk på kartet for å slippe en pin og lagre stedet.</li>
          <li>Åpne <b>Steder</b>: søk på nett og se dine lagrede steder samlet.</li>
          <li>Velg et symbol (fiske, bading, ankring, vrak, fare, iland) ved lagring.</li>
        </ul>

        <h3 className="info-h">Turer</h3>
        <ul className="info-list">
          <li>Trykk <b>Tur</b>-knappen i statuslinja for å starte opptak direkte.</li>
          <li>Trykk <b>REC</b> igjen for å stoppe – du kan lagre eller forkaste turen.</li>
          <li>Vil du at opptak starter automatisk, slå på <b>Start tur-opptak automatisk</b> under Meg → Sporing.</li>
          <li>Lagrede turer kan følges på nytt.</li>
        </ul>

        <h3 className="info-h">Mann over bord (MOB)</h3>
        <ul className="info-list">
          <li>Røde <b>MOB</b>-knappen merker posisjonen umiddelbart.</li>
          <li>Vis avstand/peiling, kopier koordinater og naviger tilbake.</li>
          <li>Ved nød: ring <b>120</b> (sjøredning) eller <b>112</b>.</li>
        </ul>

        <h3 className="info-h">AIS – fartøy på kartet</h3>
        <ul className="info-list">
          <li>Trykk <b>Ship-knappen</b> på kartet for å slå AIS av/på – ingen API-nøkkel nødvendig.</li>
          <li>Data hentes fra Barentswatch / Kystverket og oppdateres hvert 15. sekund.</li>
          <li>Trykk på et fartøy for å se navn, type, fart, kurs, destinasjon, dimensjoner og mer.</li>
          <li><b>Kollisjonsvarsel</b> (pulserende rød 🚨): CPA &lt; 0,3 nm og TCPA &lt; 10 min.</li>
          <li>📡 <i>Ingen AIS-kontakt</i>: midlertidig nettverksfeil – varselet forsvinner når kontakten er tilbake.</li>
          <li>Ikke alle fartøy sender alle opplysninger – manglende felter er normalt.</li>
        </ul>

        <h3 className="info-h">Offline</h3>
        <ul className="info-list">
          <li>Kart caches automatisk når du er online.</li>
          <li>Last ned et område på forhånd via Meg → Offline kart.</li>
        </ul>

        <h3 className="info-h">Datakilder</h3>
        <ul className="info-list">
          <li><b>Grunnkart:</b> OpenStreetMap (openstreetmap.org) – lisens ODbL. © OpenStreetMap-bidragsytere.</li>
          <li><b>Sjøkart:</b> Kartverket (kartverket.no) – norske sjøkart via WMS.</li>
          <li><b>Sjømerker:</b> OpenSeaMap (openseamap.org) – navigasjonsmerker og havner.</li>
          <li><b>AIS-fartøy:</b> Barentswatch / Kystverket (barentswatch.no) – offisiell norsk AIS.</li>
          <li><b>Stedssøk:</b> Nominatim / OpenStreetMap – stedsnavnsøk.</li>
          <li><b>Mer om fartøy:</b> VesselFinder (vesselfinder.com) – ekstern lenke fra popup.</li>
          <li><b>GPS:</b> Enhetens innebygde GPS via Web Geolocation API.</li>
        </ul>
      </div>
    </div>
  )
}
