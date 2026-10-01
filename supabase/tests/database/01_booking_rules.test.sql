-- book_appointment: double-booking protection and every validation rule.
begin;
create extension if not exists pgtap with schema extensions;

select plan(25);

-- Helpers (rolled back with the transaction) ----------------------------------------------
create schema tests;
grant usage on schema tests to anon, authenticated;

-- An instant at a local Asia/Kolkata wall-clock time, p_days from today.
create function tests.local_ts(p_days integer, p_time time) returns timestamptz
language sql stable as $$
  select ((now() at time zone 'Asia/Kolkata')::date + p_days + p_time) at time zone 'Asia/Kolkata'
$$;

create function tests.login_as(p_user_id uuid) returns void
language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
end;
$$;

create function tests.login_anon() returns void
language plpgsql as $$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
end;
$$;

grant execute on all functions in schema tests to anon, authenticated;

-- Fixtures ---------------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('a1000000-0000-4000-8000-000000000001', 'owner@rules.test'),
  ('a1000000-0000-4000-8000-000000000002', 'c1@rules.test'),
  ('a1000000-0000-4000-8000-000000000003', 'c2@rules.test');

insert into public.shops (id, name, slug, address_line, location, is_active) values
  ('a1000000-0000-4000-8000-000000000010', 'Rules Shop', 'rules-shop', 'Test Road',
   extensions.st_setsrid(extensions.st_makepoint(75.78, 11.25), 4326)::extensions.geography, true);

insert into public.shop_members (shop_id, user_id, role) values
  ('a1000000-0000-4000-8000-000000000010', 'a1000000-0000-4000-8000-000000000001', 'owner');

insert into public.barbers (id, shop_id, display_name, is_active) values
  ('a1000000-0000-4000-8000-000000000020', 'a1000000-0000-4000-8000-000000000010', 'Active Barber', true),
  ('a1000000-0000-4000-8000-000000000021', 'a1000000-0000-4000-8000-000000000010', 'Inactive Barber', false);

insert into public.services (id, shop_id, name, duration_minutes, price_paise) values
  ('a1000000-0000-4000-8000-000000000030', 'a1000000-0000-4000-8000-000000000010', 'Cut 30', 30, 25000),
  ('a1000000-0000-4000-8000-000000000031', 'a1000000-0000-4000-8000-000000000010', 'Cut 60', 60, 40000),
  ('a1000000-0000-4000-8000-000000000032', 'a1000000-0000-4000-8000-000000000010', 'Not offered', 30, 10000);

insert into public.barber_services (barber_id, service_id, shop_id) values
  ('a1000000-0000-4000-8000-000000000020', 'a1000000-0000-4000-8000-000000000030', 'a1000000-0000-4000-8000-000000000010'),
  ('a1000000-0000-4000-8000-000000000020', 'a1000000-0000-4000-8000-000000000031', 'a1000000-0000-4000-8000-000000000010'),
  ('a1000000-0000-4000-8000-000000000021', 'a1000000-0000-4000-8000-000000000030', 'a1000000-0000-4000-8000-000000000010');

-- 09:00-18:00 every day.
insert into public.working_hours (barber_id, shop_id, weekday, start_time, end_time)
select b, 'a1000000-0000-4000-8000-000000000010', d, '09:00', '18:00'
from unnest(array['a1000000-0000-4000-8000-000000000020', 'a1000000-0000-4000-8000-000000000021']::uuid[]) as b
cross join generate_series(0, 6) as d;

-- The active barber is away all day, two days from now.
insert into public.time_off (barber_id, shop_id, starts_at, ends_at) values
  ('a1000000-0000-4000-8000-000000000020', 'a1000000-0000-4000-8000-000000000010',
   tests.local_ts(2, '00:00'), tests.local_ts(3, '00:00'));

-- Double booking ---------------------------------------------------------------------------
select tests.login_as('a1000000-0000-4000-8000-000000000002');

