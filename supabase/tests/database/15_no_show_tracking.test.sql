-- 15_no_show_tracking.test.sql: Tests shop no-show tracking and repeat no-show limit.
begin;
create extension if not exists pgtap with schema extensions;

select plan(6);

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
insert into auth.users (id, email) values
  ('e1500000-0000-4000-8000-000000000001', 'owner@noshow.test'),
  ('e1500000-0000-4000-8000-000000000002', 'customerA@noshow.test'),
  ('e1500000-0000-4000-8000-000000000003', 'customerB@noshow.test');

insert into public.shops (id, name, slug, address_line, location, is_active) values
  ('s1500000-0000-4000-8000-000000000010', 'NoShow Shop', 'noshow-shop', 'Test St',
   extensions.st_point(75.78, 11.25)::extensions.geography, true);

insert into public.shop_members (shop_id, user_id, role) values
  ('s1500000-0000-4000-8000-000000000010', 'e1500000-0000-4000-8000-000000000001', 'owner');

insert into public.barbers (id, shop_id, display_name, is_active) values
  ('b1500000-0000-4000-8000-000000000020', 's1500000-0000-4000-8000-000000000010', 'Barber Tim', true);

insert into public.services (id, shop_id, name, duration_minutes, price_paise) values
  ('sv150000-0000-4000-8000-000000000030', 's1500000-0000-4000-8000-000000000010', 'Quick Cut', 30, 20000);

insert into public.barber_services (barber_id, service_id, shop_id) values
  ('b1500000-0000-4000-8000-000000000020', 'sv150000-0000-4000-8000-000000000030', 's1500000-0000-4000-8000-000000000010');

-- Open 7 days a week, 00:00 to 24:00 (full day)
insert into public.working_hours (barber_id, weekday, start_time, end_time)
select 'b1500000-0000-4000-8000-000000000020', d, '08:00'::time, '20:00'::time
from generate_series(0, 6) d;

-- Seed 2 prior no-show bookings for Customer A
insert into public.bookings (
  customer_id, shop_id, barber_id, service_id, starts_at, ends_at,
  status, price_paise, duration_minutes
) values
(
  'e1500000-0000-4000-8000-000000000002', 's1500000-0000-4000-8000-000000000010',
  'b1500000-0000-4000-8000-000000000020', 'sv150000-0000-4000-8000-000000000030',
  now() - interval '10 days', now() - interval '10 days' + interval '30 minutes',
  'no_show', 20000, 30
),
(
  'e1500000-0000-4000-8000-000000000002', 's1500000-0000-4000-8000-000000000010',
  'b1500000-0000-4000-8000-000000000020', 'sv150000-0000-4000-8000-000000000030',
  now() - interval '5 days', now() - interval '5 days' + interval '30 minutes',
  'no_show', 20000, 30
);

-- Tests ----------------------------------------------------------------------------------------

-- Test 1: Customer A sees 2 no-shows for themselves
select tests.login_as('e1500000-0000-4000-8000-000000000002');
select is(
  (select public.get_customer_no_show_count('e1500000-0000-4000-8000-000000000002', 's1500000-0000-4000-8000-000000000010')),
  2,
  'customer can see their own no-show count'
);

-- Test 2: Shop owner sees 2 no-shows for Customer A
select tests.login_as('e1500000-0000-4000-8000-000000000001');
select is(
  (select public.get_customer_no_show_count('e1500000-0000-4000-8000-000000000002', 's1500000-0000-4000-8000-000000000010')),
  2,
  'shop owner can see customer no-show count at their shop'
);

-- Test 3: Other customer cannot see Customer A no-show count
select tests.login_as('e1500000-0000-4000-8000-000000000003');
select throws_ok(
  $$ select public.get_customer_no_show_count('e1500000-0000-4000-8000-000000000002', 's1500000-0000-4000-8000-000000000010') $$,
  'P0001', 'NOT_AUTHORIZED',
  'unrelated customer cannot see another customer no-show count'
);

-- Test 4: Anonymous cannot call get_customer_no_show_count
select tests.login_anon();
select throws_ok(
  $$ select public.get_customer_no_show_count('e1500000-0000-4000-8000-000000000002', 's1500000-0000-4000-8000-000000000010') $$,
  '42501', null,
  'anonymous cannot call get_customer_no_show_count'
);

-- Test 5: Seed 3rd no-show for Customer A, booking is rejected with TOO_MANY_NO_SHOWS
insert into public.bookings (
  customer_id, shop_id, barber_id, service_id, starts_at, ends_at,
  status, price_paise, duration_minutes
) values (
  'e1500000-0000-4000-8000-000000000002', 's1500000-0000-4000-8000-000000000010',
  'b1500000-0000-4000-8000-000000000020', 'sv150000-0000-4000-8000-000000000030',
  now() - interval '2 days', now() - interval '2 days' + interval '30 minutes',
  'no_show', 20000, 30
);

-- Pick a valid future slot tomorrow at 10:00 IST
select tests.login_as('e1500000-0000-4000-8000-000000000002');
select throws_ok(
  $$
    select public.book_appointment(
      'b1500000-0000-4000-8000-000000000020',
      'sv150000-0000-4000-8000-000000000030',
      (current_date + 1 + time '10:00:00') at time zone 'Asia/Kolkata'
    )
  $$,
  'P0001', 'TOO_MANY_NO_SHOWS',
  'customer with 3 recent no-shows at shop is rejected'
);

-- Test 6: Customer B with 0 no-shows can book
select tests.login_as('e1500000-0000-4000-8000-000000000003');
select lives_ok(
  $$
    select public.book_appointment(
      'b1500000-0000-4000-8000-000000000020',
      'sv150000-0000-4000-8000-000000000030',
      (current_date + 1 + time '10:00:00') at time zone 'Asia/Kolkata'
    )
  $$,
  'customer without excessive no-shows can book'
);

select * from finish();
rollback;
