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

## Senere (båt)
- Tabell `boats (id, user_id, name, mmsi, …)`.
- Båt-velger i UI; sett `boat_id` på nye turer. Eksisterende turer beholder `null`.
