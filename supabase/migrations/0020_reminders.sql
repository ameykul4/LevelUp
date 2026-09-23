-- Phase 8: scheduled reminder nudges via pg_net -> send-push. Quiet hours
-- are enforced by only scheduling cron fires during daytime UTC-equivalent
-- windows for IST (the app's primary timezone); the function itself also
-- re-checks each user's local hour as a safety net for anyone in a
-- different timezone.

create extension if not exists pg_net;

create table reminder_log (
  user_id uuid references profiles on delete cascade,
  reminder_type text not null,
  sent_on date not null,
  sent_at timestamptz default now(),
  primary key (user_id, reminder_type, sent_on)
);

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
  internal_secret text := current_setting('app.internal_function_secret', true);
begin
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

    -- quiet hours: never between 9pm and 9am local time, regardless of cron timing
    if local_hour < 9 or local_hour >= 21 then
      continue;
    end if;

    -- water nudge, afternoon-onward, once per day, only if meaningfully behind
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

    -- photo nudge, evening only, once per day
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

-- The app.internal_function_secret database setting that check_and_send_reminders()
-- reads is set out-of-band (not in a migration) so the secret never enters git history.

-- fire a few times across the afternoon/evening UTC window (covers ~1:30pm-9:30pm IST);
-- the function's own local_hour + reminder_log checks keep this idempotent and quiet-hours-safe
select cron.schedule('send-reminders', '0 10,13,15 * * *', $$select check_and_send_reminders()$$);
