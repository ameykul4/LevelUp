-- Several tables referenced profiles without ON DELETE CASCADE, so deleting
-- a user account would fail with a foreign key violation instead of
-- cleanly removing their data. Found via testing account deletion during
-- Phase 7 QA. Fixed for every table that holds a user's own gameplay data;
-- left alone for tables that are more of a historical record shared with
-- another party (invite_codes, pairing_invites), where an orphaned
-- reference is harmless and arguably worth keeping.

alter table loot_drops drop constraint loot_drops_user_id_fkey;
alter table loot_drops add constraint loot_drops_user_id_fkey
  foreign key (user_id) references profiles on delete cascade;

alter table voice_notes drop constraint voice_notes_from_user_fkey;
alter table voice_notes add constraint voice_notes_from_user_fkey
  foreign key (from_user) references profiles on delete cascade;

alter table voice_notes drop constraint voice_notes_to_user_fkey;
alter table voice_notes add constraint voice_notes_to_user_fkey
  foreign key (to_user) references profiles on delete cascade;

alter table garden_plants drop constraint garden_plants_planted_by_fkey;
alter table garden_plants add constraint garden_plants_planted_by_fkey
  foreign key (planted_by) references profiles on delete cascade;

alter table watering_events drop constraint watering_events_user_id_fkey;
alter table watering_events add constraint watering_events_user_id_fkey
  foreign key (user_id) references profiles on delete cascade;

alter table cover_events drop constraint cover_events_covered_by_fkey;
alter table cover_events add constraint cover_events_covered_by_fkey
  foreign key (covered_by) references profiles on delete cascade;

alter table cover_events drop constraint cover_events_covered_for_fkey;
alter table cover_events add constraint cover_events_covered_for_fkey
  foreign key (covered_for) references profiles on delete cascade;
