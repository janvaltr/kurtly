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
