# Batkart – Prosjektregler for Claude

## Prosjekt
Nettbrett-app for båtnavigasjon. Primærbruk: tablet i cockpit om bord.

## Tech Stack
- React + TypeScript + Vite
- Leaflet.js + OpenSeaMap nautisk overlay
- Zustand (state management)
- Tailwind CSS

## Struktur
```
webapp/          – React-appen
docs/
  superpowers/
    plans/       – implementasjonsplaner
```

## Koderegler
- TypeScript strict mode
- Funksjonelle React-komponenter, ingen klasser
- Zustand for global state (GPS, spor, markører)
- Leaflet-kart aldri i global state – bare i komponentrefs

## Viktige valg
- GPS via Web Geolocation API (nettbrett-native)
- Kart tiles: OpenStreetMap + OpenSeaMap overlay
- Fart og retning beregnes fra GPS-posisjoner
- Offline-first: tiles caches via service worker

## Arbeidsflyt
1. Plan i `docs/superpowers/plans/` før koding
2. Bruk `/superpowers:brainstorming` ved nye features
3. Test på mobil/nettbrett-viewport (768px+)
