# Vedlikehold & optimalisering – Batkart

Gå gjennom denne lista jevnlig (f.eks. hver gang en større feature er ferdig,
eller før en deploy mot lansering). Kryss av, noter funn.

## UX & visuelt
- [ ] **Kontrast:** ingen tekst svakere enn `#94a3b8` (AA) på mørk bakgrunn; egne
      `.day`-overrides finnes for alt på lys bakgrunn. Ingen hvit-på-hvit.
- [ ] **Treffflater:** knapper ≥ 44–50px i cockpit-kritiske flyter (hansker).
- [ ] **Døde elementer:** hver knapp/fane gjør noe nyttig (ref. fjernet Kart-fane).
- [ ] **Liggende/lite skjerm:** kort/paneler får plass (maks-høyde + scroll), ikke
      kappet på iPhone landscape.
- [ ] **Myke overganger** der det passer (dag/natt, paneler).

## Data & ytelse
- [ ] **Tur-datamengde:** punkt kun ved bevegelse (≥1,4 kn, ≥10 m) + forenkling.
      Sjekk reell punktmengde på lange turer.
- [ ] **localStorage** nær grensen? Vurder retention (siste N turer lokalt).
- [ ] **Sync:** push er delta; "Synk nå" laster bare opp manglende.
- [ ] **PWA-cache:** test i incognito + lukk/åpne PWA etter deploy (iOS cacher hardt).
- [ ] **Bundle-størrelse:** følg med på advarsler i build.

## Funksjon & korrekthet
- [ ] **Bruksanvisning i synk** med faktisk oppførsel (denne lista + InfoPanel).
- [ ] **Tidssoner:** UTC lagret, lokal tid vist. Midnatt-kryssing håndtert.
- [ ] **AIS-kollisjon:** terskler (CPA < 0,5 nm, TCPA < 6 min) gir relevante varsler.
- [ ] **GPS i bakgrunn:** kjent begrensning (skjerm av pauser). Native = senere.

## Sikkerhet
- [ ] Kun `anon`-nøkkel i frontend. Aldri `service_role`/secret.
- [ ] RLS på alle tabeller (`trips`, `events`). Test at bruker kun ser egne data.
- [ ] `.env*` aldri committet.

## Før lansering
- [ ] Confirm email PÅ + egen SMTP (Resend).
- [ ] Sosial innlogging (Google), glemt passord.
- [ ] Se egen launch-liste i `superpowers/plans/supabase-trips.md`.
