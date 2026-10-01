-- RLS: shop staff are confined to their own shop, barbers to their own bookings/time off,
-- customers to their own bookings, and anon to public catalogue data.
begin;
create extension if not exists pgtap with schema extensions;

select plan(32);

-- Helpers ------------------------------------------------------------------------------------
create schema tests;
grant usage on schema tests to anon, authenticated;

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

-- Fixtures -------------------------------------------------------------------------------------
-- Shop A (...10): owner OA (...01), manager MA (...02), barber user BA (...03) linked to barber A1.
-- Shop B (...11): owner OB (...04).
-- Customers: C1 (...05) booked at A with A1, C2 (...06) at A with A2, C3 (...07) at B.
insert into auth.users (id, email) values
  ('b2000000-0000-4000-8000-000000000001', 'oa@rls.test'),
  ('b2000000-0000-4000-8000-000000000002', 'ma@rls.test'),
  ('b2000000-0000-4000-8000-000000000003', 'ba@rls.test'),
  ('b2000000-0000-4000-8000-000000000004', 'ob@rls.test'),
  ('b2000000-0000-4000-8000-000000000005', 'c1@rls.test'),
  ('b2000000-0000-4000-8000-000000000006', 'c2@rls.test'),
  ('b2000000-0000-4000-8000-000000000007', 'c3@rls.test');

insert into public.shops (id, name, slug, address_line, location, is_active) values
  ('b2000000-0000-4000-8000-000000000010', 'Shop A', 'rls-shop-a', 'A Road',
   extensions.st_setsrid(extensions.st_makepoint(75.78, 11.25), 4326)::extensions.geography, true),
  ('b2000000-0000-4000-8000-000000000011', 'Shop B', 'rls-shop-b', 'B Road',
   extensions.st_setsrid(extensions.st_makepoint(75.79, 11.26), 4326)::extensions.geography, true);

insert into public.shop_members (shop_id, user_id, role) values
  ('b2000000-0000-4000-8000-000000000010', 'b2000000-0000-4000-8000-000000000001', 'owner'),
  ('b2000000-0000-4000-8000-000000000010', 'b2000000-0000-4000-8000-000000000002', 'manager'),
  ('b2000000-0000-4000-8000-000000000010', 'b2000000-0000-4000-8000-000000000003', 'barber'),
  ('b2000000-0000-4000-8000-000000000011', 'b2000000-0000-4000-8000-000000000004', 'owner');

insert into public.barbers (id, shop_id, user_id, display_name) values
  ('b2000000-0000-4000-8000-000000000020', 'b2000000-0000-4000-8000-000000000010', 'b2000000-0000-4000-8000-000000000003', 'A1'),
  ('b2000000-0000-4000-8000-000000000021', 'b2000000-0000-4000-8000-000000000010', null, 'A2'),
  ('b2000000-0000-4000-8000-000000000022', 'b2000000-0000-4000-8000-000000000011', null, 'B1');

insert into public.services (id, shop_id, name, duration_minutes, price_paise) values
  ('b2000000-0000-4000-8000-000000000030', 'b2000000-0000-4000-8000-000000000010', 'Cut A', 30, 20000),
  ('b2000000-0000-4000-8000-000000000031', 'b2000000-0000-4000-8000-000000000011', 'Cut B', 30, 30000);

insert into public.bookings (id, customer_id, shop_id, barber_id, service_id, starts_at, ends_at, price_paise, duration_minutes) values
  ('b2000000-0000-4000-8000-000000000040', 'b2000000-0000-4000-8000-000000000005', 'b2000000-0000-4000-8000-000000000010',
   'b2000000-0000-4000-8000-000000000020', 'b2000000-0000-4000-8000-000000000030', tests.local_ts(1, '10:00'), tests.local_ts(1, '10:30'), 20000, 30),
  ('b2000000-0000-4000-8000-000000000041', 'b2000000-0000-4000-8000-000000000006', 'b2000000-0000-4000-8000-000000000010',
   'b2000000-0000-4000-8000-000000000021', 'b2000000-0000-4000-8000-000000000030', tests.local_ts(1, '10:00'), tests.local_ts(1, '10:30'), 20000, 30),
  ('b2000000-0000-4000-8000-000000000042', 'b2000000-0000-4000-8000-000000000007', 'b2000000-0000-4000-8000-000000000011',
   'b2000000-0000-4000-8000-000000000022', 'b2000000-0000-4000-8000-000000000031', tests.local_ts(1, '10:00'), tests.local_ts(1, '10:30'), 30000, 30);

