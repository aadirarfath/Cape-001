-- Bookings (created only through book_appointment) and payments (Razorpay, later phase).

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete restrict,
  shop_id uuid not null references public.shops (id) on delete restrict,
  barber_id uuid not null,
  service_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.booking_status not null default 'confirmed',
  -- Snapshots taken at booking time, so later price/duration edits don't rewrite history.
  price_paise integer not null check (price_paise >= 0),
  duration_minutes integer not null check (duration_minutes > 0),
  customer_notes text check (char_length(customer_notes) <= 500),
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles (id) on delete set null,
  cancellation_reason text check (char_length(cancellation_reason) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  foreign key (barber_id, shop_id) references public.barbers (id, shop_id) on delete restrict,
  foreign key (service_id, shop_id) references public.services (id, shop_id) on delete restrict,
  -- The double-booking guarantee: a barber can never have two overlapping active bookings,
  -- no matter how many requests race. Ranges are half-open, so back-to-back slots are fine.
  constraint bookings_no_overlap exclude using gist (
    barber_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status in ('pending', 'confirmed'))
);

create index bookings_customer_id_starts_at_idx on public.bookings (customer_id, starts_at);
create index bookings_shop_id_starts_at_idx on public.bookings (shop_id, starts_at);

create trigger bookings_set_updated_at
  before update on public.bookings
  for each row execute function private.set_updated_at();

alter table public.bookings enable row level security;

-- Read-only for clients. Inserts go through book_appointment; status changes through
-- cancel_booking / update_booking_status.
revoke all on public.bookings from anon;
revoke insert, update, delete, truncate on public.bookings from authenticated;

create policy "Customers see their bookings; owners/managers their shop's; barbers their own"
  on public.bookings for select
  to authenticated
  using (
    customer_id = (select auth.uid())
    or private.has_shop_role(shop_id, '{owner,manager}')
    or private.is_linked_barber(barber_id)
  );

-- Staff can see the profile (name, phone) of customers who booked with them.
create policy "Shop staff can read profiles of their customers"
  on public.profiles for select
  to authenticated
  using (
    exists (
      select 1 from public.bookings b
      where b.customer_id = profiles.id
        and (
          private.has_shop_role(b.shop_id, '{owner,manager}')
          or private.is_linked_barber(b.barber_id)
        )
    )
  );

-- Payments. Written only by the server (Razorpay webhook with the service role, later phase).
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete restrict,
  amount_paise integer not null check (amount_paise > 0),
  currency text not null default 'INR' check (currency ~ '^[A-Z]{3}$'),
  status public.payment_status not null default 'created',
  razorpay_order_id text unique,
  razorpay_payment_id text unique,
  provider_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payments_booking_id_idx on public.payments (booking_id);

create trigger payments_set_updated_at
  before update on public.payments
  for each row execute function private.set_updated_at();

alter table public.payments enable row level security;

revoke all on public.payments from anon;
revoke insert, update, delete, truncate on public.payments from authenticated;

create policy "Customers and shop owners/managers can see payments for their bookings"
  on public.payments for select
  to authenticated
  using (
    exists (
      select 1 from public.bookings b
      where b.id = payments.booking_id
        and (
          b.customer_id = (select auth.uid())
          or private.has_shop_role(b.shop_id, '{owner,manager}')
        )
    )
  );
