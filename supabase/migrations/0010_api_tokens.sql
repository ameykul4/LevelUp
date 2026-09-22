-- Phase 6: a long-lived token so Shortcuts/Scriptable (no browser session)
-- can act on a user's behalf, without exposing their Supabase auth session.

create extension if not exists pgcrypto;

create table api_tokens (
  user_id uuid primary key references profiles on delete cascade,
  token text unique not null,
  created_at timestamptz default now()
);

alter table api_tokens enable row level security;

create policy "api_tokens: self read" on api_tokens
  for select using (user_id = auth.uid());

create or replace function get_or_create_api_token()
returns text
language plpgsql
security definer
as $$
declare
  existing text;
  new_token text;
begin
  select token into existing from api_tokens where user_id = auth.uid();
  if existing is not null then
    return existing;
  end if;

  new_token := encode(gen_random_bytes(24), 'hex');
  insert into api_tokens (user_id, token) values (auth.uid(), new_token);
  return new_token;
end;
$$;

grant execute on function get_or_create_api_token() to authenticated;
