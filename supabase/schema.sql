-- Batkart – Supabase schema for turlagring (per bruker, båt klar for senere)
-- Kjør i Supabase SQL Editor. Trygt å kjøre flere ganger (idempotent).

-- ── Tabell ────────────────────────────────────────────────────────────────────
create table if not exists public.trips (
  id            text primary key default gen_random_uuid()::text,  -- delt id lokalt/sky
  user_id       uuid not null references auth.users (id) on delete cascade,
  boat_id       uuid,                       -- null nå; brukes når båt-velger kommer
  name          text not null,
  trip_date     timestamptz not null default now(),
  distance_m    double precision not null default 0,
  duration_s    integer not null default 0,
  avg_speed_ms  double precision not null default 0,
  max_speed_ms  double precision not null default 0,
  icon          text,
  points        jsonb not null default '[]'::jsonb,   -- [{lat,lng}, ...]
  created_at    timestamptz not null default now()
);

create index if not exists trips_user_id_idx on public.trips (user_id);
create index if not exists trips_user_date_idx on public.trips (user_id, trip_date desc);

-- ── Tilgang: gi innlogget rolle rett til tabellen (RLS styrer hvilke rader) ─────
grant select, insert, update, delete on public.trips to authenticated;

-- ── Row Level Security: hver bruker ser/endrer kun egne turer ──────────────────
alter table public.trips enable row level security;

drop policy if exists "trips_select_own" on public.trips;
create policy "trips_select_own" on public.trips
  for select using (auth.uid() = user_id);

drop policy if exists "trips_insert_own" on public.trips;
create policy "trips_insert_own" on public.trips
  for insert with check (auth.uid() = user_id);

drop policy if exists "trips_update_own" on public.trips;
create policy "trips_update_own" on public.trips
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "trips_delete_own" on public.trips;
create policy "trips_delete_own" on public.trips
  for delete using (auth.uid() = user_id);
