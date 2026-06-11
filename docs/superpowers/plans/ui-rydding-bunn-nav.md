# Plan: UI-rydding + 4-knappers bunn-nav

Mål: gjøre appen lettere og mer kommersiell. Færre knapper, klarere
flyt, behold wow-faktorene (Google Earth, vær/tidevann, sjøkart).
Forberede for senere: kontoer, sky-synk av turer, dvale-abonnement.

## Fjernes nå (bruker godkjent)
- **Ankervakt** — nisje, kompleks. Fjern helt.
- **Waypoints** — egen multi-etappe-rute fjernes. Navigasjon blir
  enkel punkt-til-punkt (posisjon → mål).

## Beholdes
Kart + OpenSeaMap, GPS + sporing, søk, favoritter/steder, navigasjon
til ett punkt, Google Earth/Maps, offline kart, dag/natt, vær,
tidevann, kompass, MOB, båtinfo.

## Ny struktur

### Bunn-nav (4 faner, alltid synlig, tommel-rekkevidde)
- 🗺️ **Kart** — standard, lukker alle paneler
- 🧭 **Naviger** — åpner søk ("Hvor skal du?")
- ⭐ **Steder** — lagrede steder (SpotListPanel)
- 👤 **Meg** — innstillinger nå; konto/abonnement/turhistorikk senere

### Flytende kart-knapper (høyre side, minimal)
Zoom +/−, sentrer/følg, kompass (heading-up), **Spor (REC)** start/stopp.

### "Meg"-panel (alle innstillinger samlet)
Båtinfo · Dag/natt · Sjømerke · Avstandsring · Kompass på/av ·
Vær · Tidevann · Enheter (fart/avstand) · Last ned offline kart ·
Google Earth av gjeldende kartutsnitt.

### App-layout
```
[ kart (flex:1) ]
[ StatusBar (tynn telemetri) ]
[ BottomNav (fanelinje) ]
```

## Filer som endres
- `store/useMapStore.ts` — fjern anchor* + waypoint*-state/actions
- `components/MapView.tsx` — fjern anker- og waypoint-rendering + klikk
- `components/MapControls.tsx` — erstatt 2 hamburger-paneler med
  flytende kontroller + behold pin-action-kort
- `components/NavOverlay.tsx` — single-target (ingen etapper/XTE/auto-advance)
- `components/NavPreviewBar.tsx` — fjern WP-UI
- `components/SpotListPanel.tsx` / `SearchBar.tsx` — fjern "som waypoint"-knapp
- `App.tsx` — fjern AnchorOverlay, legg til BottomNav
- NY `components/BottomNav.tsx`
- NY `components/SettingsPanel.tsx` ("Meg")
- SLETT `AnchorDialog.tsx`, `AnchorOverlay.tsx`, `WaypointDialog.tsx`

## Verifisering
`npm run build` (tsc -b — fanger ubrukte variabler). To commits:
(1) fjerning, (2) bunn-nav.

## Senere (ikke nå)
Supabase + login → sky-synk av turer (spor + tid/dato + båt) →
tema-moduser (kayak/fiske) → betaling → deling.
Forretningsmodell: dvale-abonnement (lav pris for å bevare data
utenom sesong, opp ved bruk).
