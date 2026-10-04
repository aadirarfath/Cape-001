-- Partner app functions: my_shops, set_shop_location, set_barber_services, set_working_hours.
begin;
create extension if not exists pgtap with schema extensions;

select plan(27);

-- Helpers ------------------------------------------------------------------------------------
create schema tests;
grant usage on schema tests to anon, authenticated;

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
-- e10..01 owner A, 02 manager A, 03 barber A (linked to barber A1), 04 owner B.
insert into auth.users (id, email) values
  ('e1000000-0000-4000-8000-000000000001', 'owner.a@staff.test'),
  ('e1000000-0000-4000-8000-000000000002', 'manager.a@staff.test'),
  ('e1000000-0000-4000-8000-000000000003', 'barber.a@staff.test'),
  ('e1000000-0000-4000-8000-000000000004', 'owner.b@staff.test');

insert into public.shops (id, name, slug, address_line, location, is_active) values
  ('e1000000-0000-4000-8000-00000000000a', 'Staff Shop A', 'staff-shop-a', 'Road',
   extensions.st_setsrid(extensions.st_makepoint(76.30, 10.02), 4326)::extensions.geography, false),
  ('e1000000-0000-4000-8000-00000000000b', 'Staff Shop B', 'staff-shop-b', 'Road',
   extensions.st_setsrid(extensions.st_makepoint(76.31, 10.03), 4326)::extensions.geography, true);

insert into public.shop_members (shop_id, user_id, role) values
  ('e1000000-0000-4000-8000-00000000000a', 'e1000000-0000-4000-8000-000000000001', 'owner'),
  ('e1000000-0000-4000-8000-00000000000a', 'e1000000-0000-4000-8000-000000000002', 'manager'),
  ('e1000000-0000-4000-8000-00000000000a', 'e1000000-0000-4000-8000-000000000003', 'barber'),
  ('e1000000-0000-4000-8000-00000000000b', 'e1000000-0000-4000-8000-000000000004', 'owner');

insert into public.barbers (id, shop_id, user_id, display_name) values
  ('e1000000-0000-4000-8000-0000000000a1', 'e1000000-0000-4000-8000-00000000000a', 'e1000000-0000-4000-8000-000000000003', 'Arun'),
  ('e1000000-0000-4000-8000-0000000000a2', 'e1000000-0000-4000-8000-00000000000a', null, 'Bijoy');

insert into public.services (id, shop_id, name, duration_minutes, price_paise) values
  ('e1000000-0000-4000-8000-0000000000c1', 'e1000000-0000-4000-8000-00000000000a', 'Haircut', 30, 20000),
  ('e1000000-0000-4000-8000-0000000000c2', 'e1000000-0000-4000-8000-00000000000a', 'Beard', 15, 10000),
  ('e1000000-0000-4000-8000-0000000000c3', 'e1000000-0000-4000-8000-00000000000b', 'Other shop', 30, 20000);

-- my_shops -------------------------------------------------------------------------------------
select tests.login_as('e1000000-0000-4000-8000-000000000001');
select results_eq(
  $$ select shop_id, role, barber_id, round(lng::numeric, 2), round(lat::numeric, 2) from public.my_shops() $$,
  $$ values ('e1000000-0000-4000-8000-00000000000a'::uuid, 'owner'::public.shop_role, null::uuid, 76.30, 10.02) $$,
  'my_shops returns the owner''s shop (even while inactive), role and coordinates'
);

select tests.login_as('e1000000-0000-4000-8000-000000000003');
select results_eq(
  $$ select shop_id, role, barber_id from public.my_shops() $$,
  $$ values ('e1000000-0000-4000-8000-00000000000a'::uuid, 'barber'::public.shop_role,
             'e1000000-0000-4000-8000-0000000000a1'::uuid) $$,
  'my_shops returns a barber''s own barbers row'
);

