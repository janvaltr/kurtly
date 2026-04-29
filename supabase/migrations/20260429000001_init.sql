create extension if not exists "pg_cron";
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────
-- PROFILY (rozšíření Supabase Auth)
-- ─────────────────────────────────────────
create table public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  display_name        text not null,
  avatar_url          text,
  push_subscription   jsonb,          -- Web Push API subscription objekt
  email_notifications boolean default true,
  push_notifications  boolean default true,
  created_at          timestamptz default now()
);

-- Automaticky vytvoř profil při registraci uživatele
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles(id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─────────────────────────────────────────
-- SKUPINY
-- ─────────────────────────────────────────
create table public.groups (
  id           uuid primary key default uuid_generate_v4(),
  name         text not null,
  description  text,
  sport        text not null default 'badminton',   -- rozšiřitelné: squash, tenis...
  city         text not null default 'Brno',
  invite_code  text unique not null,                -- 8-znakový kód pro pozvání
  created_by   uuid references public.profiles(id),
  min_players  int not null default 2,              -- kolik členů musí být dostupných
  created_at   timestamptz default now()
);

create table public.group_members (
  group_id  uuid references public.groups(id) on delete cascade,
  user_id   uuid references public.profiles(id) on delete cascade,
  role      text not null default 'member',         -- 'admin' | 'member'
  joined_at timestamptz default now(),
  primary key (group_id, user_id)
);

-- ─────────────────────────────────────────
-- SPORTOVIŠTĚ
-- ─────────────────────────────────────────
create table public.venues (
  id             uuid primary key default uuid_generate_v4(),
  name           text not null,
  slug           text unique not null,              -- 'fit4all', 'hala-sprint'
  address        text,
  city           text not null default 'Brno',
  sport          text[] not null default '{badminton}',
  website_url    text,
  booking_url    text,                              -- přímý odkaz pro rezervaci
  scraper_key    text not null,                     -- mapuje na implementaci v SCRAPER_REGISTRY
  scraper_config jsonb,                             -- konfigurace předávaná do scraper.scrape()
  is_active      boolean default true,
  logo_url       text,
  created_at     timestamptz default now()
);

create table public.courts (
  id       uuid primary key default uuid_generate_v4(),
  venue_id uuid references public.venues(id) on delete cascade,
  name     text not null,                           -- 'Kurt 1', 'Kurt 2'...
  sport    text not null default 'badminton'
);

-- ─────────────────────────────────────────
-- SCRAPOVANÉ SLOTY
-- ─────────────────────────────────────────
create table public.slots (
  id           uuid primary key default uuid_generate_v4(),
  venue_id     uuid references public.venues(id) on delete cascade,
  court_id     uuid references public.courts(id),
  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  duration_min int generated always as (
    extract(epoch from (ends_at - starts_at)) / 60
  ) stored,
  price_czk    numeric(8,2),
  is_available boolean not null,
  scraped_at   timestamptz default now(),
  unique(court_id, starts_at)                       -- jeden slot = jeden dvorec × čas
);

-- Index pro rychlé dotazy matching enginu
create index idx_slots_available_time
  on public.slots(is_available, starts_at)
  where is_available = true;

-- ─────────────────────────────────────────
-- DOSTUPNOST UŽIVATELŮ
-- ─────────────────────────────────────────
create table public.user_availability (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid references public.profiles(id) on delete cascade,
  group_id     uuid references public.groups(id) on delete cascade,
  type         text not null default 'recurring',   -- 'recurring' | 'oneoff'
  -- Pro recurring (opakující se každý týden):
  day_of_week  int,                                 -- 0=Po, 1=Út, ..., 6=Ne
  time_from    time,
  time_to      time,
  -- Pro oneoff (jednorázové):
  starts_at    timestamptz,
  ends_at      timestamptz,
  -- Výjimka: uživatel NENÍ dostupný v tento jinak recurring slot
  is_exception boolean default false,
  created_at   timestamptz default now()
);

-- ─────────────────────────────────────────
-- PREFERENCE HAL (per uživatel per skupina)
-- ─────────────────────────────────────────
create table public.venue_preferences (
  group_id uuid references public.groups(id) on delete cascade,
  user_id  uuid references public.profiles(id) on delete cascade,
  venue_id uuid references public.venues(id) on delete cascade,
  rank     int not null default 1,                  -- 1 = nejvíce preferovaná
  primary key (group_id, user_id, venue_id)
);

-- ─────────────────────────────────────────
-- MATCHOVÁNÍ A NOTIFIKACE
-- ─────────────────────────────────────────
create table public.matches (
  id           uuid primary key default uuid_generate_v4(),
  group_id     uuid references public.groups(id) on delete cascade,
  slot_id      uuid references public.slots(id) on delete cascade,
  score        numeric(4,2),                        -- průměrný rank preference (nižší = lepší)
  notified_at  timestamptz,                         -- null = notifikace ještě neodešla
  confirmed_by uuid[],                              -- uživatelé kteří potvrdili účast
  created_at   timestamptz default now(),
  unique(group_id, slot_id)
);

create table public.notifications_log (
  id       uuid primary key default uuid_generate_v4(),
  match_id uuid references public.matches(id),
  user_id  uuid references public.profiles(id),
  channel  text not null,                           -- 'push' | 'email'
  sent_at  timestamptz default now(),
  status   text                                     -- 'sent' | 'failed'
);
