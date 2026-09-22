-- LevelUp — initial schema (BUILD_PLAN §8)

-- 1. Profiles (extends auth.users) — body stats + targets + cold-start state
create table profiles (
  id               uuid primary key references auth.users on delete cascade,
  display_name     text not null,
  avatar_url       text,
  timezone         text default 'Asia/Kolkata',
  sex              text,                    -- for TDEE
  birth_date       date,
  height_cm        numeric,
  activity_level   text,                    -- sedentary..very_active
  goal_type        text,                    -- lose | maintain | gain
  weekly_rate_kg   numeric,                 -- capped safe range (§2.3)
  target_calories  int,
  target_protein_g int,
  target_carbs_g   int,
  target_fat_g     int,
  target_fiber_g   int,
  water_target_ml  int default 2500,
  weight_visible   boolean default false,
  combat_class     text default 'adventurer',   -- adventurer | tank | agility | ...
  cold_start_done  boolean default false,
  onboarded        boolean default false,
  created_at       timestamptz default now()
);

-- 2. Couples + membership (max 2)
create table couples (
  id uuid primary key default gen_random_uuid(),
  couple_name text, season_id uuid, created_at timestamptz default now()
);
create table couple_members (
  couple_id uuid references couples on delete cascade,
  user_id   uuid references profiles on delete cascade,
  primary key (couple_id, user_id)
);

-- 3. Pairing invites (legacy table kept for FK compat; §20 invite_codes is the one used by §5.5 flow)
create table pairing_invites (
  code text primary key, couple_id uuid references couples on delete cascade,
  created_by uuid references profiles, expires_at timestamptz not null
);

-- 4. Water
create table water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles on delete cascade,
  amount_ml int not null, logged_at timestamptz default now()
);

-- 5. Meals — full macros + source + correction note
create table meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles on delete cascade,
  meal_slot text,                          -- breakfast|lunch|dinner|snack
  photo_url text, barcode text,
  name text,
  calories int, protein_g numeric, carbs_g numeric,
  fat_g numeric, fiber_g numeric, sugar_g numeric, sodium_mg numeric,
  portion_note text,                       -- "extra roti, more oil"
  grams numeric,
  source text check (source in ('ai','manual','voice','barcode','saved')),
  ai_raw jsonb,
  logged_at timestamptz default now()
);

-- 6. Saved foods / recipes (fast re-log)
create table saved_foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles on delete cascade,
  name text, per_serving jsonb, is_recipe boolean default false
);

-- 7. Daily check-in
create table daily_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles on delete cascade,
  checkin_date date not null,
  sleep_quality int, energy int, mood int, note text,
  unique (user_id, checkin_date)
);

-- 8. Progress photos (PRIVATE bucket, never to AI)
create table progress_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles on delete cascade,
  photo_url text not null, taken_at timestamptz default now(),
  week_no int, revealed boolean default false
);

-- 9. Steps (from Apple Health via Shortcuts)
create table steps (
  user_id uuid references profiles on delete cascade,
  step_date date not null, step_count int not null,
  synced_at timestamptz default now(), primary key (user_id, step_date)
);

-- 9b. Workouts (strength sessions, cardio, mobility)
create table workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles on delete cascade,
  workout_type text,                       -- strength | cardio | mobility | rest
  duration_min int,
  sets jsonb,                              -- [{exercise, weight, reps}, ...]
  calories_burned int,
  done_on date not null,
  logged_at timestamptz default now()
);

-- 9c. Quests (daily, generated from targets + check-in)
create table quests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles on delete cascade,
  quest_date date not null,
  kind text,                               -- steps | protein | workout | rest | water | photo
  quest_category text,                     -- strength | agility | recovery | shield | recon (§7.4C)
  target numeric, progress numeric default 0,
  completed boolean default false,
  xp_reward int default 0
);

-- 10. Weight + measurements (private, trend display)
create table weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles on delete cascade,
  weight_kg numeric not null, logged_on date not null
);
create table measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles on delete cascade,
  measured_on date not null, waist_cm numeric, hip_cm numeric,
  chest_cm numeric, arm_cm numeric, thigh_cm numeric
);

