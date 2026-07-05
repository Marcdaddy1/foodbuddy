-- FoodBuddy — 0002_rls_policies
-- Row Level Security baseline for every table + profile auto-provisioning.
--
-- Model:
--   * User-owned tables  -> policies scoped to auth.uid().
--   * Lists              -> owner full access; members read (viewer) or
--                           read/write items (editor) via list_members.
--   * Catalog tables     -> SELECT for anon + authenticated; NO client write
--                           policies (service role bypasses RLS).
--   * app_config         -> public read, no client writes.
--   * profiles           -> auto-inserted by trigger on auth.users insert.

-- ---------------------------------------------------------------------------
-- Enable RLS on every table
-- ---------------------------------------------------------------------------

alter table public.profiles                enable row level security;
alter table public.dietary_profiles       enable row level security;
alter table public.products               enable row level security;
alter table public.ingredients            enable row level security;
alter table public.ingredient_explanations enable row level security;
alter table public.scan_history           enable row level security;
alter table public.favorites              enable row level security;
alter table public.lists                  enable row level security;
alter table public.list_items             enable row level security;
alter table public.list_members           enable row level security;
alter table public.app_config             enable row level security;

-- Defense in depth: even though no write policies exist for catalog/config
-- tables, also revoke write privileges from client roles.
revoke insert, update, delete on public.products               from anon, authenticated;
revoke insert, update, delete on public.ingredients            from anon, authenticated;
revoke insert, update, delete on public.ingredient_explanations from anon, authenticated;
revoke insert, update, delete on public.app_config             from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Profile auto-provisioning: insert a profiles row when an auth user is created
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Auto-creates a public.profiles row for every new auth.users row.';

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Helper functions for list access (SECURITY DEFINER avoids RLS recursion
-- between lists, list_items and list_members).
-- ---------------------------------------------------------------------------

create or replace function public.is_list_owner(p_list_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.lists l
    where l.id = p_list_id
      and l.owner_id = (select auth.uid())
  );
$$;

comment on function public.is_list_owner(uuid) is
  'True when the current user owns the list. SECURITY DEFINER to bypass RLS recursion.';

create or replace function public.is_list_member(p_list_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.list_members m
    where m.list_id = p_list_id
      and m.user_id = (select auth.uid())
  );
$$;

comment on function public.is_list_member(uuid) is
  'True when the current user is a member (any role) of the list.';

create or replace function public.can_edit_list(p_list_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_list_owner(p_list_id)
      or exists (
           select 1
           from public.list_members m
           where m.list_id = p_list_id
             and m.user_id = (select auth.uid())
             and m.role = 'editor'
         );
$$;

comment on function public.can_edit_list(uuid) is
  'True when the current user may write list items: list owner or editor member.';

revoke execute on function public.is_list_owner(uuid)  from anon;
revoke execute on function public.is_list_member(uuid) from anon;
revoke execute on function public.can_edit_list(uuid)  from anon;
grant  execute on function public.is_list_owner(uuid)  to authenticated;
grant  execute on function public.is_list_member(uuid) to authenticated;
grant  execute on function public.can_edit_list(uuid)  to authenticated;

-- ---------------------------------------------------------------------------
-- profiles — owner-only (insert normally happens via trigger; the insert
-- policy is a fallback for backfills from the client)
-- ---------------------------------------------------------------------------

create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- No delete policy: profiles are removed by the auth.users cascade
-- (account deletion), never directly by the client.

-- ---------------------------------------------------------------------------
-- dietary_profiles — SENSITIVE: strictly owner-only, full CRUD
-- ---------------------------------------------------------------------------

create policy "dietary_profiles_select_own"
  on public.dietary_profiles for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "dietary_profiles_insert_own"
  on public.dietary_profiles for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "dietary_profiles_update_own"
  on public.dietary_profiles for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "dietary_profiles_delete_own"
  on public.dietary_profiles for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Catalog tables — public read, no client writes (service role only)
-- ---------------------------------------------------------------------------

create policy "products_select_public"
  on public.products for select
  to anon, authenticated
  using (true);

create policy "ingredients_select_public"
  on public.ingredients for select
  to anon, authenticated
  using (true);

create policy "ingredient_explanations_select_public"
  on public.ingredient_explanations for select
  to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- app_config — public read, no client writes
-- ---------------------------------------------------------------------------

create policy "app_config_select_public"
  on public.app_config for select
  to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- scan_history — owner-only
-- ---------------------------------------------------------------------------

create policy "scan_history_select_own"
  on public.scan_history for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "scan_history_insert_own"
  on public.scan_history for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "scan_history_update_own"
  on public.scan_history for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "scan_history_delete_own"
  on public.scan_history for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- favorites — owner-only
-- ---------------------------------------------------------------------------

create policy "favorites_select_own"
  on public.favorites for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "favorites_insert_own"
  on public.favorites for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "favorites_update_own"
  on public.favorites for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "favorites_delete_own"
  on public.favorites for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- lists — owner full access; members can read lists they belong to
-- ---------------------------------------------------------------------------

create policy "lists_select_owner_or_member"
  on public.lists for select
  to authenticated
  using (
    (select auth.uid()) = owner_id
    or public.is_list_member(id)
  );

create policy "lists_insert_owner"
  on public.lists for insert
  to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "lists_update_owner"
  on public.lists for update
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "lists_delete_owner"
  on public.lists for delete
  to authenticated
  using ((select auth.uid()) = owner_id);

-- ---------------------------------------------------------------------------
-- list_items — read for owner + any member; write for owner + editor members
-- ---------------------------------------------------------------------------

create policy "list_items_select_owner_or_member"
  on public.list_items for select
  to authenticated
  using (
    public.is_list_owner(list_id)
    or public.is_list_member(list_id)
  );

create policy "list_items_insert_editor"
  on public.list_items for insert
  to authenticated
  with check (public.can_edit_list(list_id));

create policy "list_items_update_editor"
  on public.list_items for update
  to authenticated
  using (public.can_edit_list(list_id))
  with check (public.can_edit_list(list_id));

create policy "list_items_delete_editor"
  on public.list_items for delete
  to authenticated
  using (public.can_edit_list(list_id));

-- ---------------------------------------------------------------------------
-- list_members — owner manages membership; users can see and remove their
-- own membership (leave a list)
-- ---------------------------------------------------------------------------

create policy "list_members_select_owner_or_self"
  on public.list_members for select
  to authenticated
  using (
    public.is_list_owner(list_id)
    or (select auth.uid()) = user_id
  );

create policy "list_members_insert_owner"
  on public.list_members for insert
  to authenticated
  with check (public.is_list_owner(list_id));

create policy "list_members_update_owner"
  on public.list_members for update
  to authenticated
  using (public.is_list_owner(list_id))
  with check (public.is_list_owner(list_id));

create policy "list_members_delete_owner_or_self"
  on public.list_members for delete
  to authenticated
  using (
    public.is_list_owner(list_id)
    or (select auth.uid()) = user_id
  );
