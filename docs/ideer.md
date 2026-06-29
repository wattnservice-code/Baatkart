# Idébank – Batkart

Tanker som ikke er besluttet/implementert ennå. Vurderes når det passer.

## Sosialt: del posisjon med en kompis (live)
- **Hva:** se hverandres båt på kartet i sanntid (f.eks. på fisketur sammen).
- **Hvordan (skisse):** Supabase Realtime — hver bruker publiserer egen posisjon
  til en `presence`-kanal / `live_positions`-tabell; venner abonnerer.
  - Del via en **invitasjons-/gruppekode** (ingen permanent "venneliste" nødvendig først).
  - RLS: kun deltakere i samme gruppe ser hverandre. Auto-utløp (f.eks. 12t).
- **Vurdering:** Sterkt sosialt trekkplaster, men personvern + batteri + sanntid
  må gjøres ordentlig. Bygg etter at konto/auth er moden. Start enkelt:
  engangs-deling av *nåværende* posisjon (lenke) før full live-sporing.
- **Allerede:** MOB har "Del posisjon" (engangs koordinat-lenke) — kan gjenbrukes.

## Bruksprofiler / moduser (kontekst-avhengig oppsett)
- **Hva:** appen tilpasser seg bruken.
  - **Tur/seilas:** navigasjon, planlegging, kurslinje, ETA i fokus.
  - **Fiske:** rask merking av fiskeplasser, strøm/tidevann, dybde, "bli på stedet".
- **Hvordan (skisse):** en moduskvelger (øverst eller i Meg) som endrer hvilke
  knapper/overlays som vises og standardinnstillinger (f.eks. fiske → hurtig-merke
  på, strøm/tidevann på, look-ahead av).
- **Vurdering:** Kraftig for opplevd enkelhet, men ikke overkompliser. Start med
  2 profiler (Tur / Fiske) som kun skrur av/på eksisterende funksjoner — ingen ny
  kjernelogikk. Profil lagres lokalt (+ sky senere).
- **Rekkefølge:** etter at kjernefunksjonene er stabile; lett å legge på som et lag.

## Metadata → tilleggstjenester (tenk fremover)
Prinsipp: fang rik, strukturert metadata tidlig (båt + tur). Billig nå, dyrt å
etterfylle. Hver datakilde åpner tjenester:

| Metadata (har/planlagt) | Tjeneste den muliggjør |
|---|---|
| Forbruk (l/t) + marsjfart + tur-varighet | **Drivstoff-/kostnadsrapport** per tur/måned (premium) |
| Tur-varighet over tid | **Motortimer + service-påminnelser** (olje/service ved X timer) – sterk gjentaksverdi |
| Turer + timer + vedlikehold | **Digital loggbok / årsrapport** (n8n → e-post) – øker gjensalgsverdi på båt |
| Drivstofftype + forbruk | **CO₂-/miljøavtrykk** per tur |
| Dypgang | Dybde-varsler / dypgangs-ruting (sikkerhet) |
| Lengde/bredde | **Marina-/havne-match** (passer plassen?), drivstoffbrygge for din type |
| Båttype + anonymisert flåte | **Benchmark** ("båter som din: snitt X kn / Y l/t") |
| Båtdetaljer (type, lengde, MMSI) | **Forsikrings-/verkstedintegrasjon** (partner) |
| Fuel-kapasitet + forbruk | **Rekkevidde-planlegger** ("kommer jeg frem og tilbake?") |

**GDPR-vakt:** samle med tydelig formål (jf. `jus-ansvar.md`). Båt-spec er lav risiko
og høy verdi; MMSI/telefon er mer personlig → opt-in, klart formål.

## Touch-audit (fra UX-tilbakemelding)
- Full gjennomgang av treffflater (≥44–48px) i HELE appen, ikke bare lukkeknapper.
- Sjekk særlig: ikon-knapper på kartet, lister, og alt som trykkes i fart til sjøs.
