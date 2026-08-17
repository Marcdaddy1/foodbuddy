-- FoodBuddy — 0004_private_config_and_refresh_support
--
-- `private_config` holds server-only secrets (currently the shared secret the
-- nightly catalog-refresh job presents). RLS is enabled with NO policies, so
-- anon and authenticated can read nothing; only the service role, which
-- bypasses RLS, can see it. Contrast with `app_config`, which is public-read.

create table if not exists public.private_config (
  key   text primary key,
  value text not null,
  created_at timestamptz not null default now()
);

comment on table public.private_config is
  'Server-only configuration. RLS on with no policies = service role only. Never expose through the client.';

alter table public.private_config enable row level security;

-- Belt and braces: even without policies, remove the grants entirely.
revoke all on public.private_config from anon, authenticated;

-- Shared secret for the refresh job. Generated server-side so it never passes
-- through a client or a log.
insert into public.private_config (key, value)
values ('refresh_cron_secret', encode(extensions.gen_random_bytes(32), 'hex'))
on conflict (key) do nothing;

-- Index used by the refresh job to pick the most-stale rows first.
create index if not exists products_off_last_fetched_at_idx
  on public.products (off_last_fetched_at asc nulls first);
