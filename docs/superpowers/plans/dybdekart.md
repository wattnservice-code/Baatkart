# Plan: dybdefarger / sjøkart-lag (Kartverket)

## Mål
Fargelagte dybder på kartet (grunt→dypt) for norske farvann. OpenSeaMap (dagens
gratislag) har ikke dette. Sterk nisje- + premium-mulighet.

## Kilder (Norge, gratis bruk)
1. **Sjøkartraster** (`cache.kartverket.no`) — offisielt sjøkart-raster med ekte
   dybdefarger, koter, dybdetall. Tiles → rett inn i Leaflet. **Beste "farger på dybder".**
2. **Sjøkart – Dybdedata WMS/WFS** (geonorge) — vektoriserte dybdeverdier/koter som
   overlay oppå annet kart.
- (Offshore/utland senere: EMODnet Bathymetry, GEBCO.)

## Implementering
- Toggle-bart Leaflet-lag (enten alternativt grunnkart = sjøkartraster, eller
  dybde-overlay oppå OSM).
- **Attribusjon © Kartverket** påkrevd (vis i kart-attribution).
- Verifiser eksakt WMTS/WMS-endepunkt + lag-navn fra kartkatalog.geonorge.no.
- Bekreft lisens (sea-data «fri bruk»; dokumentér vilkår).

## Forretning / posisjonering
- **Gratis:** OpenSeaMap (som nå).
- **Premium:** offisielle norske sjøkart med dybder (Kartverket sjøkartraster).
- Gate på `has_feature('premium')` når betaling er live. Kart/GPS/MOB forblir gratis.

## Jus/sikkerhet
- Selv med offisielle kart: behold forbehold ("hjelpemiddel, ha offisielle kart om
  bord, ikke godkjent plotter"). Dataene blir bedre, men appen er fortsatt et hjelpemiddel.

## "Ekte vektor" – kostnad & tyngde (vurdering)
- **Kostnad:** gratis (Kartverket dybdedata er åpne data, både WMS og vektor).
- **Tyngde:** ja, noe. Vektor betyr at appen henter data + tegner selv:
  - (a) WFS-features (GeoJSON) i Leaflet → inkrementelt, men ytelsesrisiko ved mange
    dybdepolygoner (CPU/batteri/lag på nettbrett).
  - (b) MapLibre + vektortiles → best kvalitet/ytelse, men bytter kart-motor (stor
    ombygging + større bundle).
- **Gratis snarvei (gjort):** CSS-filter (`.depth-boost`, saturate/contrast) på dagens
  WMS-lag → kraftigere farger, null ekstra data. Løser "større fargeforskjell".
- **Numrene:** rasteret leverer tallene (kan ikke styles separat). For *custom* skarpe/
  store tall trengs vektor (b) eller egne WFS-punkter — det er den tunge delen.

## Anbefaling
1. Test CSS-boost (farge) + raster-tall nå. Ofte "godt nok".
2. Vil du ha maksimalt (custom farge + custom tall): **prototyp + mål ytelse på
   nettbrett FØR vi committer**. Behandle som premium. Ikke bygg blindt – det kan
   bryte "cockpit lett & rask".

## Status
Ikke bygget. Kandidat: bygg som **toggle nå (gratis test)** for å verifisere kilde/kvalitet,
gate som premium senere. Lav teknisk risiko (ett Leaflet-lag).
