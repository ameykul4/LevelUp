-- "Cover for me" (§7.4E, §8.5D): a low-energy check-in raises a signal the
-- OTHER partner can act on with an explicit Confirm — never silent, never
-- auto-consumed. Finite: one cover per person per week.

alter table cover_events add column for_date date not null default current_date;
alter table cover_events add constraint cover_events_one_per_week unique (couple_id, covered_by, week_of);

create or replace function spend_cover(covered_for_user uuid, cover_for_date date)
returns void
language plpgsql
security definer
as $$
declare
  my_couple_id uuid;
  their_couple_id uuid;
  week_start date;
begin
  select couple_id into my_couple_id from couple_members where user_id = auth.uid();
  select couple_id into their_couple_id from couple_members where user_id = covered_for_user;

  if my_couple_id is null or my_couple_id <> their_couple_id then
    raise exception 'Not paired with that user';
  end if;

  week_start := date_trunc('week', cover_for_date)::date;

  insert into cover_events (couple_id, covered_by, covered_for, week_of, for_date)
    values (my_couple_id, auth.uid(), covered_for_user, week_start, cover_for_date);
end;
$$;

grant execute on function spend_cover(uuid, date) to authenticated;

-- resolver: a covered day counts as "showed up" even with zero logged
-- activity, so the streak/freeze never sees the shortfall (§7.4E).
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
  protein_total_g numeric;
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
  was_covered boolean;
  new_full_days int;
  new_freezes int;
begin
  for u in
    select p.id as user_id, p.water_target_ml, p.target_protein_g, coalesce(p.timezone, 'Asia/Kolkata') as tz
    from profiles p
    join streaks s on s.user_id = p.id
    where s.last_resolved_date is null or s.last_resolved_date < target_date
  loop
    day_start := target_date::timestamp AT TIME ZONE u.tz;
    day_end := (target_date + 1)::timestamp AT TIME ZONE u.tz;

    select coalesce(sum(amount_ml), 0) into water_ml
      from water_logs where user_id = u.user_id and logged_at >= day_start and logged_at < day_end;

    select coalesce(sum(protein_g), 0) into protein_total_g
      from meals where user_id = u.user_id and logged_at >= day_start and logged_at < day_end;

    select exists(select 1 from daily_checkins where user_id = u.user_id and checkin_date = target_date) into did_checkin;
    select coalesce((select sleep_quality >= 4 from daily_checkins where user_id = u.user_id and checkin_date = target_date), false) into sleep_good;
    select exists(select 1 from progress_photos where user_id = u.user_id and taken_at >= day_start and taken_at < day_end) into took_photo;
    select exists(select 1 from workouts where user_id = u.user_id and done_on = target_date and workout_type in ('rest', 'mobility')) into did_rest;
    select exists(select 1 from workouts where user_id = u.user_id and done_on = target_date and workout_type in ('strength', 'cardio')) into did_workout;
    select exists(select 1 from cover_events where covered_for = u.user_id and for_date = target_date) into was_covered;

    water_frac := case when coalesce(u.water_target_ml, 0) > 0 then least(water_ml / u.water_target_ml, 1.0) else 0 end;
    protein_frac := case when coalesce(u.target_protein_g, 0) > 0 then least(protein_total_g / u.target_protein_g, 1.0) else 0 end;

    total_amt := 0;

    amt := case when did_checkin then 5 else 0 end;
    if amt > 0 then
      insert into xp_events (user_id, amount, reason, for_date) values (u.user_id, amt, 'checkin', target_date)
        on conflict (user_id, reason, for_date) do nothing;
    end if;
    total_amt := total_amt + amt;

    amt := case when water_frac >= 1.0 then round(10 * 1.2) when water_frac >= 0.7 then round(10 * water_frac) else 0 end;
    if amt > 0 then
      insert into xp_events (user_id, amount, reason, for_date) values (u.user_id, amt, 'water', target_date)
        on conflict (user_id, reason, for_date) do nothing;
    end if;
    total_amt := total_amt + amt;

    amt := case when sleep_good then 10 else 0 end;
    if amt > 0 then
      insert into xp_events (user_id, amount, reason, for_date) values (u.user_id, amt, 'sleep', target_date)
        on conflict (user_id, reason, for_date) do nothing;
    end if;
    total_amt := total_amt + amt;

    amt := case when took_photo then 10 else 0 end;
    if amt > 0 then
      insert into xp_events (user_id, amount, reason, for_date) values (u.user_id, amt, 'photo', target_date)
        on conflict (user_id, reason, for_date) do nothing;
    end if;
    total_amt := total_amt + amt;

    amt := case when did_rest then 15 else 0 end;
    if amt > 0 then
      insert into xp_events (user_id, amount, reason, for_date) values (u.user_id, amt, 'rest', target_date)
        on conflict (user_id, reason, for_date) do nothing;
    end if;
    total_amt := total_amt + amt;

    amt := case when protein_frac >= 1.0 then round(20 * 1.2) when protein_frac >= 0.7 then round(20 * protein_frac) else 0 end;
    if amt > 0 then
      insert into xp_events (user_id, amount, reason, for_date) values (u.user_id, amt, 'protein', target_date)
        on conflict (user_id, reason, for_date) do nothing;
    end if;
    total_amt := total_amt + amt;

    amt := case when did_workout then 25 else 0 end;
    if amt > 0 then
      insert into xp_events (user_id, amount, reason, for_date) values (u.user_id, amt, 'workout', target_date)
        on conflict (user_id, reason, for_date) do nothing;
    end if;
    total_amt := total_amt + amt;

    if total_amt > 100 then
      insert into xp_events (user_id, amount, reason, for_date)
        values (u.user_id, 100 - total_amt, 'daily_cap_adjustment', target_date)
        on conflict (user_id, reason, for_date) do nothing;
    end if;

    if water_frac >= 1.0 then
      insert into water_drops (user_id, balance) values (u.user_id, 1)
        on conflict (user_id) do update set balance = water_drops.balance + 1;
    end if;

    full_day := water_frac >= 1.0 and protein_frac >= 1.0 and (did_workout or did_rest);
    showed_up := total_amt > 0 or was_covered;

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

    if full_day then
      insert into loot_drops (user_id, type, payload)
        values (u.user_id, 'daily_full_house', jsonb_build_object('date', target_date));
    end if;

    update streaks set last_resolved_date = target_date where user_id = u.user_id;
  end loop;
end;
$$;
