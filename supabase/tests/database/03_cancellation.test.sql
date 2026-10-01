-- cancel_booking (per-shop cutoff for customers, anytime for owners/managers) and
-- update_booking_status.
begin;
create extension if not exists pgtap with schema extensions;

select plan(20);

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
-- Owner O (...01) owns both shops; manager M (...02) and barber user BU (...03) work at shop 1.
-- Shop 1 (...10) has the default 30-minute cutoff, shop 2 (...11) a 120-minute cutoff.
insert into auth.users (id, email) values
  ('c3000000-0000-4000-8000-000000000001', 'o@cancel.test'),
  ('c3000000-0000-4000-8000-000000000002', 'm@cancel.test'),
  ('c3000000-0000-4000-8000-000000000003', 'bu@cancel.test'),
  ('c3000000-0000-4000-8000-000000000004', 'c1@cancel.test'),
  ('c3000000-0000-4000-8000-000000000005', 'c2@cancel.test');

insert into public.shops (id, name, slug, address_line, location, is_active, cancellation_cutoff_minutes) values
  ('c3000000-0000-4000-8000-000000000010', 'Cutoff 30', 'cancel-shop-1', 'Road 1',
   extensions.st_setsrid(extensions.st_makepoint(75.78, 11.25), 4326)::extensions.geography, true, 30),
  ('c3000000-0000-4000-8000-000000000011', 'Cutoff 120', 'cancel-shop-2', 'Road 2',
   extensions.st_setsrid(extensions.st_makepoint(75.79, 11.26), 4326)::extensions.geography, true, 120);

insert into public.shop_members (shop_id, user_id, role) values
  ('c3000000-0000-4000-8000-000000000010', 'c3000000-0000-4000-8000-000000000001', 'owner'),
  ('c3000000-0000-4000-8000-000000000011', 'c3000000-0000-4000-8000-000000000001', 'owner'),
  ('c3000000-0000-4000-8000-000000000010', 'c3000000-0000-4000-8000-000000000002', 'manager'),
  ('c3000000-0000-4000-8000-000000000010', 'c3000000-0000-4000-8000-000000000003', 'barber');

insert into public.barbers (id, shop_id, user_id, display_name) values
  ('c3000000-0000-4000-8000-000000000020', 'c3000000-0000-4000-8000-000000000010', 'c3000000-0000-4000-8000-000000000003', 'X'),
  ('c3000000-0000-4000-8000-000000000021', 'c3000000-0000-4000-8000-000000000011', null, 'Y');

insert into public.services (id, shop_id, name, duration_minutes, price_paise) values
  ('c3000000-0000-4000-8000-000000000030', 'c3000000-0000-4000-8000-000000000010', 'Cut', 10, 10000),
  ('c3000000-0000-4000-8000-000000000031', 'c3000000-0000-4000-8000-000000000011', 'Cut', 10, 10000);

-- Bookings relative to now (fixtures bypass book_appointment). All belong to C1 except K_c2.
insert into public.bookings (id, customer_id, shop_id, barber_id, service_id, starts_at, ends_at, price_paise, duration_minutes)
select v.id::uuid, v.customer::uuid, v.shop::uuid, v.barber::uuid, v.service::uuid,
       now() + v.starts_in, now() + v.starts_in + interval '10 minutes', 10000, 10
