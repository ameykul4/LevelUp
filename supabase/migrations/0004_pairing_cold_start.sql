-- Set the cold-start "Adventurer" loadout flag on both profiles when pairing
-- completes (§7.4D). No spec/class UI unlocks on this flag yet (that's Phase 5+),
-- it just records that the pair has an active cold-start loadout.

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

  return new_couple_id;
end;
$$;
