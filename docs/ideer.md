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

## Touch-audit (fra UX-tilbakemelding)
- Full gjennomgang av treffflater (≥44–48px) i HELE appen, ikke bare lukkeknapper.
- Sjekk særlig: ikon-knapper på kartet, lister, og alt som trykkes i fart til sjøs.