select tests.login_anon();
select throws_ok(
  $$ select * from public.my_shops() $$,
  '42501', null,
  'anon cannot call my_shops'
);

-- set_shop_location ----------------------------------------------------------------------------
select tests.login_as('e1000000-0000-4000-8000-000000000002');
select lives_ok(
  $$ select public.set_shop_location('e1000000-0000-4000-8000-00000000000a', 76.2673, 9.9312) $$,
  'a manager can move the shop pin'
);

select results_eq(
  $$ select round(lng::numeric, 4), round(lat::numeric, 4) from public.my_shops() $$,
  $$ values (76.2673, 9.9312) $$,
  'the new location is stored'
);

select throws_ok(
  $$ select public.set_shop_location('e1000000-0000-4000-8000-00000000000a', 200, 9.9) $$,
  'P0001', 'INVALID_LOCATION',
  'an out-of-range location is rejected'
);

select tests.login_as('e1000000-0000-4000-8000-000000000003');
select throws_ok(
  $$ select public.set_shop_location('e1000000-0000-4000-8000-00000000000a', 76.0, 10.0) $$,
  'P0001', 'NOT_AUTHORIZED',
  'a barber cannot move the shop pin'
);

select tests.login_as('e1000000-0000-4000-8000-000000000004');
select throws_ok(
  $$ select public.set_shop_location('e1000000-0000-4000-8000-00000000000a', 76.0, 10.0) $$,
  'P0001', 'NOT_AUTHORIZED',
  'another shop''s owner cannot move the shop pin'
);

-- set_barber_services --------------------------------------------------------------------------
select tests.login_as('e1000000-0000-4000-8000-000000000002');
select results_eq(
  $$ select service_id from public.set_barber_services('e1000000-0000-4000-8000-0000000000a2',
       array['e1000000-0000-4000-8000-0000000000c1', 'e1000000-0000-4000-8000-0000000000c2']::uuid[])
     order by service_id $$,
  $$ values ('e1000000-0000-4000-8000-0000000000c1'::uuid), ('e1000000-0000-4000-8000-0000000000c2'::uuid) $$,
  'a manager assigns services to a barber'
);

select results_eq(
  $$ select service_id from public.set_barber_services('e1000000-0000-4000-8000-0000000000a2',
       array['e1000000-0000-4000-8000-0000000000c2']::uuid[]) $$,
  $$ values ('e1000000-0000-4000-8000-0000000000c2'::uuid) $$,
  'services left out of the list are removed'
);

select throws_ok(
  $$ select public.set_barber_services('e1000000-0000-4000-8000-0000000000a2',
       array['e1000000-0000-4000-8000-0000000000c3']::uuid[]) $$,
  'P0001', 'INVALID_SERVICE',
  'another shop''s service cannot be assigned'
);

select is(
  (select count(*)::int from public.barber_services where barber_id = 'e1000000-0000-4000-8000-0000000000a2'),
  1,
  'a rejected save leaves the existing services untouched'
);

select is_empty(
  $$ select * from public.set_barber_services('e1000000-0000-4000-8000-0000000000a2', '{}'::uuid[]) $$,
  'an empty list removes every service'
);

select throws_ok(
  $$ select public.set_barber_services('e1000000-0000-4000-8000-0000000000ff', '{}'::uuid[]) $$,
  'P0001', 'INVALID_BARBER',
  'an unknown barber is rejected'
);

select tests.login_as('e1000000-0000-4000-8000-000000000003');
select throws_ok(
  $$ select public.set_barber_services('e1000000-0000-4000-8000-0000000000a1',
       array['e1000000-0000-4000-8000-0000000000c1']::uuid[]) $$,
  'P0001', 'NOT_AUTHORIZED',
  'a barber cannot change their own services'
);

select tests.login_as('e1000000-0000-4000-8000-000000000004');
select throws_ok(
  $$ select public.set_barber_services('e1000000-0000-4000-8000-0000000000a2', '{}'::uuid[]) $$,
  'P0001', 'NOT_AUTHORIZED',
  'another shop''s owner cannot change services'
);

