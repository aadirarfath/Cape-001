-- Push notification receipts tracking and retry queue.
--
-- 1. push_notification_tickets: tracks Expo push tickets so a scheduled job can fetch
--    receipts ~15 minutes later, deleting DeviceNotRegistered tokens and logging errors.
-- 2. push_notification_retries: tracks failed push sends (429 / 5xx) so they can be
--    retried with exponential backoff.
--
-- Both tables are internal to the background Edge Functions and accessible only by service_role.

create table public.push_notification_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_id text not null unique,
  token text not null,
  status text not null default 'pending' check (status in ('pending', 'checked', 'error')),
  error_details jsonb,
  created_at timestamptz not null default now()
);

create index push_notification_tickets_pending_idx
  on public.push_notification_tickets (created_at)
  where status = 'pending';

create index push_notification_tickets_token_idx
  on public.push_notification_tickets (token);

alter table public.push_notification_tickets enable row level security;
revoke all on public.push_notification_tickets from anon, authenticated;
grant all on public.push_notification_tickets to service_role;

create policy "Service role manages push notification tickets"
  on public.push_notification_tickets
  for all
  to service_role
  using (true)
  with check (true);

-- Retry queue for failed sends
create table public.push_notification_retries (
  id uuid primary key default gen_random_uuid(),
  message jsonb not null,
  attempt_count integer not null default 0,
  next_retry_at timestamptz not null default now(),
  last_error text,
  status text not null default 'pending' check (status in ('pending', 'succeeded', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index push_notification_retries_pending_idx
  on public.push_notification_retries (next_retry_at)
  where status = 'pending';

create trigger push_notification_retries_set_updated_at
  before update on public.push_notification_retries
  for each row execute function private.set_updated_at();

alter table public.push_notification_retries enable row level security;
revoke all on public.push_notification_retries from anon, authenticated;
grant all on public.push_notification_retries to service_role;

create policy "Service role manages push notification retries"
  on public.push_notification_retries
  for all
  to service_role
  using (true)
  with check (true);
