select cron.unschedule('resolve-xp-nightly');
select cron.schedule(
  'resolve-xp-nightly',
  '35 18 * * *',
  $$select resolve_xp_for_date(current_date); select resolve_campaign_for_date(current_date); select resolve_garden_for_date(current_date);$$
);
