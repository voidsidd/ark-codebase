-- ============================================================
-- VANGUARD — Supabase Schema Migration
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Extensions
create extension if not exists "uuid-ossp";

-- ─── PROFILES ────────────────────────────────────────────────
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role         text not null check (role in ('government', 'private')) default 'private',
  created_at   timestamptz not null default now()
);

-- ─── PARKS (government, seeded) ──────────────────────────────
create table public.parks (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  country     text not null,
  center_lat  double precision not null,
  center_lon  double precision not null,
  boundary    jsonb,  -- GeoJSON Polygon (WGS84)
  zone_count  int not null default 0,
  created_at  timestamptz not null default now()
);

-- ─── ESTATES (private users) ─────────────────────────────────
create table public.estates (
  id            uuid primary key default uuid_generate_v4(),
  owner_id      uuid not null references public.profiles(id) on delete cascade,
  name          text not null,
  boundary      jsonb not null,  -- GeoJSON Polygon (WGS84)
  centroid_lat  double precision,
  centroid_lon  double precision,
  area_ha       double precision,
  perimeter_km  double precision,
  created_at    timestamptz not null default now()
);

-- ─── ZONES (linked to park OR estate, not both) ───────────────
create table public.zones (
  id         uuid primary key default uuid_generate_v4(),
  park_id    uuid references public.parks(id) on delete cascade,
  estate_id  uuid references public.estates(id) on delete cascade,
  name       text not null,
  status     text not null check (status in ('critical', 'warning', 'normal')) default 'normal',
  polygon    jsonb not null,  -- GeoJSON Polygon (WGS84)
  created_at timestamptz not null default now(),
  constraint zone_has_single_parent check (
    (park_id is not null and estate_id is null) or
    (park_id is null and estate_id is not null)
  )
);

-- ─── ALERTS ──────────────────────────────────────────────────
create table public.alerts (
  id          uuid primary key default uuid_generate_v4(),
  park_id     uuid references public.parks(id),
  estate_id   uuid references public.estates(id),
  zone_id     uuid references public.zones(id),
  type        text not null,
  description text,
  confidence  int,
  lat         double precision,
  lon         double precision,
  created_at  timestamptz not null default now()
);

-- ─── ROW LEVEL SECURITY ──────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.parks    enable row level security;
alter table public.estates  enable row level security;
alter table public.zones    enable row level security;
alter table public.alerts   enable row level security;

-- Profiles: own row only
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

-- Parks: public read
create policy "parks_select_all"    on public.parks    for select using (true);

-- Estates: owner only
create policy "estates_select_own"  on public.estates  for select using (auth.uid() = owner_id);
create policy "estates_insert_own"  on public.estates  for insert with check (auth.uid() = owner_id);
create policy "estates_update_own"  on public.estates  for update using (auth.uid() = owner_id);
create policy "estates_delete_own"  on public.estates  for delete using (auth.uid() = owner_id);

-- Zones: park zones = public read; estate zones = owner only
create policy "zones_select_park"   on public.zones    for select using (park_id is not null);
create policy "zones_select_estate" on public.zones    for select using (
  estate_id is not null and
  exists (select 1 from public.estates where id = zones.estate_id and owner_id = auth.uid())
);
create policy "zones_insert_estate" on public.zones    for insert with check (
  estate_id is not null and
  exists (select 1 from public.estates where id = zones.estate_id and owner_id = auth.uid())
);

-- Alerts: park alerts = public read; estate alerts = owner only
create policy "alerts_select_park"   on public.alerts  for select using (park_id is not null);
create policy "alerts_select_estate" on public.alerts  for select using (
  estate_id is not null and
  exists (select 1 from public.estates where id = alerts.estate_id and owner_id = auth.uid())
);

-- ─── AUTO-CREATE PROFILE ON SIGNUP ───────────────────────────
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    'private'  -- all signups are private; government must be set by admin
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── SEED PARKS ──────────────────────────────────────────────
insert into public.parks (id, name, country, center_lat, center_lon) values
  ('11111111-1111-1111-1111-111111111111', 'Nagarhole National Park',       'India',        11.9833,  76.1167),
  ('22222222-2222-2222-2222-222222222222', 'Jim Corbett National Park',     'India',        29.5300,  78.7747),
  ('33333333-3333-3333-3333-333333333333', 'Kaziranga National Park',       'India',        26.5775,  93.1711),
  ('44444444-4444-4444-4444-444444444444', 'Sundarbans National Park',      'India',        21.9497,  88.9468),
  ('55555555-5555-5555-5555-555555555555', 'Maasai Mara National Reserve',  'Kenya',        -1.4061,  35.1019),
  ('66666666-6666-6666-6666-666666666666', 'Kruger National Park',          'South Africa', -23.9884, 31.5547);

-- ─── ADMIN: Assign government role to a specific email ────────
-- Run this manually for each government user after they sign up:
--
-- update public.profiles
-- set role = 'government'
-- where id = (select id from auth.users where email = 'ranger@forestdept.gov');
