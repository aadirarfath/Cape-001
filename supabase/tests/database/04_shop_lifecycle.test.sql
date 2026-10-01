-- Self-serve shop creation, admin approval / suspension, inactive shops staying hidden and
-- unbookable, and nearby_shops (ST_DWithin, longitude first).
begin;
create extension if not exists pgtap with schema extensions;

select plan(30);

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

create function tests.new_shop_id() returns uuid
language sql stable security definer as $$
  select id from public.shops where slug = 'malabar-cuts-test'
$$;

grant execute on all functions in schema tests to anon, authenticated;

-- Fixtures -------------------------------------------------------------------------------------
-- U (...01) creates a shop, ADMIN (...02) approves it, C (...03) books, OTHER (...04) is nobody.
insert into auth.users (id, email) values
  ('d4000000-0000-4000-8000-000000000001', 'u@life.test'),
  ('d4000000-0000-4000-8000-000000000002', 'admin@life.test'),
  ('d4000000-0000-4000-8000-000000000003', 'c@life.test'),
  ('d4000000-0000-4000-8000-000000000004', 'other@life.test');

insert into public.platform_admins (user_id) values ('d4000000-0000-4000-8000-000000000002');

-- Active shops around central Kozhikode (75.7804, 11.2588) for the distance tests.
insert into public.shops (name, slug, address_line, location, is_active) values
  ('Near 1', 'life-near-1', 'Road', extensions.st_setsrid(extensions.st_makepoint(75.7900, 11.2600), 4326)::extensions.geography, true),  -- ~1 km
  ('Near 2', 'life-near-2', 'Road', extensions.st_setsrid(extensions.st_makepoint(75.7804, 11.2900), 4326)::extensions.geography, true),  -- ~3.5 km
  ('Far',    'life-far',    'Road', extensions.st_setsrid(extensions.st_makepoint(75.9500, 11.2588), 4326)::extensions.geography, true),  -- ~18 km
  ('Thrissur', 'life-very-far', 'Road', extensions.st_setsrid(extensions.st_makepoint(76.2144, 10.5276), 4326)::extensions.geography, true); -- ~95 km

-- Creating a shop ------------------------------------------------------------------------------
select tests.login_as('d4000000-0000-4000-8000-000000000001');

select lives_ok(
  $$ select public.create_shop('Malabar Cuts', 'malabar-cuts-test', 75.7804, 11.2588, 'SM Street', p_area => 'Mittai Theruvu', p_city => 'Kozhikode') $$,
  'an authenticated user can create a shop'
);

select results_eq(
  $$ select is_active, approved_at is null, created_by from public.shops where slug = 'malabar-cuts-test' $$,
  $$ values (false, true, 'd4000000-0000-4000-8000-000000000001'::uuid) $$,
  'the new shop starts inactive and unapproved; its creator can still see it'
);

select results_eq(
  $$ select user_id, role::text from public.shop_members where shop_id = tests.new_shop_id() $$,
  $$ values ('d4000000-0000-4000-8000-000000000001'::uuid, 'owner') $$,
  'the creator becomes the owner'
);

select throws_ok(
  $$ select public.create_shop('Copycat', 'malabar-cuts-test', 75.78, 11.25, 'Elsewhere') $$,
  'P0001', 'SLUG_TAKEN',
  'slugs are unique'
);

select throws_ok(
  $$ select public.create_shop('Nowhere', 'nowhere-shop', 200, 11.25, 'Nowhere') $$,
  'P0001', 'INVALID_LOCATION',
  'coordinates are validated'
);

select throws_ok(
  $$ update public.shops set is_active = true where id = tests.new_shop_id() $$,
  '42501', null,
  'the owner cannot activate their own shop'
);

select throws_ok(
  $$ select public.approve_shop(tests.new_shop_id()) $$,
  'P0001', 'NOT_AUTHORIZED',
  'the owner cannot approve their own shop'
);

-- The owner can set the shop up while it waits for approval.
select lives_ok(
  $$ insert into public.barbers (id, shop_id, display_name)
     values ('d4000000-0000-4000-8000-000000000020', tests.new_shop_id(), 'Basheer') $$,
  'owner adds a barber before approval'
);

select lives_ok(
  $$ insert into public.services (id, shop_id, name, duration_minutes, price_paise)
     values ('d4000000-0000-4000-8000-000000000030', tests.new_shop_id(), 'Haircut', 30, 20000) $$,
  'owner adds a service before approval'
);

select lives_ok(
  $$ insert into public.barber_services (barber_id, service_id, shop_id)
     values ('d4000000-0000-4000-8000-000000000020', 'd4000000-0000-4000-8000-000000000030', tests.new_shop_id()) $$,
  'owner assigns the service to the barber'
);

select lives_ok(
  $$ insert into public.working_hours (barber_id, shop_id, weekday, start_time, end_time)
     select 'd4000000-0000-4000-8000-000000000020', tests.new_shop_id(), d, '09:00', '18:00'
     from generate_series(0, 6) as d $$,
  'owner sets working hours'
);

