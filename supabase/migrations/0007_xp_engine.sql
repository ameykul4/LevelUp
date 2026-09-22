-- Phase 5 — the §7.5 XP economy, run nightly by pg_cron (§8.5A).
-- Server-side only: the client never claims its own XP.

create extension if not exists pg_cron;

-- idempotency key: re-running the same (user, category, day) is a no-op
alter table xp_events add column for_date date not null default current_date;
alter table xp_events add constraint xp_events_unique_per_day unique (user_id, reason, for_date);

-- track how far the resolver has processed each user, and the freeze-regen counter
alter table streaks add column last_resolved_date date;
alter table streaks add column full_days_since_regen int default 0;

create or replace function resolve_xp_for_date(target_date date)
returns void
language plpgsql
security definer
as $$
declare
  u record;
  day_start timestamptz;
  day_end timestamptz;
  water_ml numeric;
  protein_g numeric;
  did_checkin boolean;
  sleep_good boolean;
  took_photo boolean;
  did_rest boolean;
  did_workout boolean;
  water_frac numeric;
  protein_frac numeric;
  amt int;
  total_amt int;
  full_day boolean;
  showed_up boolean;
  new_full_days int;
  new_freezes int;
begin
  for u in
    select p.id as user_id, p.water_target_ml, p.target_protein_g, coalesce(p.timezone, 'Asia/Kolkata') as tz
    from profiles p
    join streaks s on s.user_id = p.id
    where s.last_resolved_date is null or s.last_resolved_date < target_date
  loop
    -- day boundaries in the USER's own local timezone, not the DB session's (§8.5A correctness:
    -- water_logs/meals/progress_photos are timestamptz written from correctly-computed local days,
    -- so bucketing them back into a day must use the same timezone, not a naive UTC cast).
    day_start := target_date::timestamp AT TIME ZONE u.tz;
    day_end := (target_date + 1)::timestamp AT TIME ZONE u.tz;

    select coalesce(sum(amount_ml), 0) into water_ml
      from water_logs where user_id = u.user_id and logged_at >= day_start and logged_at < day_end;

    select coalesce(sum(protein_g), 0) into protein_g
      from meals where user_id = u.user_id and logged_at >= day_start and logged_at < day_end;

    select exists(select 1 from daily_checkins where user_id = u.user_id and checkin_date = target_date) into did_checkin;
    select coalesce((select sleep_quality >= 4 from daily_checkins where user_id = u.user_id and checkin_date = target_date), false) into sleep_good;
    select exists(select 1 from progress_photos where user_id = u.user_id and taken_at >= day_start and taken_at < day_end) into took_photo;
    select exists(select 1 from workouts where user_id = u.user_id and done_on = target_date and workout_type in ('rest', 'mobility')) into did_rest;
    select exists(select 1 from workouts where user_id = u.user_id and done_on = target_date and workout_type in ('strength', 'cardio')) into did_workout;

    water_frac := case when coalesce(u.water_target_ml, 0) > 0 then least(water_ml / u.water_target_ml, 1.0) else 0 end;
    protein_frac := case when coalesce(u.target_protein_g, 0) > 0 then least(protein_g / u.target_protein_g, 1.0) else 0 end;

    total_amt := 0;

    -- checkin: 5, binary
    amt := case when did_checkin then 5 else 0 end;
    if amt > 0 then
      insert into xp_events (user_id, amount, reason, for_date) values (u.user_id, amt, 'checkin', target_date)
        on conflict (user_id, reason, for_date) do nothing;
    end if;
    total_amt := total_amt + amt;

    -- water: 10, partial credit from 70%, +20% finish bonus (§7.5E)
    amt := case when water_frac >= 1.0 then round(10 * 1.2) when water_frac >= 0.7 then round(10 * water_frac) else 0 end;
    if amt > 0 then
      insert into xp_events (user_id, amount, reason, for_date) values (u.user_id, amt, 'water', target_date)
        on conflict (user_id, reason, for_date) do nothing;
    end if;
    total_amt := total_amt + amt;

    -- sleep: 10, binary — proxy via check-in slider until objective sleep data exists (Phase 6)
    amt := case when sleep_good then 10 else 0 end;
    if amt > 0 then
      insert into xp_events (user_id, amount, reason, for_date) values (u.user_id, amt, 'sleep', target_date)
        on conflict (user_id, reason, for_date) do nothing;
    end if;
    total_amt := total_amt + amt;

    -- photo: 10, binary
    amt := case when took_photo then 10 else 0 end;
    if amt > 0 then
      insert into xp_events (user_id, amount, reason, for_date) values (u.user_id, amt, 'photo', target_date)
        on conflict (user_id, reason, for_date) do nothing;
    end if;
    total_amt := total_amt + amt;

    -- rest: 15, binary (rest/mobility day logged)
    amt := case when did_rest then 15 else 0 end;
    if amt > 0 then
      insert into xp_events (user_id, amount, reason, for_date) values (u.user_id, amt, 'rest', target_date)
        on conflict (user_id, reason, for_date) do nothing;
    end if;
    total_amt := total_amt + amt;

    -- protein: 20, partial credit from 70%, +20% finish bonus
    amt := case when protein_frac >= 1.0 then round(20 * 1.2) when protein_frac >= 0.7 then round(20 * protein_frac) else 0 end;
    if amt > 0 then
      insert into xp_events (user_id, amount, reason, for_date) values (u.user_id, amt, 'protein', target_date)
        on conflict (user_id, reason, for_date) do nothing;
    end if;
    total_amt := total_amt + amt;

    -- workout: 25, binary
    amt := case when did_workout then 25 else 0 end;
    if amt > 0 then
      insert into xp_events (user_id, amount, reason, for_date) values (u.user_id, amt, 'workout', target_date)
        on conflict (user_id, reason, for_date) do nothing;
    end if;
    total_amt := total_amt + amt;

    -- daily cap (§7.5B): clip the day's total to 100 with a visible adjustment event
    if total_amt > 100 then
      insert into xp_events (user_id, amount, reason, for_date)
        values (u.user_id, 100 - total_amt, 'daily_cap_adjustment', target_date)
        on conflict (user_id, reason, for_date) do nothing;
    end if;

    -- water-drop economy (§7.7): +1 drop for hitting the water target that day
    if water_frac >= 1.0 then
      insert into water_drops (user_id, balance) values (u.user_id, 1)
        on conflict (user_id) do update set balance = water_drops.balance + 1;
    end if;

    -- "fully completed" = the 3 core, always-generated categories all hit
    full_day := water_frac >= 1.0 and protein_frac >= 1.0 and (did_workout or did_rest);
    showed_up := did_checkin or water_frac > 0 or protein_frac > 0 or did_workout or did_rest;

    -- streak (§7.5E, §2.5): showing up grows it; a miss spends a freeze before it ever decays
    if showed_up then
      select full_days_since_regen, freezes_available into new_full_days, new_freezes
        from streaks where user_id = u.user_id;

      if full_day then
        new_full_days := new_full_days + 1;
      end if;
      if full_day and new_full_days >= 5 then
        new_freezes := least(new_freezes + 1, 3);
        new_full_days := 0;
      end if;

      update streaks
        set current_streak = current_streak + 1,
            longest_streak = greatest(longest_streak, current_streak + 1),
            last_active_date = target_date,
            full_days_since_regen = new_full_days,
            freezes_available = new_freezes
        where user_id = u.user_id;
    elsif (select freezes_available from streaks where user_id = u.user_id) > 0 then
      update streaks set freezes_available = freezes_available - 1 where user_id = u.user_id;
    else
      update streaks set current_streak = greatest(current_streak - 3, 0) where user_id = u.user_id;
    end if;

    -- loot drop on a fully completed day (§7.6 "loot drop" set piece renders this client-side)
    if full_day then
      insert into loot_drops (user_id, type, payload)
        values (u.user_id, 'daily_full_house', jsonb_build_object('date', target_date));
    end if;

    update streaks set last_resolved_date = target_date where user_id = u.user_id;
  end loop;
end;
$$;

-- Nightly at 00:05 IST = 18:35 UTC. At that instant, UTC's current_date already equals the IST
-- calendar day that just ended (IST midnight lands at UTC 18:30 the same UTC calendar date), so
-- this resolves the day that just completed, not the day still in progress.
select cron.schedule('resolve-xp-nightly', '35 18 * * *', $$select resolve_xp_for_date(current_date)$$);
