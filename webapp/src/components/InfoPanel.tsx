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

        <h3 className="info-h">Datakilder og lisenser</h3>
        <ul className="info-list">
          <li>
            <b>Grunnkart:</b> © <a href="https://stadiamaps.com/" target="_blank" rel="noopener">Stadia Maps</a> /
            <a href="https://openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> /
            <a href="https://openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>-bidragsytere –
            lisens <a href="https://opendatacommons.org/licenses/odbl/" target="_blank" rel="noopener">ODbL</a>.
            Kommersiell bruk tillatt.
          </li>
          <li>
            <b>Nattmodus:</b> Stadia Maps «Alidade Smooth Dark» –
            basert på OpenStreetMap, kommersiell bruk tillatt.
          </li>
          <li>
            <b>Sjøkart:</b> © <a href="https://kartverket.no" target="_blank" rel="noopener">Kartverket</a> –
            norske sjøkart (WMTS). Lisens NLOD 2.0.
          </li>
          <li>
            <b>Sjømerker:</b> © <a href="https://openseamap.org" target="_blank" rel="noopener">OpenSeaMap</a> –
            navigasjonsmerker, lisens ODbL.
          </li>
          <li>
            <b>AIS-fartøy:</b> © <a href="https://barentswatch.no" target="_blank" rel="noopener">Barentswatch</a> /
            Kystverket – offisiell norsk AIS, lisens NLOD 2.0.
          </li>
          <li>
            <b>Vær:</b> © <a href="https://yr.no" target="_blank" rel="noopener">Yr</a> /
            <a href="https://met.no" target="_blank" rel="noopener"> Meteorologisk institutt</a> –
            data fra api.met.no, lisens NLOD 2.0.
          </li>
          <li>
            <b>Tidevann:</b> © <a href="https://kartverket.no" target="_blank" rel="noopener">Kartverket</a> –
            vannstand.kartverket.no, lisens NLOD 2.0.
          </li>
          <li>
            <b>Stedsnavn:</b> © <a href="https://kartverket.no" target="_blank" rel="noopener">Kartverket</a> (stedsnavn API)
            og <a href="https://nominatim.openstreetmap.org" target="_blank" rel="noopener">Nominatim</a> / OpenStreetMap.
          </li>
          <li>
            <b>Mer om fartøy:</b> <a href="https://www.vesselfinder.com" target="_blank" rel="noopener">VesselFinder</a> –
            ekstern lenke, åpnes i nettleser.
          </li>
          <li>
            <b>Google Maps / Google Earth:</b> Eksterne lenker fra stedskort –
            åpner Googles egne tjenester i nettleser.
          </li>
          <li>
            <b>GPS:</b> Enhetens innebygde GPS via Web Geolocation API (nettleser-native).
          </li>
        </ul>
        <p style={{ fontSize: 11, color: '#64748b', marginTop: 8, lineHeight: 1.5 }}>
          Kartattribusjon vises nederst til venstre på kartet. Alle offentlige norske datakilder
          er distribuert under <a href="https://data.norge.no/nlod" target="_blank" rel="noopener">Norsk lisens for offentlige data (NLOD) 2.0</a>.
        </p>
      </div>
    </div>
  )
}
