-- Oversikts-/dashboard-spørringer for Batkart.
-- Kjøres i Supabase SQL Editor (admin-kontekst → ser alle rader).
-- Kjør én blokk om gangen.

-- ── 1) Nøkkeltall (KPI) ────────────────────────────────────────────────────────
select
  (select count(*) from auth.users)                                as brukere,
  (select count(*) from public.boats)                              as bater,
  (select count(*) from public.trips)                              as turer,
  (select count(*) from public.entitlement where active)           as aktive_tilganger,
  (select count(*) from public.communications)                     as sendt_kommunikasjon;

-- ── 2) Nye brukere per måned ───────────────────────────────────────────────────
select date_trunc('month', created_at)::date as maaned, count(*) as nye_brukere
from auth.users
group by 1 order by 1 desc;

-- ── 3) Per-bruker sammendrag (CRM-rad) ─────────────────────────────────────────
select
  u.email,
  p.display_name                                   as eier,
  p.trial_ends_at,
  b.name                                           as bat,
  b.boat_type,
  count(distinct t.id)                             as antall_turer,
  round((coalesce(sum(t.distance_m),0)/1852.0)::numeric, 1)  as nm_totalt,
  round((coalesce(sum(t.duration_s),0)/3600.0)::numeric, 1)  as timer_totalt,
  bool_or(e.active and e.feature_key = 'premium')  as har_premium
from auth.users u
left join public.profiles p   on p.id = u.id
left join public.boats b      on b.user_id = u.id and b.is_default
left join public.trips t      on t.user_id = u.id
left join public.entitlement e on e.user_id = u.id
group by u.email, p.display_name, p.trial_ends_at, b.name, b.boat_type
order by antall_turer desc;

-- ── 4) Hvem har tilgang (gratis/premium) ───────────────────────────────────────
select u.email, e.feature_key, e.source, e.active, e.valid_until, e.updated_at
from public.entitlement e join auth.users u on u.id = e.user_id
order by e.updated_at desc;

-- ── 5) Introperiode som utløper neste 30 dager ─────────────────────────────────
select u.email, p.trial_ends_at
from public.profiles p join auth.users u on u.id = p.id
where p.trial_ends_at between now() and now() + interval '30 days'
order by p.trial_ends_at;

-- ── 6) Markedsføring-samtykke ──────────────────────────────────────────────────
select
  count(*) filter (where marketing_opt_in)     as paameldt,
  count(*) filter (where not marketing_opt_in) as ikke_paameldt
from public.profiles;

-- ── 7) Turer per måned + total distanse (nm) ───────────────────────────────────
select date_trunc('month', trip_date)::date as maaned,
       count(*) as turer,
       round((sum(distance_m)/1852.0)::numeric, 1) as nm
from public.trips
group by 1 order by 1 desc;

-- ── 8) Drivstoff-estimat per tur (forbruk × varighet) ──────────────────────────
select t.trip_date::date, t.name as tur, u.email, b.fuel_type,
       round((t.duration_s/3600.0)::numeric, 1)                       as timer,
       round((t.duration_s/3600.0 * b.fuel_cons_lph)::numeric, 1)     as liter_est
from public.trips t
join auth.users u on u.id = t.user_id
left join public.boats b on b.user_id = t.user_id and b.is_default
where b.fuel_cons_lph is not null
order by t.trip_date desc;

-- ── 9) Kommunikasjon sendt (per type/kanal) ────────────────────────────────────
select kind, channel, count(*) as antall, max(sent_at) as siste
from public.communications
group by 1, 2 order by 3 desc;

-- ── 10) Samtykke-historikk for én bruker (bytt e-post) ─────────────────────────
select c.kind, c.value, c.changed_at
from public.consent_log c join auth.users u on u.id = c.user_id
where u.email = 'din@epost.no'
order by c.changed_at desc;
