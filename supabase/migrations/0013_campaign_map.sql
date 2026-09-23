-- Phase 7 (2/4): the campaign map (§7.4A) + co-op boss (§7.4B), simplified
-- per the "clean CSS/SVG, real mechanics" scope: landmarks are a fixed
-- waypoint list (editable later), damage uses each partner's already-computed
-- daily XP as a stand-in for the full macros-as-movesets system (shields/
-- evasion/buffs are deferred — this is honest completion-based damage, not
-- a fake number). No escape/respawn-tougher cycle yet; the boss simply
-- blocks progress until defeated.

-- one waypoint per row; ~142km Mumbai-Pune-corridor-style route (§7.4A example)
create table campaign_landmarks (
  distance_km numeric primary key,
  name text not null,
  biome text not null
);

insert into campaign_landmarks (distance_km, name, biome) values
  (20, 'Panvel', 'coast_dry'),
  (45, 'Khopoli', 'ghats_foothills'),
  (65, 'Khandala Ghat', 'ghats_rain'),
  (75, 'Lonavla', 'ghats_rain'),
  (100, 'Talegaon', 'plains_dry'),
  (142, 'Journey''s End', 'plains_dry');

alter table campaign_landmarks enable row level security;
create policy "campaign_landmarks: readable by all authenticated" on campaign_landmarks
  for select using (auth.role() = 'authenticated');

create or replace function ensure_campaign_map(for_couple_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  insert into campaign_map (couple_id, total_distance_km, distance_covered_km, current_landmark, season, biome)
    values (for_couple_id, 142, 0, null, 'Launch', 'coast_dry')
    on conflict (couple_id) do nothing;
end;
$$;

-- called from redeem_invite_code so a fresh pair starts their map immediately
create or replace function redeem_invite_code(input_code text)
returns uuid
language plpgsql
security definer
as $$
declare
  inviter uuid;
  new_couple_id uuid;
begin
  select created_by into inviter
  from invite_codes
  where code = upper(input_code)
    and expires_at > now()
    and consumed_by is null;

  if inviter is null then
    raise exception 'Invalid or expired invite code';
  end if;

  if inviter = auth.uid() then
    raise exception 'Cannot redeem your own invite code';
  end if;

  insert into couples (couple_name) values (null) returning id into new_couple_id;
  insert into couple_members (couple_id, user_id) values (new_couple_id, inviter), (new_couple_id, auth.uid());

  update invite_codes set consumed_by = auth.uid(), consumed_at = now() where code = upper(input_code);

  update profiles set cold_start_done = true where id in (inviter, auth.uid());

  perform ensure_campaign_map(new_couple_id);

  return new_couple_id;
end;
$$;

create or replace function resolve_campaign_for_date(target_date date)
returns void
language plpgsql
security definer
as $$
declare
  c record;
  member_a uuid;
  member_b uuid;
  dmg_a int;
  dmg_b int;
  combined_steps int;
  boss co_op_bosses%rowtype;
  next_landmark record;
  km_per_1000_steps numeric := 0.77; -- ~1300 steps/km, a standard walking estimate
begin
  for c in select id as couple_id from couples loop
    perform ensure_campaign_map(c.couple_id);

    select user_id into member_a from couple_members where couple_id = c.couple_id order by user_id limit 1;
    select user_id into member_b from couple_members where couple_id = c.couple_id order by user_id offset 1 limit 1;
    if member_a is null or member_b is null then
      continue; -- not fully paired (shouldn't happen, but stay safe)
    end if;

    select coalesce((select sum(amount) from xp_events where user_id = member_a and for_date = target_date), 0) into dmg_a;
    select coalesce((select sum(amount) from xp_events where user_id = member_b and for_date = target_date), 0) into dmg_b;

    select * into boss from co_op_bosses where couple_id = c.couple_id and status = 'active' order by starts_on desc limit 1;

    if found then
      -- a boss blocks the path: XP becomes combat damage instead of map progress
      update co_op_bosses
        set current_hp = greatest(current_hp - dmg_a - dmg_b, 0),
            your_damage = your_damage + dmg_a,
            her_damage = her_damage + dmg_b
        where id = boss.id
        returning * into boss;

      if boss.current_hp <= 0 then
        update co_op_bosses set status = 'defeated', current_hp = 0 where id = boss.id;
        update campaign_map
          set distance_covered_km = (select distance_km from campaign_landmarks where name = boss.name),
              current_landmark = boss.name,
              biome = (select biome from campaign_landmarks where name = boss.name),
              updated_at = now()
          where couple_id = c.couple_id;
        insert into loot_drops (user_id, type, payload) values
          (member_a, 'boss_defeated', jsonb_build_object('boss', boss.name)),
          (member_b, 'boss_defeated', jsonb_build_object('boss', boss.name));
      end if;
    else
      -- open road: combined steps move the dots closer
      select coalesce(sum(step_count), 0) into combined_steps
        from steps where user_id in (member_a, member_b) and step_date = target_date;

      select l.distance_km, l.name, l.biome into next_landmark
        from campaign_landmarks l, campaign_map m
        where m.couple_id = c.couple_id and l.distance_km > m.distance_covered_km
        order by l.distance_km asc limit 1;

      if found then
        update campaign_map
          set distance_covered_km = least(distance_covered_km + (combined_steps / 1000.0) * km_per_1000_steps, next_landmark.distance_km),
              updated_at = now()
          where couple_id = c.couple_id;

        -- reached (or passed) the landmark: spawn a boss that blocks further progress
        if (select distance_covered_km from campaign_map where couple_id = c.couple_id) >= next_landmark.distance_km then
          insert into co_op_bosses (couple_id, name, theme, max_hp, current_hp, starts_on, deadline, status, is_roadblock)
            values (c.couple_id, next_landmark.name, next_landmark.biome, 300, 300, target_date, target_date + 14, 'active', true);
        end if;
      end if;
    end if;
  end loop;
end;
$$;