-- 11. Streaks
create table streaks (
  user_id uuid primary key references profiles on delete cascade,
  current_streak int default 0, longest_streak int default 0,
  freezes_available int default 3, last_active_date date
);

-- 12. XP ledger
create table xp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles on delete cascade,
  amount int not null, reason text not null, created_at timestamptz default now()
);

-- 13. Loot drops
create table loot_drops (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles, type text, payload jsonb,
  claimed boolean default false, created_at timestamptz default now()
);

-- 14. Voice notes
create table voice_notes (
  id uuid primary key default gen_random_uuid(),
  from_user uuid references profiles, to_user uuid references profiles,
  audio_url text not null, unlock_when text, unlocked boolean default false
);

-- 15. Seasons
create table seasons (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid references couples on delete cascade,
  theme text, starts_on date, ends_on date, finale_reward text
);

-- 16. Co-op boss battles (both must contribute to win)
create table co_op_bosses (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid references couples on delete cascade,
  name text, theme text,
  max_hp int not null, current_hp int not null,
  your_damage int default 0, her_damage int default 0,  -- both must be > 0 to win
  starts_on date, deadline date,
  status text default 'active',            -- active | defeated | escaped
  reward text,
  shield_hp int default 0,                 -- refilled by water moves (§7.4B)
  team_evasion int default 0,              -- raised by steps moves
  adaptive_focus text,                     -- under-served category it leans on (capped, §2.9)
  is_roadblock boolean default true        -- blocks the map until cleared (§7.4A)
);

-- 17. Shared garden — plants earned by weekly goals, grown by watering
create table garden_plants (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid references couples on delete cascade,
  species text,                            -- rose | marigold | lotus | sunflower...
  stage text default 'seed',               -- seed | sprout | bud | bloom
  planted_for text,                        -- "2-week streak", "boss: The Plateau"
  planted_by uuid references profiles,
  your_water int default 0, her_water int default 0,  -- both>0 needed for full bloom
  wilting boolean default false,
  position int,                            -- slot in the plot
  created_at timestamptz default now()
);

-- 18. Watering events (drops earned from hitting daily water target)
create table watering_events (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid references garden_plants on delete cascade,
  user_id uuid references profiles,
  drops int not null,
  watered_at timestamptz default now()
);

-- 19. Water-drop balance (earned by hitting water target, spent in garden)
create table water_drops (
  user_id uuid primary key references profiles on delete cascade,
  balance int default 0
);

-- 20. Pairing: single-use, expiring invite codes (§5.5)
create table invite_codes (
  code text primary key,                   -- short, e.g. 6 chars
  created_by uuid references profiles,
  created_at timestamptz default now(),
  expires_at timestamptz not null,         -- ~15 min TTL
  consumed_by uuid references profiles,     -- null until redeemed
  consumed_at timestamptz
);

-- 21. Privacy firewall: per-person sharing toggles (§5.5). Enforced in RLS.
create table sharing_prefs (
  user_id uuid primary key references profiles on delete cascade,
  weight_visible boolean default false,
  measurements_visible boolean default false,
  photos_visible boolean default false,    -- per-photo overrides live on progress_photos
  diary_visible boolean default false
);

-- 22. Campaign map: the shared LDR journey (§7.4A). One row per couple.
create table campaign_map (
  couple_id uuid primary key references couples on delete cascade,
  total_distance_km numeric not null,       -- real gap, e.g. 142
  distance_covered_km numeric default 0,    -- moved by combined steps
  current_landmark text,                    -- e.g. "Lonavla"
  season text,                              -- "Monsoon Grind"
  biome text,                               -- drives §7.8 recolour: "ghats_rain" | "coast_dry"...
  updated_at timestamptz default now()
);

-- 23. "Cover for me" events (§7.4E / §7.5F) — finite, one per person per week
create table cover_events (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid references couples on delete cascade,
  covered_by uuid references profiles,      -- the one who over-performed
  covered_for uuid references profiles,     -- the low-energy partner
  week_of date,
  created_at timestamptz default now()
);
