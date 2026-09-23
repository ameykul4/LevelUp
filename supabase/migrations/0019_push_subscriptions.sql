-- Phase 8: Web Push (§9 Phase 8). One row per subscribed device.
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now()
);

alter table push_subscriptions enable row level security;

create policy "push_subscriptions: self read/write" on push_subscriptions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
