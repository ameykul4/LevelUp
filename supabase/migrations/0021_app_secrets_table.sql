-- ALTER DATABASE ... SET requires superuser, which isn't available even
-- via the platform's admin API. Use a normal table instead: RLS with no
-- policies means anon/authenticated get zero rows, while SECURITY DEFINER
-- functions (owned by the table owner) read it fine, same as any other
-- table in this schema.
create table app_secrets (
  key text primary key,
  value text not null
);

alter table app_secrets enable row level security;

create or replace function check_and_send_reminders()
returns void
language plpgsql
security definer
as $$
declare
  u record;
  tz text;
  local_hour int;
  today date;
  day_start timestamptz;
  day_end timestamptz;
  water_ml numeric;
  water_frac numeric;
  took_photo boolean;
  function_url text := 'https://yysoevmtllpbbhhhwrmf.supabase.co/functions/v1/send-push';
  internal_secret text;
begin
  select value into internal_secret from app_secrets where key = 'internal_function_secret';

  for u in
    select distinct p.id as user_id, coalesce(p.timezone, 'Asia/Kolkata') as tz, p.water_target_ml
    from profiles p
    join push_subscriptions s on s.user_id = p.id
  loop
    tz := u.tz;
    local_hour := extract(hour from now() AT TIME ZONE tz);
    today := (now() AT TIME ZONE tz)::date;
    day_start := today::timestamp AT TIME ZONE tz;
    day_end := (today + 1)::timestamp AT TIME ZONE tz;

    if local_hour < 9 or local_hour >= 21 then
      continue;
    end if;

    if local_hour >= 15 and not exists (select 1 from reminder_log where user_id = u.user_id and reminder_type = 'water' and sent_on = today) then
      select coalesce(sum(amount_ml), 0) into water_ml from water_logs
        where user_id = u.user_id and logged_at >= day_start and logged_at < day_end;
      water_frac := case when coalesce(u.water_target_ml, 0) > 0 then water_ml / u.water_target_ml else 1 end;

      if water_frac < 0.7 then
        perform net.http_post(
          url := function_url,
          headers := jsonb_build_object('Content-Type', 'application/json', 'x-internal-secret', internal_secret),
          body := jsonb_build_object('user_id', u.user_id, 'title', '💧 Still time', 'body', 'You''re behind on water today — top up before evening.', 'url', '/')
        );
        insert into reminder_log (user_id, reminder_type, sent_on) values (u.user_id, 'water', today);
      end if;
    end if;

    if local_hour >= 19 and not exists (select 1 from reminder_log where user_id = u.user_id and reminder_type = 'photo' and sent_on = today) then
      select exists(select 1 from progress_photos where user_id = u.user_id and taken_at >= day_start and taken_at < day_end) into took_photo;

      if not took_photo then
        perform net.http_post(
          url := function_url,
          headers := jsonb_build_object('Content-Type', 'application/json', 'x-internal-secret', internal_secret),
          body := jsonb_build_object('user_id', u.user_id, 'title', '📸 Today''s photo', 'body', 'Quick one before bed? Keep the journey going.', 'url', '/photos')
        );
        insert into reminder_log (user_id, reminder_type, sent_on) values (u.user_id, 'photo', today);
      end if;
    end if;
  end loop;
end;
$$;
