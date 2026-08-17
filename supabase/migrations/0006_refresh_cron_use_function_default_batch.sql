-- FoodBuddy — 0006_refresh_cron_use_function_default_batch
--
-- The schedule hard-coded {"batch": 40}, which overrode the function's own
-- default. Measured against Open Food Facts, 40 requests at the required 4.5s
-- pacing takes ~180s (past the wall clock) and trips OFF's ~15/min rate limit.
-- Sending no body lets the function use DEFAULT_BATCH (30 @ 4.5s ≈ 135s), which
-- measured 30/30 refreshed with zero throttling.
--
-- 30/night clears ~500 products every ~17 days, inside the 21-day staleness
-- threshold, so nothing ever goes stale for a user.

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
    timeout_milliseconds := 180000
  );
  $job$
);
