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
              kartplotter eller godkjent navigasjonsutstyr. Kartdata er basert på
              OpenSeaMap som er community-vedlikeholdt og <b>ikke offisielt godkjent</b> for
              navigasjon. Posisjon, dybder, sjømerker og AIS kan være unøyaktige eller
              forsinket. Bruk alltid offisielle kilder og godt sjømannskap.
              Du er selv ansvarlig for sikker navigering.
            </p>
          </div>
        </div>

        <h3 className="info-h">Kom i gang</h3>
        <ul className="info-list">
          <li><b>Posisjon:</b> blå pil viser båten. Trykk «sentrer»-knappen (pil-ikon) for å følge posisjonen.</li>
          <li><b>Dag / natt / nattsyn:</b> sol-knappen på høyre side sykler mellom modusene.</li>
          <li><b>Kartretning:</b> kompassknappen øverst til høyre – trykk for GPS-kjøreretning (heading-up), trykk igjen for kompassretning, en gang til for nord-opp.</li>
          <li><b>Vri kart med to fingre:</b> slå på under Meg → «Vri kart med to fingre». Trykk «Tilbake til båten» for å nullstille retningen.</li>
          <li><b>Skjermen forblir på</b> så lenge appen er åpen (Wake Lock).</li>
        </ul>

        <h3 className="info-h">Valgt punkt</h3>
        <ul className="info-list">
          <li>Trykk på kartet for å åpne <b>Valgt punkt</b>-menyen (trykk igjen for å lukke).</li>
          <li>Herfra kan du navigere til punktet, åpne i Google Maps, eller lagre som sted.</li>
        </ul>

        <h3 className="info-h">Hurtig-merker</h3>
        <ul className="info-list">
          <li>Trykk <b>sikte-knappen</b> (⊕) for å droppe et merke der båten er – hvert trykk gir et nytt merke. Praktisk for fiskeplasser, teiner og lignende under fart.</li>
          <li>Trykk et merke på kartet eller i lista for å markere det; trykk <b>navigér</b> for å sette kurs dit.</li>
          <li>Sletting krever bekreftelse. Knappen kan skrus av under <b>Meg</b>.</li>
        </ul>

        <h3 className="info-h">Steder</h3>
        <ul className="info-list">
          <li>Åpne <b>Steder</b>-panelet og trykk «Min posisjon» for å lagre der du er, eller «Velg på kartet» for å plassere en pin manuelt.</li>
          <li>Søk på stedsnavn eller adresse – lagre søkeresultater direkte.</li>
          <li>Velg symbol (fiske, bading, ankring, vrak, fare, iland) ved lagring.</li>
          <li>Trykk «Vises på kart»/«Skjult på kart» øverst i panelet for å vise eller skjule alle lagrede steder på kartet.</li>
          <li>Steder er sortert alfabetisk.</li>
        </ul>

        <h3 className="info-h">Navigasjon</h3>
        <ul className="info-list">
          <li>Søk etter et sted og trykk <b>Start</b> for å begynne navigasjon.</li>
          <li>Du kan også navigere fra et lagret sted ved å trykke navigasjonsikonet i Steder-panelet.</li>
          <li>Kurslinje og avstand vises på kartet under navigasjon.</li>
          <li>Trykk <b>Avbryt</b> for å stoppe navigasjonen.</li>
        </ul>

        <h3 className="info-h">Turer</h3>
        <ul className="info-list">
          <li>Trykk <b>Tur</b>-knappen i statuslinja for å starte sporing.</li>
          <li>Under opptak vises <b>REC</b> med distanse. Trykk på den for å åpne Turer-panelet der du kan stoppe og lagre eller forkaste turen.</li>
          <li>Slå på <b>Start tur-opptak automatisk</b> under Meg → Sporing for automatisk start ved åpning.</li>
          <li>Lagrede turer kan vises og følges på nytt.</li>
        </ul>

        <h3 className="info-h">Mann over bord (MOB)</h3>
        <ul className="info-list">
          <li>Røde <b>MOB</b>-knappen merker posisjonen umiddelbart.</li>
          <li>Viser avstand og peiling til MOB-punktet kontinuerlig.</li>
          <li>Trykk <b>Del posisjon</b> for å dele koordinater og Google Maps-lenke via meldingsapp, e-post eller annet.</li>
          <li>Kopier koordinater direkte til utklippstavlen.</li>
          <li>Ved nød: ring <b>120</b> (sjøredning) eller <b>112</b>.</li>
        </ul>

        <h3 className="info-h">AIS – fartøy på kartet</h3>
        <ul className="info-list">
          <li>Trykk <b>Ship-knappen</b> på kartet for å slå AIS av/på.</li>
          <li>Data hentes fra Barentswatch / Kystverket og oppdateres hvert 15. sekund.</li>
          <li>Trykk på et fartøy for å se navn, type, fart, kurs, destinasjon og dimensjoner.</li>
          <li><b>Kollisjonsvarsel</b> (pulserende rød 🚨): CPA &lt; 0,5 nm og TCPA &lt; 6 min. Trykk på varselet for å fly til det farligste fartøyet.</li>
          <li>Fortøyde og ankrede fartøy kan skjules under Meg → «Vis fortøyde/ankrede».</li>
          <li>📡 <i>Ingen AIS-kontakt</i>: midlertidig nettverksfeil – forsvinner automatisk når kontakten er tilbake.</li>
          <li>Ikke alle fartøy sender alle opplysninger – manglende felter er normalt.</li>
          <li>AIS krever nettilgang og er ikke tilgjengelig offline.</li>
        </ul>

        <h3 className="info-h">Vær og tidevann</h3>
        <ul className="info-list">
          <li>Trykk <b>sol/bølge-knappen</b> øverst til høyre for å vise vær eller tidevann.</li>
          <li>Værdata fra Meteorologisk institutt (Yr) – vind, temperatur, bølger og strøm.</li>
          <li>Tidevann fra Kartverket – neste flo og fjøre ved nærmeste stasjon.</li>
          <li>Krever nettilgang.</li>
        </ul>

        <h3 className="info-h">Offline</h3>
        <ul className="info-list">
          <li>Kart caches automatisk når du er online – besøkte områder er tilgjengelige uten nett.</li>
          <li>Last ned et område på forhånd via Meg → Offline kart.</li>
          <li>AIS, vær og tidevann krever nettilgang og er ikke tilgjengelig offline.</li>
        </ul>

        <h3 className="info-h">Datakilder og lisenser</h3>
        <ul className="info-list">
          <li>
            <b>Grunnkart (dag og natt):</b> ©{' '}
            <a href="https://carto.com/" target="_blank" rel="noopener">CARTO</a> /{' '}
            <a href="https://openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>-bidragsytere –
            lisens <a href="https://opendatacommons.org/licenses/odbl/" target="_blank" rel="noopener">ODbL</a>.
          </li>
          <li>
            <b>Sjøkart-overlay:</b> ©{' '}
            <a href="https://openseamap.org" target="_blank" rel="noopener">OpenSeaMap</a> –
            community-vedlikeholdte navigasjonsmerker, lisens ODbL.{' '}
            <b>Ikke offisielt godkjent for navigasjon.</b>
          </li>
          <li>
            <b>AIS-fartøy:</b> ©{' '}
            <a href="https://barentswatch.no" target="_blank" rel="noopener">Barentswatch</a> / Kystverket –
            offisiell norsk AIS, lisens NLOD 2.0.
          </li>
          <li>
            <b>Vær:</b> ©{' '}
            <a href="https://yr.no" target="_blank" rel="noopener">Yr</a> /{' '}
            <a href="https://met.no" target="_blank" rel="noopener">Meteorologisk institutt</a> –
            api.met.no, lisens NLOD 2.0.
          </li>
          <li>
            <b>Tidevann:</b> ©{' '}
            <a href="https://kartverket.no" target="_blank" rel="noopener">Kartverket</a> –
            vannstand.kartverket.no, lisens NLOD 2.0.
          </li>
          <li>
            <b>Stedssøk:</b> ©{' '}
            <a href="https://nominatim.openstreetmap.org" target="_blank" rel="noopener">Nominatim</a> / OpenStreetMap.
          </li>
          <li>
            <b>Mer om fartøy:</b>{' '}
            <a href="https://www.vesselfinder.com" target="_blank" rel="noopener">VesselFinder</a> –
            ekstern lenke, åpnes i nettleser.
          </li>
          <li>
            <b>Google Maps / Google Earth:</b> Eksterne lenker fra stedskort og MOB – åpner Googles egne tjenester.
          </li>
          <li>
            <b>GPS:</b> Enhetens innebygde GPS via Web Geolocation API.
          </li>
        </ul>
        <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 8, lineHeight: 1.5 }}>
          Kartattribusjon vises nederst til venstre på kartet. Alle offentlige norske datakilder
          er distribuert under{' '}
          <a href="https://data.norge.no/nlod" target="_blank" rel="noopener">Norsk lisens for offentlige data (NLOD) 2.0</a>.
        </p>
      </div>
    </div>
  )
}
