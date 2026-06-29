# Plan/research: dynamisk rutevalg (ikke rett linje)

## Status i dag
- Navigasjon tegner **rett strek** båt → mål (storsirkel), ingen ruting rundt land.
  (`MapView.tsx` navLine/previewLine.)

## Hva konkurrentene gjør
- **Navionics Dock-to-Dock / Garmin Auto Guidance+**: lager detaljert rute fra start
  til mål, også gjennom trange løp. Bruker **kartdata: dybde, sjømerker, kystlinje**,
  og finner korteste vei som holder seg i vann dypt nok for båtens **dypgang**.
  Markerer farer (grunner, broer). Stort, lisensiert datagrunnlag.
- **Alle** legger på sterk disclaimer: auto-rute erstatter IKKE sikker navigasjon,
  må dobbeltsjekkes (brohøyder o.l. ikke alltid med).

## Hva som er teknisk mulig (åpne data)
- **Land-unngåelse uten dybde:** byggbart med åpne data. A*/Dijkstra på et
  "navigerbart vann"-rutenett der kystlinje/land maskeres ut.
  - Kystlinje: GSHHG-polygoner eller OSM `natural=coastline`/vann-polygoner.
  - Bibliotek/eksempler: `searoute` (Dijkstra/A* på vann-grid, men havskala/grov),
    OpenStreetMap-Ship-Routing (A* på OSM-graf), OpenCPN (ruting i open source).
- **Dybde-/dypgangs-ruting (ekte Navionics-nivå):** krever batymetri i høy oppløsning.
  - Norge: **Kartverket dybdedata** finnes (egen lisens/oppløsning må avklares).
  - Dette er det dyre/vanskelige steget — datatilgang + prosessering + ansvar.

## Anbefalt stegvis vei for Batkart
1. **Waypoints (manuell ruting) — lavt hengende frukt.** Behold rett strek, men la
   bruker legge til mellompunkter ved å trykke → fleruleddet rute rundt land manuelt.
   Null ekstra data/lisens, stor brukernytte. Bør gjøres først.
2. **Auto land-unngåelse (åpne data).** A* på kystlinje-maskert grid for norske
   farvann. Ruter rundt øyer/land. Tydelig disclaimer: unngår IKKE grunner (ingen
   dybde). Offline mulig hvis grid pakkes per region. Middels innsats.
3. **Dybde-/dypgangs-ruting.** Krever Kartverket-batymetri (lisens + prosessering).
   Størst innsats + ansvar. Langsiktig.

## Arkitektur-valg (for steg 2)
- **Klientside A*** på forhåndsbygd vann-grid per region (offline, men grid-størrelse
  vs. oppløsning er en avveining), eller
- **Serverless rute-API** (egen liten funksjon) som regner rute på forespørsel.
- Havskala-tjenester (searoute) er for grove til trange kystløp — kyst-Norge trenger
  fin oppløsning → stor graf.

## Ansvar/jus
- Som uoffisiell app er **dybde-auto-ruting risikabelt** (ansvar ved grunnstøting).
  Steg 1–2 (waypoints + land-unngåelse med tydelig "sjekk dybde selv") er trygt å
  lansere; steg 3 krever nøye vurdering.
