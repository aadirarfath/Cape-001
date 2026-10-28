-- Seat reservation: hold_seat, hold_seats, concurrency guard, expiry, RLS.
begin;
create extension if not exists pgtap with schema extensions;

select plan(22);

-- Helpers ------------------------------------------------------------------
create schema tests;
grant usage on schema tests to anon, authenticated;

create function tests.login_as(p_user_id uuid) returns void
language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
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

-- Fixtures -----------------------------------------------------------------
insert into auth.users (id, email) values
  ('b0000000-0000-4000-8000-000000000001', 'owner@seat.test'),
  ('b0000000-0000-4000-8000-000000000002', 'c1@seat.test'),
  ('b0000000-0000-4000-8000-000000000003', 'c2@seat.test'),
  ('b0000000-0000-4000-8000-000000000004', 'c3@seat.test');

insert into public.shops (id, name, slug, address_line, location, is_active) values
  ('b0000000-0000-4000-8000-000000000010', 'Seat Shop', 'seat-shop', 'Test Road',
   extensions.st_setsrid(extensions.st_makepoint(75.78, 11.25), 4326)::extensions.geography, true);

insert into public.shop_members (shop_id, user_id, role) values
  ('b0000000-0000-4000-8000-000000000010', 'b0000000-0000-4000-8000-000000000001', 'owner');

insert into public.shows (id, shop_id, title, starts_at, ends_at, is_active) values
  ('b0000000-0000-4000-8000-000000000020',
   'b0000000-0000-4000-8000-000000000010',
   'Evening Concert',
   now() + interval '7 days',
   now() + interval '7 days 2 hours',
   true),
  ('b0000000-0000-4000-8000-000000000021',
   'b0000000-0000-4000-8000-000000000010',
   'Inactive Show',
   now() + interval '14 days',
   now() + interval '14 days 2 hours',
   false);

insert into public.seats (id, show_id, label, price_paise, is_active) values
  ('b0000000-0000-4000-8000-000000000030', 'b0000000-0000-4000-8000-000000000020', 'A1', 50000, true),
  ('b0000000-0000-4000-8000-000000000031', 'b0000000-0000-4000-8000-000000000020', 'A2', 50000, true),
  ('b0000000-0000-4000-8000-000000000032', 'b0000000-0000-4000-8000-000000000020', 'A3', 75000, true),
  ('b0000000-0000-4000-8000-000000000033', 'b0000000-0000-4000-8000-000000000020', 'B1', 30000, false);

-- RLS: public read of active seats -------------------------------------------
select tests.login_anon();

select is(
  (select count(*)::int from public.seats
   where show_id = 'b0000000-0000-4000-8000-000000000020'),
  3,
  'anon can read active seats (inactive B1 hidden)'
);

select is(
  (select count(*)::int from public.shows
   where shop_id = 'b0000000-0000-4000-8000-000000000010'),
  1,
  'anon sees only active shows'
);

-- hold_seat: happy path -------------------------------------------------------
select tests.login_as('b0000000-0000-4000-8000-000000000002');

select lives_ok(
  $$ select public.hold_seat('b0000000-0000-4000-8000-000000000020',
                              'b0000000-0000-4000-8000-000000000030') $$,
  'customer 1 holds seat A1'
);

select results_eq(
  $$ select status::text, seat_id from public.bookings
     where customer_id = 'b0000000-0000-4000-8000-000000000002'
       and seat_id = 'b0000000-0000-4000-8000-000000000030' $$,
  $$ values ('held', 'b0000000-0000-4000-8000-000000000030'::uuid) $$,
  'booking is in held status with the correct seat_id'
);

select isnt(
  (select hold_expires_at from public.bookings
   where customer_id = 'b0000000-0000-4000-8000-000000000002'
     and seat_id = 'b0000000-0000-4000-8000-000000000030'),
  null,
  'hold_expires_at is set'
);

-- hold_seat: seat already taken ----------------------------------------------
select tests.login_as('b0000000-0000-4000-8000-000000000003');

select throws_ok(
  $$ select public.hold_seat('b0000000-0000-4000-8000-000000000020',
                              'b0000000-0000-4000-8000-000000000030') $$,
  'P0001', 'SEAT_TAKEN',
  'second hold on same seat throws SEAT_TAKEN'
);

-- Different seat is still available ------------------------------------------
select lives_ok(
  $$ select public.hold_seat('b0000000-0000-4000-8000-000000000020',
                              'b0000000-0000-4000-8000-000000000031') $$,
  'customer 2 can hold a different seat (A2)'
);