-- set_working_hours ----------------------------------------------------------------------------
select tests.login_as('e1000000-0000-4000-8000-000000000001');
select results_eq(
  $$ select weekday, start_time, end_time from public.set_working_hours('e1000000-0000-4000-8000-0000000000a2',
       '[{"weekday": 1, "start_time": "09:30", "end_time": "13:30"},
         {"weekday": 1, "start_time": "14:30", "end_time": "20:00"},
         {"weekday": 2, "start_time": "10:00", "end_time": "18:00"}]') $$,
  $$ values (1::smallint, '09:30'::time, '13:30'::time),
            (1::smallint, '14:30'::time, '20:00'::time),
            (2::smallint, '10:00'::time, '18:00'::time) $$,
  'the owner sets weekly hours with a split shift'
);

select results_eq(
  $$ select weekday, start_time, end_time from public.set_working_hours('e1000000-0000-4000-8000-0000000000a2',
       '[{"weekday": 0, "start_time": "10:00", "end_time": "14:00"}]') $$,
  $$ values (0::smallint, '10:00'::time, '14:00'::time) $$,
  'saving again replaces all previous hours'
);

select throws_ok(
  $$ select public.set_working_hours('e1000000-0000-4000-8000-0000000000a2',
       '[{"weekday": 3, "start_time": "09:00", "end_time": "13:00"},
         {"weekday": 3, "start_time": "12:00", "end_time": "18:00"}]') $$,
  'P0001', 'INVALID_WORKING_HOURS',
  'overlapping shifts on one day are rejected'
);

select results_eq(
  $$ select weekday, start_time from public.working_hours where barber_id = 'e1000000-0000-4000-8000-0000000000a2' $$,
  $$ values (0::smallint, '10:00'::time) $$,
  'a rejected save keeps the previous hours'
);

select throws_ok(
  $$ select public.set_working_hours('e1000000-0000-4000-8000-0000000000a2',
       '[{"weekday": 3, "start_time": "18:00", "end_time": "09:00"}]') $$,
  'P0001', 'INVALID_WORKING_HOURS',
  'an end time before the start time is rejected'
);

select throws_ok(
  $$ select public.set_working_hours('e1000000-0000-4000-8000-0000000000a2',
       '[{"weekday": 7, "start_time": "09:00", "end_time": "18:00"}]') $$,
  'P0001', 'INVALID_WORKING_HOURS',
  'a weekday outside 0-6 is rejected'
);

select throws_ok(
  $$ select public.set_working_hours('e1000000-0000-4000-8000-0000000000a2',
       '[{"weekday": 3, "start_time": "nine", "end_time": "18:00"}]') $$,
  'P0001', 'INVALID_WORKING_HOURS',
  'a malformed time is rejected'
);

select throws_ok(
  $$ select public.set_working_hours('e1000000-0000-4000-8000-0000000000a2', '{"weekday": 3}') $$,
  'P0001', 'INVALID_WORKING_HOURS',
  'a value that is not an array is rejected'
);

select is_empty(
  $$ select * from public.set_working_hours('e1000000-0000-4000-8000-0000000000a2', '[]') $$,
  'an empty array clears the barber''s hours'
);

select tests.login_as('e1000000-0000-4000-8000-000000000003');
select throws_ok(
  $$ select public.set_working_hours('e1000000-0000-4000-8000-0000000000a1', '[]') $$,
  'P0001', 'NOT_AUTHORIZED',
  'a barber cannot change their own working hours'
);

select tests.login_as('e1000000-0000-4000-8000-000000000004');
select throws_ok(
  $$ select public.set_working_hours('e1000000-0000-4000-8000-0000000000a2', '[]') $$,
  'P0001', 'NOT_AUTHORIZED',
  'another shop''s owner cannot change working hours'
);

select * from finish();
rollback;