-- While inactive: hidden and unbookable -----------------------------------------------------------
select tests.login_anon();

select is_empty(
  $$ select 1 from public.shops where slug = 'malabar-cuts-test' $$,
  'anon cannot see an inactive shop'
);

select is_empty(
  $$ select 1 from public.nearby_shops(75.7804, 11.2588, 1000) where slug = 'malabar-cuts-test' $$,
  'an inactive shop is not returned by nearby_shops'
);

select is_empty(
  $$ select 1 from public.get_available_slots('d4000000-0000-4000-8000-000000000020', 'd4000000-0000-4000-8000-000000000030', tests.local_date(1)) $$,
  'an inactive shop has no available slots'
);

select tests.login_as('d4000000-0000-4000-8000-000000000003');

select throws_ok(
  $$ select public.book_appointment('d4000000-0000-4000-8000-000000000020', 'd4000000-0000-4000-8000-000000000030', tests.local_ts(1, '10:00')) $$,
  'P0001', 'SHOP_UNAVAILABLE',
  'an inactive shop does not accept bookings'
);

-- Approval ---------------------------------------------------------------------------------------
select tests.login_as('d4000000-0000-4000-8000-000000000002');

select lives_ok(
  $$ select public.approve_shop(tests.new_shop_id()) $$,
  'a platform admin approves the shop'
);

select results_eq(
  $$ select is_active, approved_by, approved_at is not null from public.shops where slug = 'malabar-cuts-test' $$,
  $$ values (true, 'd4000000-0000-4000-8000-000000000002'::uuid, true) $$,
  'approval activates the shop and records who approved it'
);

select tests.login_anon();

select isnt_empty(
  $$ select 1 from public.nearby_shops(75.7804, 11.2588, 1000) where slug = 'malabar-cuts-test' $$,
  'the approved shop appears in nearby_shops'
);

select isnt_empty(
  $$ select 1 from public.get_available_slots('d4000000-0000-4000-8000-000000000020', 'd4000000-0000-4000-8000-000000000030', tests.local_date(1)) $$,
  'the approved shop has available slots'
);

select tests.login_as('d4000000-0000-4000-8000-000000000003');

select lives_ok(
  $$ select public.book_appointment('d4000000-0000-4000-8000-000000000020', 'd4000000-0000-4000-8000-000000000030', tests.local_ts(1, '10:00')) $$,
  'the approved shop accepts bookings'
);

-- Suspension -------------------------------------------------------------------------------------
select tests.login_as('d4000000-0000-4000-8000-000000000004');

select throws_ok(
  $$ select public.suspend_shop(tests.new_shop_id()) $$,
  'P0001', 'NOT_AUTHORIZED',
  'non-admins cannot suspend shops'
);

select tests.login_as('d4000000-0000-4000-8000-000000000002');

select lives_ok(
  $$ select public.suspend_shop(tests.new_shop_id()) $$,
  'a platform admin suspends the shop'
);

select tests.login_anon();

select is_empty(
  $$ select 1 from public.nearby_shops(75.7804, 11.2588, 1000) where slug = 'malabar-cuts-test' $$,
  'a suspended shop disappears from nearby_shops'
);

select tests.login_as('d4000000-0000-4000-8000-000000000003');

select throws_ok(
  $$ select public.book_appointment('d4000000-0000-4000-8000-000000000020', 'd4000000-0000-4000-8000-000000000030', tests.local_ts(1, '11:00')) $$,
  'P0001', 'SHOP_UNAVAILABLE',
  'a suspended shop does not accept bookings'
);

-- nearby_shops ---------------------------------------------------------------------------------
select tests.login_anon();

select results_eq(
  $$ select slug from public.nearby_shops(75.7804, 11.2588, 5000) where slug like 'life-%' $$,
  $$ values ('life-near-1'), ('life-near-2') $$,
  'nearby_shops returns shops within the radius, nearest first'
);

select results_eq(
  $$ select slug from public.nearby_shops(75.7804, 11.2588, 30000) where slug like 'life-%' $$,
  $$ values ('life-near-1'), ('life-near-2'), ('life-far') $$,
  'a larger radius includes farther shops'
);

select is_empty(
  $$ select 1 from public.nearby_shops(75.7804, 11.2588, 1000000) where slug = 'life-very-far' $$,
  'the radius is capped at 50 km'
);

select is_empty(
  $$ select 1 from public.nearby_shops(11.2588, 75.7804, 50000) where slug like 'life-%' $$,
  'arguments are longitude first: swapping them finds nothing here'
);

select ok(
  (select distance_m between 900 and 1300 from public.nearby_shops(75.7804, 11.2588, 5000) where slug = 'life-near-1'),
  'distance_m is in metres'
);

select throws_ok(
  $$ select * from public.nearby_shops(75.78, 95) $$,
  'P0001', 'INVALID_LOCATION',
  'out-of-range latitude is rejected'
);

select * from finish();
rollback;
