-- Unpairing (§5.5: "either person can revoke sharing at any time, and
-- unpairing severs all cross-reads"). Deleting the couples row cascades to
-- couple_members, which is what every partner-read RLS policy keys off —
-- so this immediately closes every cross-read for both people.

create or replace function leave_couple()
returns void
language plpgsql
security definer
as $$
declare
  my_couple_id uuid;
begin
  select couple_id into my_couple_id from couple_members where user_id = auth.uid();
  if my_couple_id is null then
    return;
  end if;
  delete from couples where id = my_couple_id;
end;
$$;

grant execute on function leave_couple() to authenticated;
