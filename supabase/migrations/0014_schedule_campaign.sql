-- Chain the campaign resolver onto the same nightly run, after XP (it reads
-- that day's xp_events as combat damage, so XP must resolve first).
select cron.unschedule('resolve-xp-nightly');
select cron.schedule(
  'resolve-xp-nightly',
  '35 18 * * *',
  $$select resolve_xp_for_date(current_date); select resolve_campaign_for_date(current_date);$$
);
