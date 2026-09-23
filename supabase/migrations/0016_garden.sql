-- Phase 7 (3/4): the shared garden (§7.7). A plant is earned per good week
-- (both partners showing up most days), grown by spending water-drops
-- (earned in the XP resolver for hitting the daily water target), and only
-- reaches full bloom once BOTH partners have watered it — the cooperative
-- rule made visible. Neglect just wilts it a little; it never dies.

alter table campaign_map add column last_plant_week date;

create or replace function water_plant(target_plant_id uuid, drops int)
returns void
language plpgsql
security definer
as $$
declare
  plant garden_plants%rowtype;
  my_balance int;
  is_first_member boolean;
  new_your_water int;
  new_her_water int;
  new_stage text;
begin
  select * into plant from garden_plants where id = target_plant_id;
  if not found then
    raise exception 'Plant not found';
  end if;

  if not exists (select 1 from couple_members where couple_id = plant.couple_id and user_id = auth.uid()) then
    raise exception 'Not a member of this garden';
  end if;

  select balance into my_balance from water_drops where user_id = auth.uid();
  if coalesce(my_balance, 0) < drops or drops <= 0 then
    raise exception 'Not enough water drops';
  end if;

  select (user_id = (select min(user_id) from couple_members where couple_id = plant.couple_id))
    into is_first_member
    from couple_members where couple_id = plant.couple_id and user_id = auth.uid();

  update water_drops set balance = balance - drops where user_id = auth.uid();
  insert into watering_events (plant_id, user_id, drops) values (target_plant_id, auth.uid(), drops);

  new_your_water := plant.your_water + case when is_first_member then drops else 0 end;
  new_her_water := plant.her_water + case when is_first_member then 0 else drops end;

  new_stage := case
    when (new_your_water + new_her_water) >= 30 and new_your_water >= 10 and new_her_water >= 10 then 'bloom'
    when (new_your_water + new_her_water) >= 15 and new_your_water > 0 and new_her_water > 0 then 'bud'
    when (new_your_water + new_her_water) >= 5 then 'sprout'
    else 'seed'
  end;

  update garden_plants
    set your_water = new_your_water, her_water = new_her_water, stage = new_stage, wilting = false
    where id = target_plant_id;
end;
$$;

grant execute on function water_plant(uuid, int) to authenticated;

-- weekly plant + wilt check, folded into the nightly campaign resolver
create or replace function resolve_garden_for_date(target_date date)
returns void
language plpgsql
security definer
as $$
declare
  c record;
  member_a uuid;
  member_b uuid;
  a_good_days int;
  b_good_days int;
  species_pick text;
  plant_count int;
  species_list text[] := array['rose', 'marigold', 'lotus', 'sunflower', 'tulip', 'jasmine'];
begin
  for c in select couple_id from campaign_map loop
    -- wilt any plant not watered in the last 3 days (and not already in full bloom)
    update garden_plants
      set wilting = true
      where couple_id = c.couple_id
        and stage <> 'bloom'
        and not exists (
          select 1 from watering_events w
          where w.plant_id = garden_plants.id and w.watered_at >= (target_date - 3)::timestamptz
        );

    -- once a week (Monday), plant a seed if both partners showed up most of the last 7 days
    if extract(dow from target_date) = 1 then
      select user_id into member_a from couple_members where couple_id = c.couple_id order by user_id limit 1;
      select user_id into member_b from couple_members where couple_id = c.couple_id order by user_id offset 1 limit 1;

      if member_a is not null and member_b is not null then
        select count(distinct for_date) into a_good_days from xp_events
          where user_id = member_a and for_date > target_date - 7 and for_date <= target_date and amount > 0;
        select count(distinct for_date) into b_good_days from xp_events
          where user_id = member_b and for_date > target_date - 7 and for_date <= target_date and amount > 0;

        if a_good_days >= 5 and b_good_days >= 5
           and coalesce((select last_plant_week from campaign_map where couple_id = c.couple_id), '1970-01-01'::date) < target_date then
          select count(*) into plant_count from garden_plants where couple_id = c.couple_id;
          species_pick := species_list[(plant_count % array_length(species_list, 1)) + 1];

          insert into garden_plants (couple_id, species, planted_for, position)
            values (c.couple_id, species_pick, 'A week of showing up together', plant_count);

          update campaign_map set last_plant_week = target_date where couple_id = c.couple_id;
        end if;
      end if;
    end if;
  end loop;
end;
$$;
