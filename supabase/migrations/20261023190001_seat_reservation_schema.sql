-- Seat reservation: shows, seats, held booking status, and the expiry cron job.
--
-- Shows are events or sessions attached to a shop. Each show has a set of seats
-- with individual prices. Customers hold a seat for 10 minutes while they pay;
-- the hold turns into a confirmed booking on successful payment, or expires.

-- 1. Add 'held' to the booking_status enum.
-- ALTER TYPE … ADD VALUE cannot run inside a transaction, so we commit first via
-- a plain ALTER statement (Supabase migrations run each file in its own
-- implicit transaction *unless* the file starts with BEGIN/COMMIT; we leave
-- the default here so Postgres can execute the ADD VALUE).
alter type public.booking_status add value if not exists 'held';
alter type public.booking_status add value if not exists 'expired';

-- 2. New tables ------------------------------------------------------------------

create table public.shows (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid not null references public.shops (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 200),
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index shows_shop_id_starts_at_idx on public.shows (shop_id, starts_at);

create trigger shows_set_updated_at
  before update on public.shows
  for each row execute function private.set_updated_at();

alter table public.shows enable row level security;

-- Anyone can read shows for active shops; writes are handled by security-definer functions.
revoke all on public.shows from anon;
revoke insert, update, delete, truncate on public.shows from authenticated;

create policy "Public can see shows for active shops"
  on public.shows for select
  to anon, authenticated
  using (
    exists (select 1 from public.shops s where s.id = shows.shop_id and s.is_active)
  );

-- Owners/managers of the shop can see all shows (including inactive).
create policy "Shop owners/managers can see all shows for their shop"
  on public.shows for select
  to authenticated
  using (private.has_shop_role(shop_id, '{owner,manager}'));

-- ---------------------------------------------------------------------------------

create table public.seats (
  id          uuid primary key default gen_random_uuid(),
  show_id     uuid not null references public.shows (id) on delete cascade,
  label       text not null check (char_length(label) between 1 and 20),
  price_paise integer not null check (price_paise >= 0),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (show_id, label)
);

create index seats_show_id_idx on public.seats (show_id);

alter table public.seats enable row level security;

-- Seat data is public (availability visible to unauthenticated users, e.g. on the
-- booking widget). Writes are only through security-definer functions.
revoke all on public.seats from anon;
revoke insert, update, delete, truncate on public.seats from authenticated;

create policy "Public can read active seats"
  on public.seats for select
  to anon, authenticated
  using (is_active);

-- 3. Extend bookings --------------------------------------------------------------
--
-- seat_id and hold_expires_at are both nullable: existing barber-appointment
-- bookings don't use them.  seat_id references seats; we add a partial unique
-- index to prevent two active/held bookings for the same seat.
--
-- barber_id and service_id are made nullable so that seat bookings (which don't
-- have a barber or service) can share the same table without dummy FK values.

alter table public.bookings
  alter column barber_id drop not null,
  alter column service_id drop not null,
  add column if not exists seat_id         uuid references public.seats (id) on delete restrict,
  add column if not exists hold_expires_at timestamptz;

-- A booking must have EITHER a barber+service (walk-in) OR a seat (event).
alter table public.bookings
  add constraint bookings_barber_or_seat check (
    (barber_id is not null and service_id is not null and seat_id is null)
    or
    (barber_id is null and service_id is null and seat_id is not null)
  );

-- Prevent two active or held bookings for the same seat.
create unique index bookings_seat_unique_active
  on public.bookings (seat_id)
  where (status in ('held', 'confirmed') and seat_id is not null);

-- 4. Expiry cron job ---------------------------------------------------------------
-- Requires pg_cron. Supabase's hosted platform ships it; enable via the dashboard
-- (Extensions → pg_cron). The local Supabase CLI image also ships it.
-- We wrap the extension-create in a DO block so the migration doesn't error when
-- it is already present.
do $$
begin
  create extension if not exists pg_cron with schema extensions;
exception when others then
  -- pg_cron may already be created in a different schema; ignore.
  null;
end;
$$;

-- Expire held bookings that haven't been paid in time.
-- Runs every 60 seconds. The job name is idempotent (unschedule first if present).
select cron.unschedule('expire-held-bookings') where exists (
  select 1 from cron.job where jobname = 'expire-held-bookings'
);

select cron.schedule(
  'expire-held-bookings',
  '* * * * *',  -- every minute
  $$
    update public.bookings
    set status = 'expired'
    where status = 'held'
      and hold_expires_at < now()
  $$
);
