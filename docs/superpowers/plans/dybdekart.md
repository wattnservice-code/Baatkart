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

## Status
Ikke bygget. Kandidat: bygg som **toggle nå (gratis test)** for å verifisere kilde/kvalitet,
gate som premium senere. Lav teknisk risiko (ett Leaflet-lag).
