-- Reusable helper: the UTC bounds of a given calendar date in a given
-- timezone. Used by Edge Functions (Deno) that need the same
-- timezone-correct day-bucketing the XP resolver uses, without
-- reimplementing timezone math in JS.
create or replace function local_day_bounds(for_date date, tz text, out day_start timestamptz, out day_end timestamptz)
language sql
immutable
as $$
  select (for_date::timestamp AT TIME ZONE tz), ((for_date + 1)::timestamp AT TIME ZONE tz)
$$;

grant execute on function local_day_bounds(date, text) to authenticated, service_role;
