# Plan: betaling, abonnement og tilgang (Stripe)

## Beslutninger
- **Betaling: Stripe.** Modell **ikke bestemt** (kanskje intro/startup første år, ny
  prising senere). → design **modell-nøytralt**: produkt skilt fra pris, tilgang via
  entitlements. Da kan prising/modell endres uten ombygging.

## Arbeidsdeling (ikke dupliser Stripe)
- **Stripe eier:** kort, fornying, prøveperiode, kansellering, purring/grace,
  faktura, mva, kvittering, refusjon. (Stripe Dashboard = support-verktøyet.)
- **Vi eier (Supabase):** produktkatalog (data), **entitlements** (hva brukeren har
  tilgang til NÅ), samtykker, turer. Vi **speiler** Stripe sin abonnementsstatus via
  **webhook** – ikke egen fornyingslogikk.

## Kjerneprinsipp: tilgang = entitlements
Appen spør **aldri** "har betalt?". Den spør **"har bruker aktiv rettighet X nå?"**
→ `entitlement`-tabellen (avledet fra abonnement via webhook). Bytte modell/pris
endrer kun Stripe + `product`/`price_plan`, ikke app-logikken.

## Hva vi ALLEREDE har
`auth.users` (bruker), `profiles` (kunde-light), `consent_log`, `tos_acceptances`,
`trips`, `events`.

## Skjelett som bør reserveres (lite, utvidbart)
- `profiles` + `stripe_customer_id`
- `product` (id, key, navn, beskrivelse, active) – **data, ikke hardkodet**
- `price_plan` (id, product_id, stripe_price_id, interval, beløp, valuta, trial_days, active)
- `subscription` (id = stripe_sub_id, user_id, price_plan_id, status, current_period_end,
  cancel_at_period_end, trial_end, started_at) – oppdateres av webhook
- `entitlement` (id, user_id, feature_key, active, source_subscription_id, valid_until)
- (senere) `audit_log`, `payment`-mirror, `customer` + `customer_user` (firma/familie)

## Statuser (speiles fra Stripe)
`trial | active | past_due | canceled | unpaid` (Stripe sine), + utledet entitlement
`active/expired`.

## Angrerett (norsk forbrukerrett, digital tjeneste)
Ved kjøp av digital tjeneste med **umiddelbar levering** må kunden aktivt **samtykke
til umiddelbar levering og frasi seg angrerett**. Lagre ved checkout:
- kjøpstidspunkt, aktiveringstidspunkt, **samtykke til umiddelbar levering + frafall**,
  angrefrist. → logges i `consent_log` (kind=`immediate_delivery_waiver`) + ordre/metadata.
Refusjon kjøres i Stripe; entitlement trekkes tilbake av webhook.

## GDPR / posisjon
- Persondata (profiles) skilt fra bruksdata (trips) – allerede gjort.
- Senere: retention på turer, eksport av egne data, sletting/anonymisering
  (`deleted_at`/anonymiser-felt), behold regnskapsdata som må beholdes.

## Faser
1. **Nå (uten Stripe):** reserver skjelett-tabellene over (tomme) hvis ønskelig.
   Ikke nødvendig før salg, men billig å navngi tidlig.
2. **Når salg skal i gang:** Stripe-konto → produkter/priser i Stripe → speil til
   `product`/`price_plan` → **Stripe Checkout** → **webhook** (Supabase Edge Function
   eller n8n) oppdaterer `subscription` + `entitlement` → app gater på entitlement.
   Fang angrerett-frafall ved checkout.
3. **Senere:** flere produkter/kampanjer, bedriftskunder (`customer`+`customer_user`),
   `audit_log`, dataeksport/anonymisering.

## YAGNI-notat
Ikke bygg `customer`/`customer_user`, kampanjer, `audit_log` nå. `profiles` (1:1
bruker) holder for MVP. Migrasjonssti er ren: legg til `customer` + koble når
firma/familie faktisk trengs.

## Sikkerhet
- Frontend: kun `anon`-nøkkel. Webhook/serverlogikk: `service_role` (kun server).
- Stripe **secret key** kun server-side (webhook-funksjon), aldri i frontend/git.
