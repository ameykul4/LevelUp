-- LevelUp — storage buckets (BUILD_PLAN §8 "Buckets")
-- Convention: object paths are "${auth.uid()}/...", so a user only ever
-- touches their own folder. avatars is public-read; everything else is
-- private and, where shared, exposed only via signed URLs the app requests.

insert into storage.buckets (id, name, public)
values
  ('avatars', 'avatars', true),
  ('food-photos', 'food-photos', false),
  ('progress-photos', 'progress-photos', false),
  ('voice-notes', 'voice-notes', false)
on conflict (id) do nothing;

-- avatars: anyone can view (public bucket read is implicit), owner can write
create policy "avatars: owner write" on storage.objects
  for insert with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: owner update/delete" on storage.objects
  for update using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: owner delete" on storage.objects
  for delete using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: public read" on storage.objects
  for select using (bucket_id = 'avatars');

-- food-photos: owner-only (Gemini reads via signed URL from the Edge Function, not RLS)
create policy "food-photos: owner all" on storage.objects
  for all
  using (bucket_id = 'food-photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'food-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- progress-photos: owner-only, strict — never forwarded to any AI (§2.6, §11)
create policy "progress-photos: owner all" on storage.objects
  for all
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- voice-notes: owner-only at the storage layer; the voice_notes table's
-- from_user/to_user policy is what actually lets a partner fetch a signed URL.
create policy "voice-notes: owner all" on storage.objects
  for all
  using (bucket_id = 'voice-notes' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'voice-notes' and (storage.foldername(name))[1] = auth.uid()::text);
