# Plan: delt AIS-cache (skaler til mange brukere)

## Problem
I dag kaller **hver bruker** `/api/ais` hvert 15. sek → hver forespørsel treffer
Barentswatch med den **delte nøkkelen**. Mange brukere = mange kall = risiko for
rate-limit / utestenging, og unødvendig dobbeltarbeid når flere er i samme område.

## Løsning: TTL-cache per område (ikke sentral "hent alt")
1. Bruker sender bbox → serveren runder til et **område/tile-nøkkel** (f.eks. 0.5°-rutenett).
2. Sjekk delt cache for den nøkkelen:
   - **Fersk (< 15 s)** → returner cache. Ingen Barentswatch-kall.
   - **Utgått/mangler** → hent fra Barentswatch, lagre med 15 s TTL, returner.
3. Filtrer til brukerens eksakte bbox før retur (cache holder hele tile-en).

**Effekt:** N brukere i samme område → 1 Barentswatch-kall per 15 s (ikke N).
Tomme områder hentes aldri. Skalerer nesten gratis.

## Komponenter
- **Delt cache:** Upstash Redis eller Vercel KV (gratis-tier). Nødvendig fordi
  serverless-funksjoner er statsløse (in-memory deles ikke pålitelig).
- **Logikk:** i `webapp/api/ais.ts` — «sjekk-cache-eller-hent».
- **Ingen egen scheduler/cron** — TTL driver seg selv (Vercel Cron er dessuten kun
  minutt-granularitet, så 15-sek sentral poll er upraktisk uansett).

## Nøkkel-detaljer
- **Tile-størrelse:** avvei cache-treff vs. datamengde. Start ~0.25–0.5°.
- **TTL:** 15 s (matcher dagens polling).
- **Sikkerhet:** Barentswatch-nøkkel forblir kun server-side (som nå).
- **Fallback:** ved cache-feil → hent direkte (aldri blokker AIS).

## Når
Ikke nødvendig nå (få brukere i introperioden). Bygg **før** reell skala / lansering.
Lav risiko, isolert til `api/ais.ts` + én cache-tjeneste.
