# Arkitektur – Batkart

## Hvor ting ligger
- **Supabase** (Postgres): all varig data – `trips`, `tos_acceptances`, `events`,
  (senere `boats`), + **auth** (innlogging) + evt. storage. Dette er sannhetskilden.
- **Frontend-app** (Vite/React PWA): hostes på **Vercel** *eller* **Netlify**.
  - Begge config-filer finnes nå (`vercel.json`, `netlify.toml`).
  - `netlify/functions/tide.js` er en **Netlify-funksjon** → tidevann virker kun om
    appen kjøres på Netlify (eller funksjonen flyttes til Vercel).
  - ⚠️ **Anbefaling:** velg **én** host for å unngå forvirring. Sett da env-variabler
    (`VITE_SUPABASE_*`) i den hostens dashboard.
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
