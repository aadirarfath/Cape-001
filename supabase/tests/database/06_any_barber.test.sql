-- "Any available barber": get_available_slots_any and book_any_barber.
begin;
create extension if not exists pgtap with schema extensions;

select plan(14);

-- Helpers ------------------------------------------------------------------------------------
create schema tests;
grant usage on schema tests to anon, authenticated;

create function tests.local_ts(p_days integer, p_time time) returns timestamptz
language sql stable as $$
  select ((now() at time zone 'Asia/Kolkata')::date + p_days + p_time) at time zone 'Asia/Kolkata'
$$;

create function tests.local_date(p_days integer) returns date
language sql stable as $$
  select (now() at time zone 'Asia/Kolkata')::date + p_days
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

-- Fixtures -------------------------------------------------------------------------------------
-- Shop with a 15-minute grid and a 30-minute service.
--   B1 (sort 1) offers it, 09:00-12:00
--   B2 (sort 2) offers it, 10:00-13:00
--   B3 does NOT offer it, 08:00-09:00
--   B4 offers it but is inactive, 07:00-08:00
insert into auth.users (id, email) values
  ('e6000000-0000-4000-8000-000000000001', 'c1@any.test'),
  ('e6000000-0000-4000-8000-000000000002', 'c2@any.test'),
  ('e6000000-0000-4000-8000-000000000003', 'c3@any.test'),
  ('e6000000-0000-4000-8000-000000000004', 'c4@any.test');

insert into public.shops (id, name, slug, address_line, location, is_active, slot_interval_minutes, max_days_ahead) values
  ('e6000000-0000-4000-8000-000000000010', 'Any Shop', 'any-shop', 'Road',
   extensions.st_setsrid(extensions.st_makepoint(76.30, 10.02), 4326)::extensions.geography, true, 15, 30);

insert into public.barbers (id, shop_id, display_name, sort_order, is_active) values
  ('e6000000-0000-4000-8000-000000000021', 'e6000000-0000-4000-8000-000000000010', 'B1', 1, true),
  ('e6000000-0000-4000-8000-000000000022', 'e6000000-0000-4000-8000-000000000010', 'B2', 2, true),
  ('e6000000-0000-4000-8000-000000000023', 'e6000000-0000-4000-8000-000000000010', 'B3', 3, true),
  ('e6000000-0000-4000-8000-000000000024', 'e6000000-0000-4000-8000-000000000010', 'B4', 4, false);

insert into public.services (id, shop_id, name, duration_minutes, price_paise) values
  ('e6000000-0000-4000-8000-000000000030', 'e6000000-0000-4000-8000-000000000010', 'Cut', 30, 20000),
  ('e6000000-0000-4000-8000-000000000031', 'e6000000-0000-4000-8000-000000000010', 'Shave', 30, 15000);

insert into public.barber_services (barber_id, service_id, shop_id) values
  ('e6000000-0000-4000-8000-000000000021', 'e6000000-0000-4000-8000-000000000030', 'e6000000-0000-4000-8000-000000000010'),
  ('e6000000-0000-4000-8000-000000000022', 'e6000000-0000-4000-8000-000000000030', 'e6000000-0000-4000-8000-000000000010'),
  ('e6000000-0000-4000-8000-000000000023', 'e6000000-0000-4000-8000-000000000031', 'e6000000-0000-4000-8000-000000000010'),
  ('e6000000-0000-4000-8000-000000000024', 'e6000000-0000-4000-8000-000000000030', 'e6000000-0000-4000-8000-000000000010');

insert into public.working_hours (barber_id, shop_id, weekday, start_time, end_time)
select b, 'e6000000-0000-4000-8000-000000000010', d, s, e
from generate_series(0, 6) as d
cross join (values
  ('e6000000-0000-4000-8000-000000000021'::uuid, time '09:00', time '12:00'),
  ('e6000000-0000-4000-8000-000000000022'::uuid, time '10:00', time '13:00'),
  ('e6000000-0000-4000-8000-000000000023'::uuid, time '08:00', time '09:00'),
  ('e6000000-0000-4000-8000-000000000024'::uuid, time '07:00', time '08:00')
) as w (b, s, e);

-- Combined slots -------------------------------------------------------------------------------
select tests.login_anon();

select results_eq(
  $$ select starts_at from public.get_available_slots_any('e6000000-0000-4000-8000-000000000010', 'e6000000-0000-4000-8000-000000000030', tests.local_date(1)) $$,
  $$ select generate_series(tests.local_ts(1, '09:00'), tests.local_ts(1, '12:30'), interval '15 minutes') $$,
  'combined slots are the union of eligible barbers; non-offering and inactive barbers are ignored'
);

select throws_ok(
  $$ select public.book_any_barber('e6000000-0000-4000-8000-000000000010', 'e6000000-0000-4000-8000-000000000030', tests.local_ts(1, '10:00')) $$,
  '42501', null,
  'anon cannot book'
);

