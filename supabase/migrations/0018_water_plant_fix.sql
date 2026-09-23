-- Fix: min(uuid) isn't a supported aggregate here — use the same
-- ORDER BY .. LIMIT 1 pattern already used in resolve_campaign_for_date
-- to determine "first" couple member deterministically.

create or replace function water_plant(target_plant_id uuid, drops int)
returns void
language plpgsql
security definer
as $$
declare
  plant garden_plants%rowtype;
  my_balance int;
  first_member uuid;
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

  select user_id into first_member from couple_members where couple_id = plant.couple_id order by user_id limit 1;
  is_first_member := (auth.uid() = first_member);

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
