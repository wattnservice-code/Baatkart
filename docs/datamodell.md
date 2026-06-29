# Datamodell – Batkart (Supabase)

## Operasjonell DB (det appen bruker)
Dette er en **transaksjonell, relasjonell** modell – ikke et data warehouse.
Den felles dimensjonen er **brukeren** (`auth.users`).

| Tabell | PK | Eier-nøkkel | Merknad |
|---|---|---|---|
| `profiles` | `id` uuid = auth.users.id | (1:1 bruker) | kundedata + preferanser (rapport-frekvens m.m.), auto-opprettet ved registrering |
| `trips` | `id` **text** (klient-uuid) | `user_id` → auth.users | text-id fordi offline-first (klienten genererer id) |
| `tos_acceptances` | `id` bigint identity | `user_id` → auth.users | samtykke-logg (+ `terms_hash`) |
| `events` | `id` bigint identity | – (anonym `session_id`) | analytics, bevisst uten bruker |
| `boats` (senere) | `id` uuid | `user_id` → auth.users | dimensjon `trips.boat_id` peker hit |

**E-post** ligger i `auth.users` (Supabase Auth) – ikke duplisert. n8n/rapporter
joiner `auth.users` (e-post) med `profiles` (preferanser) og `trips` (data).

### Hvorfor PK-stilen varierer
- **Offline-syncbare** tabeller (trips) bruker **klientgenerert id** (text/uuid) så
  samme id finnes lokalt og i sky. Bevisst.
- **Server-only logger** (events, tos_acceptances) bruker `bigint identity` – enklest.

### Konvensjon framover (gjennomgående nøkler)
Hver bruker-eid tabell bør ha:
- `id` (PK), `user_id uuid` → auth.users, `created_at timestamptz default now()`
- **RLS** på `user_id` (bruker ser kun egne rader)
Dette holder relasjonene konsistente uten å overstandardisere PK-typen.

## Analyse (dim/fact) – egen, senere lag
Stjerneskjema (Kimball) hører til et **analyse-lag**, ikke den operasjonelle DB-en.
Når vi vil ha rapport/dashboard bygger vi marts (views eller eget `analytics`-schema)
**avledet** fra tabellene over:

- **Dimensjoner:** `dim_user`, `dim_boat`, `dim_date`
- **Fakta:**
  - `fact_trip` – én rad per tur: user_key, boat_key, date_key, distanse, varighet,
    snitt/maks fart
  - `fact_event` – én rad per hendelse

Dette gjør analyse rask uten å rote til den operasjonelle modellen. Bygges når reelle
data/volum tilsier det – ikke nå.
