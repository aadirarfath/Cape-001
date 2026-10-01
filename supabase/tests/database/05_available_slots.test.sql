-- get_available_slots: grid generation, bookings, time off and per-shop settings.
begin;
create extension if not exists pgtap with schema extensions;

select plan(11);

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
insert into auth.users (id, email) values
  ('e5000000-0000-4000-8000-000000000001', 'c@slots.test');

insert into public.shops (id, name, slug, address_line, location, is_active, slot_interval_minutes, max_days_ahead) values
  ('e5000000-0000-4000-8000-000000000010', 'Slots Shop', 'slots-shop', 'Road',
   extensions.st_setsrid(extensions.st_makepoint(75.78, 11.25), 4326)::extensions.geography, true, 15, 30);

insert into public.barbers (id, shop_id, display_name) values
  ('e5000000-0000-4000-8000-000000000020', 'e5000000-0000-4000-8000-000000000010', 'Slot Barber');

insert into public.services (id, shop_id, name, duration_minutes, price_paise) values
  ('e5000000-0000-4000-8000-000000000030', 'e5000000-0000-4000-8000-000000000010', 'Cut', 30, 20000),
  ('e5000000-0000-4000-8000-000000000031', 'e5000000-0000-4000-8000-000000000010', 'Not offered', 30, 20000);

insert into public.barber_services (barber_id, service_id, shop_id) values
  ('e5000000-0000-4000-8000-000000000020', 'e5000000-0000-4000-8000-000000000030', 'e5000000-0000-4000-8000-000000000010');

-- 09:00-12:00 every day.
insert into public.working_hours (barber_id, shop_id, weekday, start_time, end_time)
select 'e5000000-0000-4000-8000-000000000020', 'e5000000-0000-4000-8000-000000000010', d, '09:00', '12:00'
from generate_series(0, 6) as d;

-- Tests ----------------------------------------------------------------------------------------
select tests.login_anon();

select results_eq(
  $$ select starts_at from public.get_available_slots('e5000000-0000-4000-8000-000000000020', 'e5000000-0000-4000-8000-000000000030', tests.local_date(1)) $$,
  $$ select generate_series(tests.local_ts(1, '09:00'), tests.local_ts(1, '11:30'), interval '15 minutes') $$,
  'an empty day offers every 15-minute start whose 30-minute service fits before 12:00'
);

select is_empty(
  $$ select 1 from public.get_available_slots('e5000000-0000-4000-8000-000000000020', 'e5000000-0000-4000-8000-000000000030', tests.local_date(1))
     where ends_at <> starts_at + interval '30 minutes' $$,
  'each slot lasts the service duration'
);

reset role;

-- Tomorrow: an active booking 10:00-10:30, a cancelled one 09:00-09:30, time off 11:00-12:00.
insert into public.bookings (customer_id, shop_id, barber_id, service_id, starts_at, ends_at, status, price_paise, duration_minutes) values
  ('e5000000-0000-4000-8000-000000000001', 'e5000000-0000-4000-8000-000000000010', 'e5000000-0000-4000-8000-000000000020',
   'e5000000-0000-4000-8000-000000000030', tests.local_ts(1, '10:00'), tests.local_ts(1, '10:30'), 'confirmed', 20000, 30),
  ('e5000000-0000-4000-8000-000000000001', 'e5000000-0000-4000-8000-000000000010', 'e5000000-0000-4000-8000-000000000020',
   'e5000000-0000-4000-8000-000000000030', tests.local_ts(1, '09:00'), tests.local_ts(1, '09:30'), 'cancelled', 20000, 30);

insert into public.time_off (barber_id, shop_id, starts_at, ends_at) values
  ('e5000000-0000-4000-8000-000000000020', 'e5000000-0000-4000-8000-000000000010', tests.local_ts(1, '11:00'), tests.local_ts(1, '12:00'));

select tests.login_anon();

select results_eq(
  $$ select starts_at from public.get_available_slots('e5000000-0000-4000-8000-000000000020', 'e5000000-0000-4000-8000-000000000030', tests.local_date(1)) $$,
  $$ values (tests.local_ts(1, '09:00')), (tests.local_ts(1, '09:15')), (tests.local_ts(1, '09:30')), (tests.local_ts(1, '10:30')) $$,
  'active bookings and time off remove overlapping slots; cancelled bookings do not'
);

select is_empty(
  $$ select 1 from public.get_available_slots('e5000000-0000-4000-8000-000000000020', 'e5000000-0000-4000-8000-000000000031', tests.local_date(1)) $$,
  'no slots for a service the barber does not offer'
);

select is_empty(
  $$ select 1 from public.get_available_slots('e5000000-0000-4000-8000-000000000020', 'e5000000-0000-4000-8000-000000000030', tests.local_date(-1)) $$,
  'no slots in the past'
);

select isnt_empty(
  $$ select 1 from public.get_available_slots('e5000000-0000-4000-8000-000000000020', 'e5000000-0000-4000-8000-000000000030', tests.local_date(30)) $$,
  'slots exist exactly max_days_ahead days out'
);

select is_empty(
  $$ select 1 from public.get_available_slots('e5000000-0000-4000-8000-000000000020', 'e5000000-0000-4000-8000-000000000030', tests.local_date(31)) $$,
  'no slots beyond max_days_ahead'
);

-- Per-shop slot interval.
reset role;
update public.shops set slot_interval_minutes = 30 where id = 'e5000000-0000-4000-8000-000000000010';
select tests.login_anon();

select results_eq(
  $$ select starts_at from public.get_available_slots('e5000000-0000-4000-8000-000000000020', 'e5000000-0000-4000-8000-000000000030', tests.local_date(2)) $$,
  $$ select generate_series(tests.local_ts(2, '09:00'), tests.local_ts(2, '11:30'), interval '30 minutes') $$,
  'slot_interval_minutes controls the grid'
);

-- Slots from get_available_slots are bookable, and then disappear.
select tests.login_as('e5000000-0000-4000-8000-000000000001');

select lives_ok(
  $$ select public.book_appointment('e5000000-0000-4000-8000-000000000020', 'e5000000-0000-4000-8000-000000000030',
       (select min(starts_at) from public.get_available_slots('e5000000-0000-4000-8000-000000000020', 'e5000000-0000-4000-8000-000000000030', tests.local_date(2)))) $$,
  'the first offered slot can be booked'
);

select results_eq(
  $$ select starts_at from public.get_available_slots('e5000000-0000-4000-8000-000000000020', 'e5000000-0000-4000-8000-000000000030', tests.local_date(2)) $$,
  $$ select generate_series(tests.local_ts(2, '09:30'), tests.local_ts(2, '11:30'), interval '30 minutes') $$,
  'the booked slot is no longer offered'
);

-- Inactive barbers have no slots.
reset role;
update public.barbers set is_active = false where id = 'e5000000-0000-4000-8000-000000000020';
select tests.login_anon();

select is_empty(
  $$ select 1 from public.get_available_slots('e5000000-0000-4000-8000-000000000020', 'e5000000-0000-4000-8000-000000000030', tests.local_date(3)) $$,
  'an inactive barber has no slots'
);

select * from finish();
rollback;
