# Kurtly — Databáze

Celé schéma, RLS políčky a seed data pro Supabase (PostgreSQL).

---

## Migrace

```sql
-- supabase/migrations/0001_init.sql

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
```

---

## Row Level Security

```sql
-- supabase/migrations/0002_rls.sql

-- PROFILY
alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

-- Display name ostatních členů skupiny je viditelné (pro avatar overlay)
create policy "profiles_select_group_members"
  on public.profiles for select
  using (
    exists (
      select 1 from public.group_members gm1
      join public.group_members gm2 on gm1.group_id = gm2.group_id
      where gm1.user_id = auth.uid()
        and gm2.user_id = profiles.id
    )
  );

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

-- SKUPINY: vidí jen členové
alter table public.groups enable row level security;

create policy "groups_select_member"
  on public.groups for select
  using (
    exists (
      select 1 from public.group_members
      where group_id = id and user_id = auth.uid()
    )
  );

create policy "groups_insert_authenticated"
  on public.groups for insert
  with check (auth.role() = 'authenticated');

create policy "groups_update_admin"
  on public.groups for update
  using (
    exists (
      select 1 from public.group_members
      where group_id = id and user_id = auth.uid() and role = 'admin'
    )
  );

-- GROUP MEMBERS
alter table public.group_members enable row level security;

create policy "group_members_select_member"
  on public.group_members for select
  using (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = group_members.group_id and gm.user_id = auth.uid()
    )
  );

create policy "group_members_insert_self"
  on public.group_members for insert
  with check (user_id = auth.uid());

-- DOSTUPNOST: vlastní záznamy plná práva; záznamy skupiny jen čtení
alter table public.user_availability enable row level security;

create policy "availability_all_own"
  on public.user_availability for all
  using (user_id = auth.uid());

create policy "availability_select_group_members"
  on public.user_availability for select
  using (
    exists (
      select 1 from public.group_members gm1
      join public.group_members gm2 on gm1.group_id = gm2.group_id
      where gm1.user_id = auth.uid()
        and gm2.user_id = user_availability.user_id
        and gm1.group_id = user_availability.group_id
    )
  );

-- VENUE PREFERENCES
alter table public.venue_preferences enable row level security;

create policy "venue_preferences_own"
  on public.venue_preferences for all
  using (user_id = auth.uid());

create policy "venue_preferences_select_group"
  on public.venue_preferences for select
  using (
    exists (
      select 1 from public.group_members
      where group_id = venue_preferences.group_id and user_id = auth.uid()
    )
  );

-- VENUES + COURTS + SLOTS: čitelné pro všechny přihlášené
alter table public.venues enable row level security;
create policy "venues_read_authenticated"
  on public.venues for select
  using (auth.role() = 'authenticated');

alter table public.courts enable row level security;
create policy "courts_read_authenticated"
  on public.courts for select
  using (auth.role() = 'authenticated');

alter table public.slots enable row level security;
create policy "slots_read_authenticated"
  on public.slots for select
  using (auth.role() = 'authenticated');

-- MATCHES: vidí jen členové skupiny
alter table public.matches enable row level security;

create policy "matches_select_group_member"
  on public.matches for select
  using (
    exists (
      select 1 from public.group_members
      where group_id = matches.group_id and user_id = auth.uid()
    )
  );
```

---

## Seed data (vývojové prostředí)