-- hold_seat: inactive seat is rejected ----------------------------------------
select throws_ok(
  $$ select public.hold_seat('b0000000-0000-4000-8000-000000000020',
                              'b0000000-0000-4000-8000-000000000033') $$,
  'P0001', 'SEAT_NOT_FOUND',
  'cannot hold an inactive seat'
);

-- hold_seat: inactive show is rejected ----------------------------------------
select throws_ok(
  $$ select public.hold_seat('b0000000-0000-4000-8000-000000000021',
                              'b0000000-0000-4000-8000-000000000031') $$,
  'P0001', 'SHOW_NOT_FOUND',
  'cannot hold a seat in an inactive show'
);

-- hold_seat: anon is rejected -------------------------------------------------
select tests.login_anon();

select throws_ok(
  $$ select public.hold_seat('b0000000-0000-4000-8000-000000000020',
                              'b0000000-0000-4000-8000-000000000032') $$,
  '42501', null,
  'anonymous users cannot call hold_seat'
);

-- hold_seats (multi-seat) -----------------------------------------------------
select tests.login_as('b0000000-0000-4000-8000-000000000004');

select lives_ok(
  $$ select public.hold_seats('b0000000-0000-4000-8000-000000000020',
                               array['b0000000-0000-4000-8000-000000000032']::uuid[]) $$,
  'customer 3 holds seat A3 via hold_seats'
);

-- hold_seats: one already taken -> full rollback ------------------------------
-- A1 is held by customer 1, A3 is held by customer 3.
-- Trying to hold [A3, A2] should fail because A3 is taken.
select throws_ok(
  $$ select public.hold_seats('b0000000-0000-4000-8000-000000000020',
                               array['b0000000-0000-4000-8000-000000000032',
                                     'b0000000-0000-4000-8000-000000000031']::uuid[]) $$,
  'P0001', 'SEAT_TAKEN',
  'hold_seats rolls back entirely when one seat is already taken'
);

select is(
  (select count(*)::int from public.bookings
   where customer_id = 'b0000000-0000-4000-8000-000000000004'),
  1,
  'only one booking exists for customer 3 (the rollback left no partial rows)'
);

-- Expiry: booking status changes to expired when hold_expires_at has passed ---
reset role;

-- Manually set an expired hold.
update public.bookings
set hold_expires_at = now() - interval '1 second'
where customer_id = 'b0000000-0000-4000-8000-000000000002'
  and seat_id = 'b0000000-0000-4000-8000-000000000030';

-- Run the expiry query that the pg_cron job runs.
update public.bookings
set status = 'expired'
where status = 'held'
  and hold_expires_at < now();

select results_eq(
  $$ select status::text from public.bookings
     where customer_id = 'b0000000-0000-4000-8000-000000000002'
       and seat_id = 'b0000000-0000-4000-8000-000000000030' $$,
  $$ values ('expired') $$,
  'expired hold is set to expired status'
);

-- After expiry, a new customer can hold the seat ------------------------------
select tests.login_as('b0000000-0000-4000-8000-000000000003');

select lives_ok(
  $$ select public.hold_seat('b0000000-0000-4000-8000-000000000020',
                              'b0000000-0000-4000-8000-000000000030') $$,
  'seat A1 is available again after its hold expired'
);

-- RLS: authenticated cannot insert directly into bookings (seat row) ----------
select tests.login_as('b0000000-0000-4000-8000-000000000002');

select throws_ok(
  $$ insert into public.bookings (customer_id, shop_id, seat_id, price_paise, duration_minutes,
                                   starts_at, ends_at, status)
     values ('b0000000-0000-4000-8000-000000000002',
             'b0000000-0000-4000-8000-000000000010',
             'b0000000-0000-4000-8000-000000000031',
             50000, 120,
             now() + interval '7 days',
             now() + interval '7 days 2 hours',
             'held') $$,
  '42501', null,
  'authenticated users cannot insert seat bookings directly'
);

-- Price comes from DB, not from hold_seat input --------------------------------
-- Verify the booking price snapshot matches the seat price, not any client value.
select results_eq(
  $$ select b.price_paise from public.bookings b
     where b.seat_id = 'b0000000-0000-4000-8000-000000000032'
       and b.customer_id = 'b0000000-0000-4000-8000-000000000004'
       and b.status = 'held' $$,
  $$ select price_paise from public.seats where id = 'b0000000-0000-4000-8000-000000000032' $$,
  'price snapshot equals seat price_paise from DB (price tampering impossible)'
);

select * from finish();
rollback;
