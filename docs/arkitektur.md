# Arkitektur – Batkart

## Hvor ting ligger
- **Supabase** (Postgres): all varig data – `trips`, `tos_acceptances`, `events`,
  (senere `boats`), + **auth** (innlogging) + evt. storage. Dette er sannhetskilden.
- **Frontend-app** (Vite/React PWA): hostes på **Vercel**, rot-mappe = `webapp/`.
  - Config: **`webapp/vercel.json`** (no-cache-headers for PWA: sw.js, index.html, m.m.).
  - **AIS**: Vercel-funksjon `webapp/api/ais.ts` (kalt via `/api/ais`).
  - **Tidevann**: kalles direkte mot `vannstand.kartverket.no` fra frontend.
  - **Netlify er fjernet** (var ubrukt; tide-funksjonen var død kode).
  - Env-variabler (`VITE_SUPABASE_*`) settes i Vercel-dashbordet.
- **n8n** (senere): automatisering/rapporter – leser fra Supabase, sender ut.

## Nøkler / sikkerhet (viktig)
- **Frontend:** kun `anon`-nøkkel. RLS beskytter data.
- **n8n / backend-rapporter:** bruker **`service_role`**-nøkkel (kjører server-side,
  omgår RLS for å lage rapporter på tvers av brukere). Ligger KUN i n8n sine
  credentials – aldri i frontend, git eller logger.

## Rapporter & dashboard (planlagt)
### Internt (eier)
- Aggregert bruk: antall turer, aktive brukere, hendelser (`events`).
- Verktøy: Supabase Studio / **Metabase** / Grafana mot Postgres, eller egen admin-side.

### Eksternt (kunde)
- F.eks. n8n-flyt: trigger (tidsplan eller webhook) → spør Postgres etter kundens
  turer → formater (PDF/CSV/HTML) → send på e-post.
- Bygges enkelt fordi alt er i Postgres. **Views** eller dim/fact-marts (se
  `datamodell.md`) gjør rapport-spørringene rene.

## Dataflyt (rapport-eksempel)
```
Supabase (Postgres)  ──service_role──►  n8n  ──►  PDF/e-post til kunde
   trips, boats                         (spør + formater + send)
```