select lives_ok(
  $$ select public.book_appointment('a1000000-0000-4000-8000-000000000020', 'a1000000-0000-4000-8000-000000000030', tests.local_ts(1, '10:00')) $$,
  'customer 1 books tomorrow 10:00'
);

select results_eq(
  $$ select ends_at - starts_at, price_paise, status::text from public.bookings
     where barber_id = 'a1000000-0000-4000-8000-000000000020' $$,
  $$ values (interval '30 minutes', 25000, 'confirmed') $$,
  'booking is confirmed with the service duration and a price snapshot'
);

select tests.login_as('a1000000-0000-4000-8000-000000000003');

select throws_ok(
  $$ select public.book_appointment('a1000000-0000-4000-8000-000000000020', 'a1000000-0000-4000-8000-000000000030', tests.local_ts(1, '10:00')) $$,
  'P0001', 'SLOT_TAKEN',
  'a second booking for the same slot fails with SLOT_TAKEN'
);

select throws_ok(
  $$ select public.book_appointment('a1000000-0000-4000-8000-000000000020', 'a1000000-0000-4000-8000-000000000031', tests.local_ts(1, '09:30')) $$,
  'P0001', 'SLOT_TAKEN',
  'a partially overlapping booking (09:30-10:30) fails with SLOT_TAKEN'
);

select lives_ok(
  $$ select public.book_appointment('a1000000-0000-4000-8000-000000000020', 'a1000000-0000-4000-8000-000000000030', tests.local_ts(1, '10:30')) $$,
  'a back-to-back booking (10:30) succeeds'
);

select throws_ok(
  $$ insert into public.bookings (customer_id, shop_id, barber_id, service_id, starts_at, ends_at, price_paise, duration_minutes)
     values ('a1000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000010', 'a1000000-0000-4000-8000-000000000020',
             'a1000000-0000-4000-8000-000000000030', tests.local_ts(1, '15:00'), tests.local_ts(1, '15:30'), 0, 30) $$,
  '42501', null,
  'authenticated users cannot insert bookings directly'
);

reset role;

select throws_ok(
  $$ insert into public.bookings (customer_id, shop_id, barber_id, service_id, starts_at, ends_at, price_paise, duration_minutes)
     values ('a1000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000010', 'a1000000-0000-4000-8000-000000000020',
             'a1000000-0000-4000-8000-000000000030', tests.local_ts(1, '10:15'), tests.local_ts(1, '10:45'), 0, 30) $$,
  '23P01', null,
  'even a privileged direct insert cannot overlap: the exclusion constraint rejects it'
);

select is(
  (select count(*)::int from public.bookings
   where barber_id = 'a1000000-0000-4000-8000-000000000020'
     and tstzrange(starts_at, ends_at) && tstzrange(tests.local_ts(1, '10:00'), tests.local_ts(1, '10:30'))),
  1,
  'exactly one booking holds the 10:00 slot'
);

-- Validation -------------------------------------------------------------------------------
select tests.login_as('a1000000-0000-4000-8000-000000000003');

select throws_ok(
  $$ select public.book_appointment('a1000000-0000-4000-8000-000000000020', 'a1000000-0000-4000-8000-000000000030', tests.local_ts(1, '08:30')) $$,
  'P0001', 'OUTSIDE_WORKING_HOURS', 'cannot book before opening'
);

select throws_ok(
  $$ select public.book_appointment('a1000000-0000-4000-8000-000000000020', 'a1000000-0000-4000-8000-000000000030', tests.local_ts(1, '17:45')) $$,
  'P0001', 'OUTSIDE_WORKING_HOURS', 'cannot book an appointment that runs past closing'
);

select throws_ok(
  $$ select public.book_appointment('a1000000-0000-4000-8000-000000000020', 'a1000000-0000-4000-8000-000000000030', tests.local_ts(1, '11:05')) $$,
  'P0001', 'INVALID_TIME', 'start time must be on the slot grid'
);