insert into public.time_off (id, barber_id, shop_id, starts_at, ends_at) values
  ('b2000000-0000-4000-8000-000000000060', 'b2000000-0000-4000-8000-000000000020', 'b2000000-0000-4000-8000-000000000010', tests.local_ts(3, '00:00'), tests.local_ts(4, '00:00')),
  ('b2000000-0000-4000-8000-000000000061', 'b2000000-0000-4000-8000-000000000021', 'b2000000-0000-4000-8000-000000000010', tests.local_ts(3, '00:00'), tests.local_ts(4, '00:00')),
  ('b2000000-0000-4000-8000-000000000062', 'b2000000-0000-4000-8000-000000000022', 'b2000000-0000-4000-8000-000000000011', tests.local_ts(3, '00:00'), tests.local_ts(4, '00:00'));

insert into public.payments (id, booking_id, amount_paise) values
  ('b2000000-0000-4000-8000-000000000050', 'b2000000-0000-4000-8000-000000000040', 20000),
  ('b2000000-0000-4000-8000-000000000051', 'b2000000-0000-4000-8000-000000000042', 30000);

-- Owner of shop A --------------------------------------------------------------------------------
select tests.login_as('b2000000-0000-4000-8000-000000000001');

select results_eq(
  $$ select id from public.bookings
     where shop_id in ('b2000000-0000-4000-8000-000000000010', 'b2000000-0000-4000-8000-000000000011') order by id $$,
  $$ values ('b2000000-0000-4000-8000-000000000040'::uuid), ('b2000000-0000-4000-8000-000000000041'::uuid) $$,
  'owner A sees all of shop A''s bookings and none of shop B''s'
);

select is_empty(
  $$ select 1 from public.time_off where shop_id = 'b2000000-0000-4000-8000-000000000011' $$,
  'owner A cannot see shop B''s time off'
);

select is_empty(
  $$ select 1 from public.shop_members where shop_id = 'b2000000-0000-4000-8000-000000000011' $$,
  'owner A cannot see shop B''s members'
);

select results_eq(
  $$ select id from public.payments
     where id in ('b2000000-0000-4000-8000-000000000050', 'b2000000-0000-4000-8000-000000000051') $$,
  $$ values ('b2000000-0000-4000-8000-000000000050'::uuid) $$,
  'owner A sees shop A''s payments only'
);

select results_eq(
  $$ select id from public.profiles
     where id in ('b2000000-0000-4000-8000-000000000005', 'b2000000-0000-4000-8000-000000000007') $$,
  $$ values ('b2000000-0000-4000-8000-000000000005'::uuid) $$,
  'owner A can read profiles of their own customers only'
);

select throws_ok(
  $$ insert into public.services (shop_id, name, duration_minutes, price_paise)
     values ('b2000000-0000-4000-8000-000000000011', 'Sneaky', 30, 100) $$,
  '42501', null,
  'owner A cannot add a service to shop B'
);

select throws_ok(
  $$ insert into public.time_off (barber_id, shop_id, starts_at, ends_at)
     values ('b2000000-0000-4000-8000-000000000022', 'b2000000-0000-4000-8000-000000000011', tests.local_ts(5, '10:00'), tests.local_ts(5, '11:00')) $$,
  '42501', null,
  'owner A cannot add time off for shop B''s barber'
);

select throws_ok(
  $$ insert into public.shop_members (shop_id, user_id, role)
     values ('b2000000-0000-4000-8000-000000000011', 'b2000000-0000-4000-8000-000000000001', 'owner') $$,
  '42501', null,
  'owner A cannot make themselves a member of shop B'
);

select lives_ok(
  $$ update public.services set price_paise = 1 where id = 'b2000000-0000-4000-8000-000000000031' $$,
  'updating shop B''s service runs but matches no rows (checked below)'
);

select lives_ok(
  $$ update public.shops set name = 'Hijacked' where id = 'b2000000-0000-4000-8000-000000000011' $$,
  'updating shop B runs but matches no rows (checked below)'
);

select throws_ok(
  $$ update public.bookings set status = 'cancelled' where id = 'b2000000-0000-4000-8000-000000000041' $$,
  '42501', null,
  'bookings cannot be updated directly, even in your own shop'
);

select throws_ok(
  $$ select public.cancel_booking('b2000000-0000-4000-8000-000000000042') $$,
  'P0001', 'NOT_AUTHORIZED',
  'owner A cannot cancel shop B''s booking'
);

select throws_ok(
  $$ select public.update_booking_status('b2000000-0000-4000-8000-000000000042', 'completed') $$,
  'P0001', 'NOT_AUTHORIZED',
  'owner A cannot change the status of shop B''s booking'
);

select lives_ok(
  $$ insert into public.services (shop_id, name, duration_minutes, price_paise)
     values ('b2000000-0000-4000-8000-000000000010', 'Beard A', 15, 10000) $$,
  'owner A can add a service to their own shop'
);

-- Manager of shop A ------------------------------------------------------------------------------
select tests.login_as('b2000000-0000-4000-8000-000000000002');

