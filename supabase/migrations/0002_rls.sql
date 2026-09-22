-- LevelUp — RLS policies + pairing handshake + privacy firewall (BUILD_PLAN §5.5, §8)
--
-- Rule: read/write your own rows; read a partner's rows only if paired, and only for
-- data marked "shared" in §5.5. weight_logs, measurements, progress_photos and meals
-- (diary detail) are private-by-default and gated by sharing_prefs / per-photo reveal.

-- ── helper functions ──────────────────────────────────────────────────────

create or replace function is_paired_with(target_user uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1
    from couple_members cm1
    join couple_members cm2 on cm1.couple_id = cm2.couple_id
    where cm1.user_id = auth.uid()
      and cm2.user_id = target_user
      and cm1.user_id <> cm2.user_id
  );
$$;

create or replace function partner_can_see(target_user uuid, pref text)
returns boolean
language plpgsql
security definer
stable
as $$
declare
  visible boolean;
begin
  if not is_paired_with(target_user) then
    return false;
  end if;
  execute format('select %I from sharing_prefs where user_id = $1', pref)
    into visible using target_user;
  return coalesce(visible, false);
end;
$$;

-- ── new-user bootstrap: profile + defaults row on signup ───────────────────

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  insert into public.streaks (user_id) values (new.id);
  insert into public.sharing_prefs (user_id) values (new.id);
  insert into public.water_drops (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ── pairing handshake RPCs (§5.5 step 3) ────────────────────────────────────
-- Implemented as SECURITY DEFINER Postgres functions rather than a separate
-- Edge Function — same validate → bind → consume flow, one atomic transaction.

create or replace function create_invite_code()
returns text
language plpgsql
security definer
as $$
declare
  new_code text;
begin
  new_code := upper(substr(md5(random()::text), 1, 6));
  insert into invite_codes (code, created_by, expires_at)
  values (new_code, auth.uid(), now() + interval '15 minutes');
  return new_code;
end;
$$;

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

  return new_couple_id;
end;
$$;

grant execute on function create_invite_code() to authenticated;
grant execute on function redeem_invite_code(text) to authenticated;

-- ── enable RLS everywhere ───────────────────────────────────────────────────

alter table profiles enable row level security;
alter table couples enable row level security;
alter table couple_members enable row level security;
alter table pairing_invites enable row level security;
alter table invite_codes enable row level security;
alter table water_logs enable row level security;
alter table meals enable row level security;
alter table saved_foods enable row level security;
alter table daily_checkins enable row level security;
alter table progress_photos enable row level security;
alter table steps enable row level security;
alter table workouts enable row level security;
alter table quests enable row level security;
alter table weight_logs enable row level security;
alter table measurements enable row level security;
alter table streaks enable row level security;
alter table xp_events enable row level security;
alter table loot_drops enable row level security;
alter table voice_notes enable row level security;
alter table seasons enable row level security;
alter table co_op_bosses enable row level security;
alter table garden_plants enable row level security;
alter table watering_events enable row level security;
alter table water_drops enable row level security;
alter table sharing_prefs enable row level security;
alter table campaign_map enable row level security;
alter table cover_events enable row level security;

-- ── profiles: own row full access; partner can read (needed for name/avatar/class) ──

create policy "profiles: self read/write" on profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

create policy "profiles: partner read" on profiles
  for select using (is_paired_with(id));

-- ── couples / couple_members ────────────────────────────────────────────────

create policy "couples: members read" on couples
  for select using (exists (select 1 from couple_members where couple_id = couples.id and user_id = auth.uid()));

create policy "couple_members: self or partner read" on couple_members
  for select using (user_id = auth.uid() or is_paired_with(user_id));

-- pairing_invites / invite_codes: no direct table policies — redemption goes
-- through the SECURITY DEFINER RPCs above, which bypass RLS internally. A user
-- can still see invites/codes they personally created.
create policy "invite_codes: creator read" on invite_codes
  for select using (created_by = auth.uid());

create policy "pairing_invites: creator read" on pairing_invites
  for select using (created_by = auth.uid());

-- ── private-by-default: weight, measurements, photos, diary (meals) ────────

create policy "weight_logs: self read/write" on weight_logs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "weight_logs: partner read if shared" on weight_logs
  for select using (partner_can_see(user_id, 'weight_visible'));

create policy "measurements: self read/write" on measurements
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "measurements: partner read if shared" on measurements
  for select using (partner_can_see(user_id, 'measurements_visible'));

create policy "progress_photos: self read/write" on progress_photos
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "progress_photos: partner read if revealed or shared" on progress_photos
  for select using (revealed = true or partner_can_see(user_id, 'photos_visible'));

create policy "meals: self read/write" on meals
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "meals: partner read if diary shared" on meals
  for select using (partner_can_see(user_id, 'diary_visible'));

-- sharing_prefs: only the owner can read/write their own toggles.
create policy "sharing_prefs: self read/write" on sharing_prefs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── shared-by-default: XP, quests, streak, class, feed-ish data (§5.5 table) ──

create policy "water_logs: self read/write" on water_logs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "water_logs: partner read" on water_logs
  for select using (is_paired_with(user_id));

create policy "saved_foods: self read/write" on saved_foods
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "daily_checkins: self read/write" on daily_checkins
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "daily_checkins: partner read" on daily_checkins
  for select using (is_paired_with(user_id));

create policy "steps: self read/write" on steps
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "steps: partner read" on steps
  for select using (is_paired_with(user_id));

create policy "workouts: self read/write" on workouts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "workouts: partner read" on workouts
  for select using (is_paired_with(user_id));

create policy "quests: self read/write" on quests
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "quests: partner read" on quests
  for select using (is_paired_with(user_id));

create policy "streaks: self read/write" on streaks
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "streaks: partner read" on streaks
  for select using (is_paired_with(user_id));

create policy "xp_events: self read" on xp_events
  for select using (user_id = auth.uid());
create policy "xp_events: partner read" on xp_events
  for select using (is_paired_with(user_id));
-- no client insert/update/delete policy: XP is written server-side only (§8.5A)

create policy "loot_drops: self read/write" on loot_drops
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "voice_notes: sender or recipient read" on voice_notes
  for select using (from_user = auth.uid() or to_user = auth.uid());
create policy "voice_notes: sender write" on voice_notes
  for insert with check (from_user = auth.uid());
create policy "voice_notes: recipient update (unlock)" on voice_notes
  for update using (to_user = auth.uid());

create policy "water_drops: self read/write" on water_drops
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "water_drops: partner read" on water_drops
  for select using (is_paired_with(user_id));

-- ── couple-scoped tables: any member of the couple can read/write ──────────

create policy "seasons: couple members" on seasons
  for all using (exists (select 1 from couple_members where couple_id = seasons.couple_id and user_id = auth.uid()))
  with check (exists (select 1 from couple_members where couple_id = seasons.couple_id and user_id = auth.uid()));

create policy "co_op_bosses: couple members" on co_op_bosses
  for all using (exists (select 1 from couple_members where couple_id = co_op_bosses.couple_id and user_id = auth.uid()))
  with check (exists (select 1 from couple_members where couple_id = co_op_bosses.couple_id and user_id = auth.uid()));

create policy "garden_plants: couple members" on garden_plants
  for all using (exists (select 1 from couple_members where couple_id = garden_plants.couple_id and user_id = auth.uid()))
  with check (exists (select 1 from couple_members where couple_id = garden_plants.couple_id and user_id = auth.uid()));

create policy "watering_events: couple members" on watering_events
  for all using (exists (
    select 1 from garden_plants gp
    join couple_members cm on cm.couple_id = gp.couple_id
    where gp.id = watering_events.plant_id and cm.user_id = auth.uid()
  ));

create policy "campaign_map: couple members" on campaign_map
  for all using (exists (select 1 from couple_members where couple_id = campaign_map.couple_id and user_id = auth.uid()))
  with check (exists (select 1 from couple_members where couple_id = campaign_map.couple_id and user_id = auth.uid()));

create policy "cover_events: couple members" on cover_events
  for all using (exists (select 1 from couple_members where couple_id = cover_events.couple_id and user_id = auth.uid()))
  with check (exists (select 1 from couple_members where couple_id = cover_events.couple_id and user_id = auth.uid()));