-- Booking ----------------------------------------------------------------------------------------
select tests.login_as('e6000000-0000-4000-8000-000000000001');
select results_eq(
  $$ select barber_id from public.book_any_barber('e6000000-0000-4000-8000-000000000010', 'e6000000-0000-4000-8000-000000000030', tests.local_ts(1, '10:00')) $$,
  $$ values ('e6000000-0000-4000-8000-000000000021'::uuid) $$,
  'with equal load, the first barber by sort order is booked'
);

select tests.login_as('e6000000-0000-4000-8000-000000000002');
select results_eq(
  $$ select barber_id from public.book_any_barber('e6000000-0000-4000-8000-000000000010', 'e6000000-0000-4000-8000-000000000030', tests.local_ts(1, '10:00')) $$,
  $$ values ('e6000000-0000-4000-8000-000000000022'::uuid) $$,
  'when one barber is taken, another free barber gets the booking'
);

select tests.login_as('e6000000-0000-4000-8000-000000000003');
select throws_ok(
  $$ select public.book_any_barber('e6000000-0000-4000-8000-000000000010', 'e6000000-0000-4000-8000-000000000030', tests.local_ts(1, '10:00')) $$,
  'P0001', 'SLOT_TAKEN',
  'when every barber is taken the result is SLOT_TAKEN'
);

select tests.login_anon();
select is_empty(
  $$ select 1 from public.get_available_slots_any('e6000000-0000-4000-8000-000000000010', 'e6000000-0000-4000-8000-000000000030', tests.local_date(1))
     where starts_at = tests.local_ts(1, '10:00') $$,
  'a time with every barber booked disappears from the combined slots'
);

-- Load balancing: give B1 a second booking, then the next "any" booking goes to B2.
select tests.login_as('e6000000-0000-4000-8000-000000000003');
select public.book_appointment('e6000000-0000-4000-8000-000000000021', 'e6000000-0000-4000-8000-000000000030', tests.local_ts(1, '09:00'));

select tests.login_as('e6000000-0000-4000-8000-000000000004');
select results_eq(
  $$ select barber_id from public.book_any_barber('e6000000-0000-4000-8000-000000000010', 'e6000000-0000-4000-8000-000000000030', tests.local_ts(1, '11:00')) $$,
  $$ values ('e6000000-0000-4000-8000-000000000022'::uuid) $$,
  'the barber with fewer bookings that day is preferred'
);

-- B1 (2 bookings) and B2 (2 bookings) tie, so B1 is tried first, but 12:15 is outside B1's hours.
select tests.login_as('e6000000-0000-4000-8000-000000000001');
select results_eq(
  $$ select barber_id from public.book_any_barber('e6000000-0000-4000-8000-000000000010', 'e6000000-0000-4000-8000-000000000030', tests.local_ts(1, '12:15')) $$,
  $$ values ('e6000000-0000-4000-8000-000000000022'::uuid) $$,
  'barbers whose hours do not cover the time are skipped'
);

select throws_ok(
  $$ select public.book_any_barber('e6000000-0000-4000-8000-000000000010', 'e6000000-0000-4000-8000-000000000030', tests.local_ts(1, '08:00')) $$,
  'P0001', 'OUTSIDE_WORKING_HOURS',
  'a time no offering barber works is OUTSIDE_WORKING_HOURS (the non-offering B3 is not used)'
);

select throws_ok(
  $$ select public.book_any_barber('e6000000-0000-4000-8000-000000000010', 'e6000000-0000-4000-8000-000000000030', tests.local_ts(-1, '10:00')) $$,
  'P0001', 'SLOT_IN_PAST',
  'rule errors that do not depend on the barber are raised directly'
);

select throws_ok(
  $$ select public.book_any_barber('e6000000-0000-4000-8000-000000000010', gen_random_uuid(), tests.local_ts(1, '10:30')) $$,
  'P0001', 'INVALID_SERVICE',
  'a service outside the shop is rejected'
);

-- Customer 1 has 2 active bookings; the third succeeds and the fourth hits the limit.
select lives_ok(
  $$ select public.book_any_barber('e6000000-0000-4000-8000-000000000010', 'e6000000-0000-4000-8000-000000000030', tests.local_ts(1, '11:30')) $$,
  'third active booking succeeds'
);

select throws_ok(
  $$ select public.book_any_barber('e6000000-0000-4000-8000-000000000010', 'e6000000-0000-4000-8000-000000000030', tests.local_ts(2, '11:30')) $$,
  'P0001', 'BOOKING_LIMIT_REACHED',
  'the booking limit is raised, not swallowed'
);

reset role;
update public.shops set is_active = false where id = 'e6000000-0000-4000-8000-000000000010';
select tests.login_as('e6000000-0000-4000-8000-000000000004');
select throws_ok(
  $$ select public.book_any_barber('e6000000-0000-4000-8000-000000000010', 'e6000000-0000-4000-8000-000000000030', tests.local_ts(1, '09:30')) $$,
  'P0001', 'SHOP_UNAVAILABLE',
  'an inactive shop cannot be booked'
);

select * from finish();
rollback;