select results_eq(
  $$ select id from public.bookings
     where shop_id in ('b2000000-0000-4000-8000-000000000010', 'b2000000-0000-4000-8000-000000000011') order by id $$,
  $$ values ('b2000000-0000-4000-8000-000000000040'::uuid), ('b2000000-0000-4000-8000-000000000041'::uuid) $$,
  'manager A sees all of shop A''s bookings and none of shop B''s'
);

select throws_ok(
  $$ insert into public.shop_members (shop_id, user_id, role)
     values ('b2000000-0000-4000-8000-000000000010', 'b2000000-0000-4000-8000-000000000006', 'manager') $$,
  '42501', null,
  'only owners can add members'
);

-- Barber of shop A (linked to barber A1) ------------------------------------------------------------
select tests.login_as('b2000000-0000-4000-8000-000000000003');

select results_eq(
  $$ select id from public.bookings
     where shop_id in ('b2000000-0000-4000-8000-000000000010', 'b2000000-0000-4000-8000-000000000011') $$,
  $$ values ('b2000000-0000-4000-8000-000000000040'::uuid) $$,
  'barber sees only their own bookings'
);

select results_eq(
  $$ select id from public.time_off
     where shop_id in ('b2000000-0000-4000-8000-000000000010', 'b2000000-0000-4000-8000-000000000011') $$,
  $$ values ('b2000000-0000-4000-8000-000000000060'::uuid) $$,
  'barber sees only their own time off'
);

select lives_ok(
  $$ insert into public.time_off (barber_id, shop_id, starts_at, ends_at)
     values ('b2000000-0000-4000-8000-000000000020', 'b2000000-0000-4000-8000-000000000010', tests.local_ts(6, '10:00'), tests.local_ts(6, '12:00')) $$,
  'barber can add their own time off'
);

select throws_ok(
  $$ insert into public.time_off (barber_id, shop_id, starts_at, ends_at)
     values ('b2000000-0000-4000-8000-000000000021', 'b2000000-0000-4000-8000-000000000010', tests.local_ts(6, '10:00'), tests.local_ts(6, '12:00')) $$,
  '42501', null,
  'barber cannot add time off for a colleague'
);

select throws_ok(
  $$ insert into public.services (shop_id, name, duration_minutes, price_paise)
     values ('b2000000-0000-4000-8000-000000000010', 'Barber service', 30, 100) $$,
  '42501', null,
  'barber cannot add services'
);

select is_empty(
  $$ select 1 from public.payments $$,
  'barber cannot see payments'
);

-- Customer C1 --------------------------------------------------------------------------------------
select tests.login_as('b2000000-0000-4000-8000-000000000005');

select results_eq(
  $$ select id from public.bookings $$,
  $$ values ('b2000000-0000-4000-8000-000000000040'::uuid) $$,
  'customer sees only their own booking'
);

select results_eq(
  $$ select id from public.payments $$,
  $$ values ('b2000000-0000-4000-8000-000000000050'::uuid) $$,
  'customer sees only payments for their own booking'
);

select is_empty(
  $$ select 1 from public.time_off where shop_id = 'b2000000-0000-4000-8000-000000000010' $$,
  'customer cannot see time off'
);

select is_empty(
  $$ select 1 from public.shop_members
     where shop_id in ('b2000000-0000-4000-8000-000000000010', 'b2000000-0000-4000-8000-000000000011') $$,
  'customer cannot see shop members'
);

select throws_ok(
  $$ select public.cancel_booking('b2000000-0000-4000-8000-000000000041') $$,
  'P0001', 'NOT_AUTHORIZED',
  'customer cannot cancel someone else''s booking'
);

-- Anonymous ----------------------------------------------------------------------------------------
select tests.login_anon();

select throws_ok(
  $$ select 1 from public.bookings $$,
  '42501', null,
  'anon cannot read bookings'
);

select throws_ok(
  $$ select 1 from public.time_off $$,
  '42501', null,
  'anon cannot read time off'
);

select results_eq(
  $$ select id from public.shops
     where id in ('b2000000-0000-4000-8000-000000000010', 'b2000000-0000-4000-8000-000000000011') order by id $$,
  $$ values ('b2000000-0000-4000-8000-000000000010'::uuid), ('b2000000-0000-4000-8000-000000000011'::uuid) $$,
  'anon can browse active shops'
);

-- Nothing leaked through the no-op updates ------------------------------------------------------------
reset role;

select is(
  (select price_paise from public.services where id = 'b2000000-0000-4000-8000-000000000031'),
  30000,
  'shop B''s service price is unchanged'
);

select is(
  (select name from public.shops where id = 'b2000000-0000-4000-8000-000000000011'),
  'Shop B',
  'shop B''s name is unchanged'
);

select * from finish();
rollback;
