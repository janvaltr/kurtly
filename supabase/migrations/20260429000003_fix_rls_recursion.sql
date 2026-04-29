-- 1. Funkce pro přerušení rekureze (běží jako SECURITY DEFINER)
create or replace function public.get_my_groups()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select group_id from public.group_members where user_id = auth.uid();
$$;

-- 2. Oprava politik pro GROUP_MEMBERS
drop policy if exists "group_members_select_member" on public.group_members;
create policy "group_members_select_member"
  on public.group_members for select
  using (
    user_id = auth.uid() 
    or 
    group_id in (select public.get_my_groups())
  );

-- 3. Oprava politik pro GROUPS
drop policy if exists "groups_select_member" on public.groups;
create policy "groups_select_member"
  on public.groups for select
  using (
    created_by = auth.uid() -- tvůrce vidí vždy (řeší chybu při vytváření)
    or 
    id in (select public.get_my_groups())
  );

-- 4. Oprava PROFILŮ (aby se členové viděli navzájem)
drop policy if exists "profiles_select_group_members" on public.profiles;
create policy "profiles_select_group_members"
  on public.profiles for select
  using (
    exists (
      select 1 from public.group_members
      where group_id in (select public.get_my_groups())
        and user_id = profiles.id
    )
  );
