-- FoodBuddy — 0005_schedule_nightly_catalog_refresh
--
-- Keeps the product catalog inside the client's 30-day freshness window.
-- Superseded in part by 0006, which drops the hard-coded batch size.
--
-- The secret is read from private_config at call time rather than baked into
-- the schedule, so rotating it needs no cron change and it never appears in
-- cron.job for a dashboard reader to copy.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.unschedule('refresh-stale-products')
where exists (select 1 from cron.job where jobname = 'refresh-stale-products');

select cron.schedule(
  'refresh-stale-products',
  '0 3 * * *',
  $job$
  select net.http_post(
    url := 'https://uytsmrunqexuqtvwztlz.supabase.co/functions/v1/refresh-stale-products',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select value from public.private_config where key = 'refresh_cron_secret')
    ),
    body := '{"batch": 40}'::jsonb,
    timeout_milliseconds := 120000
  );
  $job$
);