from (values
  -- K_soon: starts in 10 min (inside shop 1's 30-min cutoff)
  ('c3000000-0000-4000-8000-000000000040', 'c3000000-0000-4000-8000-000000000004', 'c3000000-0000-4000-8000-000000000010', 'c3000000-0000-4000-8000-000000000020', 'c3000000-0000-4000-8000-000000000030', interval '10 minutes'),
  -- K_soon2: starts in 20 min
  ('c3000000-0000-4000-8000-000000000041', 'c3000000-0000-4000-8000-000000000004', 'c3000000-0000-4000-8000-000000000010', 'c3000000-0000-4000-8000-000000000020', 'c3000000-0000-4000-8000-000000000030', interval '20 minutes'),
  -- K_mid: starts in 90 min at shop 1 (outside the 30-min cutoff)
  ('c3000000-0000-4000-8000-000000000042', 'c3000000-0000-4000-8000-000000000004', 'c3000000-0000-4000-8000-000000000010', 'c3000000-0000-4000-8000-000000000020', 'c3000000-0000-4000-8000-000000000030', interval '90 minutes'),
  -- K_s2: starts in 90 min at shop 2 (inside its 120-min cutoff)
  ('c3000000-0000-4000-8000-000000000043', 'c3000000-0000-4000-8000-000000000004', 'c3000000-0000-4000-8000-000000000011', 'c3000000-0000-4000-8000-000000000021', 'c3000000-0000-4000-8000-000000000031', interval '90 minutes'),
  -- K_later: starts in 3 hours
  ('c3000000-0000-4000-8000-000000000044', 'c3000000-0000-4000-8000-000000000004', 'c3000000-0000-4000-8000-000000000010', 'c3000000-0000-4000-8000-000000000020', 'c3000000-0000-4000-8000-000000000030', interval '3 hours'),
  -- K_past: started 2 hours ago
  ('c3000000-0000-4000-8000-000000000045', 'c3000000-0000-4000-8000-000000000004', 'c3000000-0000-4000-8000-000000000010', 'c3000000-0000-4000-8000-000000000020', 'c3000000-0000-4000-8000-000000000030', interval '-2 hours'),
  -- K_c2: customer 2, starts in 4 hours
  ('c3000000-0000-4000-8000-000000000046', 'c3000000-0000-4000-8000-000000000005', 'c3000000-0000-4000-8000-000000000010', 'c3000000-0000-4000-8000-000000000020', 'c3000000-0000-4000-8000-000000000030', interval '4 hours')
) as v (id, customer, shop, barber, service, starts_in);

-- Customer -------------------------------------------------------------------------------------
select tests.login_as('c3000000-0000-4000-8000-000000000004');

select throws_ok(
  $$ select public.cancel_booking('c3000000-0000-4000-8000-000000000040') $$,
  'P0001', 'CANCELLATION_WINDOW_PASSED',
  'customer cannot cancel 10 minutes before start (cutoff 30)'
);

select throws_ok(
  $$ select public.cancel_booking('c3000000-0000-4000-8000-000000000043') $$,
  'P0001', 'CANCELLATION_WINDOW_PASSED',
  'the cutoff is per shop: 90 minutes ahead is too late when the cutoff is 120'
);

select lives_ok(
  $$ select public.cancel_booking('c3000000-0000-4000-8000-000000000042') $$,
  '90 minutes ahead is fine when the cutoff is 30'
);

select lives_ok(
  $$ select public.cancel_booking('c3000000-0000-4000-8000-000000000044', 'Change of plans') $$,
  'customer cancels a booking 3 hours ahead, with a reason'
);

select throws_ok(
  $$ select public.cancel_booking('c3000000-0000-4000-8000-000000000044') $$,
  'P0001', 'BOOKING_NOT_CANCELLABLE',
  'an already cancelled booking cannot be cancelled again'
);

select throws_ok(
  $$ select public.cancel_booking('c3000000-0000-4000-8000-000000000045') $$,
  'P0001', 'CANCELLATION_WINDOW_PASSED',
  'customer cannot cancel a booking that already started'
);

select throws_ok(
  $$ select public.cancel_booking('c3000000-0000-4000-8000-000000000046') $$,
  'P0001', 'NOT_AUTHORIZED',
  'customer cannot cancel another customer''s booking'
);

select throws_ok(
  $$ select public.cancel_booking('c3000000-0000-4000-8000-0000000000ff') $$,
  'P0001', 'BOOKING_NOT_FOUND',
  'unknown booking id'
);

-- Barber (not owner/manager) ----------------------------------------------------------------------
select tests.login_as('c3000000-0000-4000-8000-000000000003');

select throws_ok(
  $$ select public.cancel_booking('c3000000-0000-4000-8000-000000000040') $$,
  'P0001', 'NOT_AUTHORIZED',
  'barbers cannot cancel bookings'
);

select lives_ok(
  $$ select public.update_booking_status('c3000000-0000-4000-8000-000000000045', 'completed') $$,
  'barber marks their own started booking completed'
);

select throws_ok(
  $$ select public.update_booking_status('c3000000-0000-4000-8000-000000000046', 'completed') $$,
  'P0001', 'INVALID_STATUS_TRANSITION',
  'a future booking cannot be marked completed'
);

select throws_ok(
  $$ select public.update_booking_status('c3000000-0000-4000-8000-000000000046', 'cancelled') $$,
  'P0001', 'INVALID_STATUS_TRANSITION',
  'update_booking_status cannot cancel; cancel_booking must be used'
);

-- Manager and owner can cancel anytime ------------------------------------------------------------
select tests.login_as('c3000000-0000-4000-8000-000000000002');

select lives_ok(
  $$ select public.cancel_booking('c3000000-0000-4000-8000-000000000041') $$,
  'manager cancels inside the cutoff'
);

select throws_ok(
  $$ select public.cancel_booking('c3000000-0000-4000-8000-000000000043') $$,
  'P0001', 'NOT_AUTHORIZED',
  'manager of shop 1 cannot cancel at shop 2'
);

select tests.login_as('c3000000-0000-4000-8000-000000000001');

select lives_ok(
  $$ select public.cancel_booking('c3000000-0000-4000-8000-000000000040', 'Barber unwell') $$,
  'owner cancels 10 minutes before start'
);

select lives_ok(
  $$ select public.cancel_booking('c3000000-0000-4000-8000-000000000043') $$,
  'owner cancels inside shop 2''s 120-minute cutoff'
);

select tests.login_anon();

select throws_ok(
  $$ select public.cancel_booking('c3000000-0000-4000-8000-000000000046') $$,
  '42501', null,
  'anon cannot call cancel_booking'
);

-- Results ------------------------------------------------------------------------------------------
reset role;

select results_eq(
  $$ select status::text, cancelled_by, cancellation_reason, cancelled_at is not null
     from public.bookings where id = 'c3000000-0000-4000-8000-000000000044' $$,
  $$ values ('cancelled', 'c3000000-0000-4000-8000-000000000004'::uuid, 'Change of plans', true) $$,
  'customer cancellation records who, why and when'
);

select results_eq(
  $$ select status::text, cancelled_by from public.bookings where id = 'c3000000-0000-4000-8000-000000000040' $$,
  $$ values ('cancelled', 'c3000000-0000-4000-8000-000000000001'::uuid) $$,
  'owner cancellation is attributed to the owner'
);

select results_eq(
  $$ select id, status::text from public.bookings where shop_id in ('c3000000-0000-4000-8000-000000000010', 'c3000000-0000-4000-8000-000000000011') order by id $$,
  $$ values
       ('c3000000-0000-4000-8000-000000000040'::uuid, 'cancelled'),
       ('c3000000-0000-4000-8000-000000000041'::uuid, 'cancelled'),
       ('c3000000-0000-4000-8000-000000000042'::uuid, 'cancelled'),
       ('c3000000-0000-4000-8000-000000000043'::uuid, 'cancelled'),
       ('c3000000-0000-4000-8000-000000000044'::uuid, 'cancelled'),
       ('c3000000-0000-4000-8000-000000000045'::uuid, 'completed'),
       ('c3000000-0000-4000-8000-000000000046'::uuid, 'confirmed') $$,
  'final statuses are exactly as expected'
);

select * from finish();
rollback;
