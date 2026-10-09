-- Expo push tokens of partner app users. A user can have several devices; a device token is
-- stored once per user. Users manage only their own tokens. The notify-booking Edge Function
-- reads them with the service role (see booking_notification_tokens).

create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  token text not null check (token ~ '^Expo(nent)?PushToken\[[^\]]+\]$' and char_length(token) <= 200),
  platform text not null check (platform in ('android', 'ios')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, token)
);

create index push_tokens_token_idx on public.push_tokens (token);

create trigger push_tokens_set_updated_at
  before update on public.push_tokens
  for each row execute function private.set_updated_at();

alter table public.push_tokens enable row level security;

revoke all on public.push_tokens from anon;
revoke update, truncate on public.push_tokens from authenticated;
-- Re-registering a device upserts { token, platform } on (user_id, token); user_id is fixed.
grant update (token, platform) on public.push_tokens to authenticated;

create policy "Users can see their own push tokens"
  on public.push_tokens for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Users can add their own push tokens"
  on public.push_tokens for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "Users can update their own push tokens"
  on public.push_tokens for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Users can delete their own push tokens"
  on public.push_tokens for delete
  to authenticated
  using (user_id = (select auth.uid()));
