# Plan: Turlagring i Supabase

## Beslutninger
- **Per bruker** nå. `boat_id`-kolonne finnes fra start (nullable) → båt-velger kan komme senere uten migrering.
- **Supabase Auth med e-post** (magic link). Frontend bruker kun `anon`-nøkkel.
- **Offline-first**: turer lagres alltid lokalt (localStorage) først, synkes til Supabase når online + innlogget.

## Sikkerhet
- Kun `anon`-nøkkel i frontend. ALDRI `service_role`/secret.
- URL + anon-nøkkel legges i `AI/.env` (ikke committet) og leses via Vite-env.
- RLS sikrer at bruker kun ser egne turer (se `supabase/schema.sql`).

## Steg
1. [x] DB-schema + RLS (`supabase/schema.sql`) — kjøres i Supabase.
2. [ ] Få prosjekt-URL + anon-nøkkel → `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
3. [ ] `npm i @supabase/supabase-js`, lag `src/supabase.ts` (klient).
4. [ ] Auth-UI: enkel e-post-innlogging (magic link) under «Meg». Vis innlogget-status.
5. [ ] Sync-lag: ved `saveCurrentTrack` → skriv lokalt + push til `trips` om innlogget.
6. [ ] Hent turer ved innlogging → flett med lokale (id-basert), vis i Turer-panelet.
7. [ ] Slett/oppdater synkes begge veier.

## Datamodell (trips)
`id, user_id, boat_id(null), name, trip_date, distance_m, duration_s, avg_speed_ms, max_speed_ms, icon, points(jsonb), created_at`

Matcher `SavedTrack` i `useMapStore.ts` 1:1 (metrikkene finnes allerede).

## Status
- [x] E-post + passord-innlogging (Confirm email AV under testing).
- [x] Offline-first sync (push/slett/hent/flett).

## Før lansering (TODO)
- [ ] **Sosial innlogging**: Google (1-tapp). Krever Google Cloud OAuth-klient +
      Supabase Provider-oppsett + redirect-URL. Evt. Apple (kreves om iOS-app i App Store).
- [ ] **Account-UI plassering/design**: egen "Konto/Profil"-skjerm i stedet for
      øverst i Meg. Tydeligere innlogget-status, evt. avatar.
- [ ] **Confirm email PÅ igjen** før lansering + egen SMTP (Resend) for
      passord-reset og e-postbekreftelse uten rate limits.
- [ ] **Passord-reset**-flyt (glemt passord).
- [ ] Vurder å beholde e-post+passord som fallback ved siden av Google.

## Analyse & rapport (kommende)
### For meg (eier)
- `events`-tabellen fanger allerede anonyme hendelser. Utvid `track()`-kallene til
  å dekke nøkkelhandlinger (app-åpning, tur lagret, feature-bruk, feil).
- Eier-dashboard: spør `events`/`trips` (aggregert) i en intern visning eller
  Supabase-dashboard/Metabase. Ingen persondata utover det som trengs.

### For bruker (dashboard)
- [x] Totaler i Turer (antall, distanse, tid).
- [ ] Utvidet statistikk: per måned/år, lengste tur, snittfart over tid.
- [ ] **Se turen på ekte kart** når online (vi har allerede `points[]` + følg-spor;
      legg "Vis på kart" i tur-detalj som tegner ruten på hovedkartet). Offline:
      SVG-ruten i detaljvisning dekker behovet (ingen base64 nødvendig).
- [ ] **Rapport/eksport**: tabell over alle turer med metadata →
      CSV (enkelt, klientside) nå, PDF senere (Supabase Edge Function).
  - Format: dato som ISO / `YYYY-MM-DD HH:MM` (sorterbart), ALDRI lokalisert
    "man."-streng. Tall som rådata (m, s, m/s) + evt. formaterte kolonner ved siden.
  - Lagring er allerede rapport-klar: `timestamptz` (UTC) + SI-enheter. Locale-format
    er kun UI-visning.

### Hva vi bør fange NÅ (for fremtiden)
- `trips` har allerede: distanse, varighet, snitt, maks, dato, punkter.
- Vurder å legge til ved opptak: `started_at`/`ended_at` (eksakt), evt.
  værforhold-snapshot. Lett å utvide tabellen senere (nullable kolonner).

## Datavolum
- [x] **Punkt kun ved bevegelse**: fart ≥ ~1,4 knop og ≥10 m flyttet → drift/stillstand
      (fiske) logges ikke. Største sparekilden.
- [x] **Forenkle rute ved lagring** (Douglas-Peucker, ~12 m). Beholder form.
- Effekt: 4t-tur fra ~14 000 → typisk noen hundre punkter.
- [ ] **Retention** (senere, hvis nødvendig): cap localStorage til siste N turer
      (eldre kun i sky), evt. slett sky-turer eldre enn X måneder. Ikke nødvendig nå
      gitt kildereduksjonen over — vurderes når reelle tall foreligger.

## Senere (båt)
- Tabell `boats (id, user_id, name, mmsi, …)`.
- Båt-velger i UI; sett `boat_id` på nye turer. Eksisterende turer beholder `null`.