select throws_ok(
  $$ select public.book_appointment('a1000000-0000-4000-8000-000000000020', 'a1000000-0000-4000-8000-000000000030', tests.local_ts(2, '10:00')) $$,
  'P0001', 'BARBER_UNAVAILABLE', 'cannot book during time off'
);

select throws_ok(
  $$ select public.book_appointment('a1000000-0000-4000-8000-000000000020', 'a1000000-0000-4000-8000-000000000032', tests.local_ts(1, '12:00')) $$,
  'P0001', 'SERVICE_NOT_OFFERED', 'cannot book a service the barber does not offer'
);

select throws_ok(
  $$ select public.book_appointment('a1000000-0000-4000-8000-000000000021', 'a1000000-0000-4000-8000-000000000030', tests.local_ts(1, '12:00')) $$,
  'P0001', 'INVALID_BARBER', 'cannot book an inactive barber'
);

select throws_ok(
  $$ select public.book_appointment('a1000000-0000-4000-8000-000000000020', 'a1000000-0000-4000-8000-000000000030', tests.local_ts(-1, '10:00')) $$,
  'P0001', 'SLOT_IN_PAST', 'cannot book in the past'
);

select throws_ok(
  $$ select public.book_appointment('a1000000-0000-4000-8000-000000000020', 'a1000000-0000-4000-8000-000000000030', tests.local_ts(31, '10:00')) $$,
  'P0001', 'TOO_FAR_AHEAD', 'cannot book beyond max_days_ahead (30)'
);

select lives_ok(
  $$ select public.book_appointment('a1000000-0000-4000-8000-000000000020', 'a1000000-0000-4000-8000-000000000030', tests.local_ts(30, '10:00')) $$,
  'can book exactly max_days_ahead days out'
);

-- Limit of 3 active future bookings per customer --------------------------------------------
select tests.login_as('a1000000-0000-4000-8000-000000000002');

select lives_ok(
  $$ select public.book_appointment('a1000000-0000-4000-8000-000000000020', 'a1000000-0000-4000-8000-000000000030', tests.local_ts(1, '11:00')) $$,
  'customer 1 books a second appointment'
);

select lives_ok(
  $$ select public.book_appointment('a1000000-0000-4000-8000-000000000020', 'a1000000-0000-4000-8000-000000000030', tests.local_ts(1, '12:00')) $$,
  'customer 1 books a third appointment'
);

select throws_ok(
  $$ select public.book_appointment('a1000000-0000-4000-8000-000000000020', 'a1000000-0000-4000-8000-000000000030', tests.local_ts(1, '13:00')) $$,
  'P0001', 'BOOKING_LIMIT_REACHED', 'a fourth active booking is refused'
);

select lives_ok(
  $$ select public.cancel_booking((select id from public.bookings
       where customer_id = 'a1000000-0000-4000-8000-000000000002' and starts_at = tests.local_ts(1, '12:00'))) $$,
  'customer 1 cancels one booking'
);

select lives_ok(
  $$ select public.book_appointment('a1000000-0000-4000-8000-000000000020', 'a1000000-0000-4000-8000-000000000030', tests.local_ts(1, '13:00')) $$,
  'after cancelling, the customer can book again'
);

select tests.login_as('a1000000-0000-4000-8000-000000000003');

select lives_ok(
  $$ select public.book_appointment('a1000000-0000-4000-8000-000000000020', 'a1000000-0000-4000-8000-000000000030', tests.local_ts(1, '12:00')) $$,
  'a cancelled booking frees its slot for someone else'
);

-- Access -------------------------------------------------------------------------------------
select tests.login_anon();

select throws_ok(
  $$ select public.book_appointment('a1000000-0000-4000-8000-000000000020', 'a1000000-0000-4000-8000-000000000030', tests.local_ts(1, '14:00')) $$,
  '42501', null,
  'anonymous users cannot call book_appointment'
);

select tests.login_as('a1000000-0000-4000-8000-000000000002');

select is(
  (select count(*)::int from public.bookings),
  4,
  'customer 1 sees only their own bookings (3 active + 1 cancelled)'
);

select * from finish();
rollback;