```sql
-- supabase/seed.sql
-- Spustit: npx supabase db seed

-- Venues (haly pro V1 — scraper_config viz scrapers.md)
insert into public.venues (name, slug, address, city, sport, website_url, booking_url, scraper_key, scraper_config, is_active) values
(
  'Fit4All Nový Lískovec',
  'fit4all',
  'Chironova 544/8, 642 00 Brno',
  'Brno',
  '{badminton}',
  'https://www.fit4all.cz',
  'https://www.fit4all.cz/cs/online-rezervace?activity=6',
  'fit4all',
  '{"bookingUrl": "https://www.fit4all.cz/cs/online-rezervace", "activityId": 6, "horizonDays": 14}',
  true
),
(
  'Tenisová a badmintonová hala Sprint',
  'hala-sprint',
  'Sportovní 2A, 602 00 Brno-Královo Pole',
  'Brno',
  '{badminton,tenis}',
  'https://memberzone.cz/sprint_tenis/',
  'https://memberzone.cz/sprint_tenis/Sportoviste.aspx?ID_Sportoviste=3&NAZEV=Badminton+hala',
  'memberzone',
  '{"bookingUrl": "https://memberzone.cz/sprint_tenis/Sportoviste.aspx", "courtId": 3, "horizonDays": 14}',
  true  -- nastavit false pokud robots.txt potvrdí blokaci
),
(
  'Club Classic Brno',
  'club-classic',
  'Brno',
  'Brno',
  '{badminton,squash,tenis}',
  'https://www.clubclassic.cz',
  'https://rezervace.clubclassic.cz/?page=day_overview&id=22',
  'clubclassic',
  '{"bookingUrl": "https://rezervace.clubclassic.cz/", "venueId": 22, "horizonDays": 7, "waitBetweenRequestsMs": 2000}',
  false  -- zapnout až po ověření/souhlasu haly
);

-- Kurty pro Fit4All (4 badmintonové kurty)
with venue as (select id from public.venues where slug = 'fit4all')
insert into public.courts (venue_id, name, sport)
select venue.id, 'Kurt ' || n, 'badminton'
from venue, generate_series(1, 4) as n;

-- Kurty pro Halu Sprint (2 badmintonové kurty — ověřit skutečný počet)
with venue as (select id from public.venues where slug = 'hala-sprint')
insert into public.courts (venue_id, name, sport)
select venue.id, 'Dvorec ' || n, 'badminton'
from venue, generate_series(1, 2) as n;
```

---

## Drizzle ORM schéma

```typescript
// lib/db/schema.ts
import { pgTable, uuid, text, boolean, jsonb, integer,
         timestamp, time, numeric, uniqueIndex, primaryKey } from 'drizzle-orm/pg-core';

export const profiles = pgTable('profiles', {
  id:                 uuid('id').primaryKey(),
  displayName:        text('display_name').notNull(),
  avatarUrl:          text('avatar_url'),
  pushSubscription:   jsonb('push_subscription'),
  emailNotifications: boolean('email_notifications').default(true),
  pushNotifications:  boolean('push_notifications').default(true),
  createdAt:          timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const groups = pgTable('groups', {
  id:          uuid('id').primaryKey().defaultRandom(),
  name:        text('name').notNull(),
  sport:       text('sport').notNull().default('badminton'),
  city:        text('city').notNull().default('Brno'),
  inviteCode:  text('invite_code').unique().notNull(),
  createdBy:   uuid('created_by'),
  minPlayers:  integer('min_players').notNull().default(2),
  createdAt:   timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const venues = pgTable('venues', {
  id:            uuid('id').primaryKey().defaultRandom(),
  name:          text('name').notNull(),
  slug:          text('slug').unique().notNull(),
  address:       text('address'),
  city:          text('city').notNull().default('Brno'),
  bookingUrl:    text('booking_url'),
  scraperKey:    text('scraper_key').notNull(),
  scraperConfig: jsonb('scraper_config'),
  isActive:      boolean('is_active').default(true),
});

export const slots = pgTable('slots', {
  id:          uuid('id').primaryKey().defaultRandom(),
  venueId:     uuid('venue_id').notNull(),
  courtId:     uuid('court_id'),
  startsAt:    timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt:      timestamp('ends_at', { withTimezone: true }).notNull(),
  priceCzk:    numeric('price_czk', { precision: 8, scale: 2 }),
  isAvailable: boolean('is_available').notNull(),
  scrapedAt:   timestamp('scraped_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  uniq: uniqueIndex().on(t.courtId, t.startsAt),
}));

export const userAvailability = pgTable('user_availability', {
  id:          uuid('id').primaryKey().defaultRandom(),
  userId:      uuid('user_id').notNull(),
  groupId:     uuid('group_id').notNull(),
  type:        text('type').notNull().default('recurring'),
  dayOfWeek:   integer('day_of_week'),
  timeFrom:    time('time_from'),
  timeTo:      time('time_to'),
  startsAt:    timestamp('starts_at', { withTimezone: true }),
  endsAt:      timestamp('ends_at', { withTimezone: true }),
  isException: boolean('is_exception').default(false),
});

export const matches = pgTable('matches', {
  id:          uuid('id').primaryKey().defaultRandom(),
  groupId:     uuid('group_id').notNull(),
  slotId:      uuid('slot_id').notNull(),
  score:       numeric('score', { precision: 4, scale: 2 }),
  notifiedAt:  timestamp('notified_at', { withTimezone: true }),
  createdAt:   timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  uniq: uniqueIndex().on(t.groupId, t.slotId),
}));
```
