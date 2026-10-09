-- Realtime publication for bookings, the notify-booking trigger (pg_net + Vault) and
-- booking_notification_tokens (who gets a push).
begin;
create extension if not exists pgtap with schema extensions;

select plan(20);

-- Helpers ------------------------------------------------------------------------------------
create schema tests;
grant usage on schema tests to anon, authenticated, service_role;

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

create function tests.login_service_role() returns void
language plpgsql as $$
begin
  perform set_config('role', 'service_role', true);
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end;
$$;

-- Requests queued for pg_net by this transaction (visible to the test only until rollback).
create function tests.queued_notifications() returns table (url text, secret text, event text, booking_id uuid)
language sql stable security definer as $$
  select
    q.url,
    q.headers ->> 'X-Webhook-Secret',
    convert_from(q.body, 'utf8')::jsonb ->> 'event',
    (convert_from(q.body, 'utf8')::jsonb ->> 'booking_id')::uuid
  from net.http_request_queue q
  where q.url = 'http://notify.test/notify-booking'
  order by q.id
$$;

grant execute on all functions in schema tests to anon, authenticated, service_role;

-- Use test Vault values for the notification endpoint.
delete from vault.secrets where name in ('notify_booking_url', 'notify_booking_secret');
select vault.create_secret('http://notify.test/notify-booking', 'notify_booking_url');
select vault.create_secret('test-secret', 'notify_booking_secret');

-- Fixtures -------------------------------------------------------------------------------------
-- e12..01 owner A, 02 manager A, 03 barber A (linked to A1), 04 customer, 05 owner B,
-- 06 barber member of A who is not the booked barber.
insert into auth.users (id, email) values
  ('e1200000-0000-4000-8000-000000000001', 'owner.a@notify.test'),
  ('e1200000-0000-4000-8000-000000000002', 'manager.a@notify.test'),
  ('e1200000-0000-4000-8000-000000000003', 'barber.a@notify.test'),
  ('e1200000-0000-4000-8000-000000000004', 'customer@notify.test'),
  ('e1200000-0000-4000-8000-000000000005', 'owner.b@notify.test'),
  ('e1200000-0000-4000-8000-000000000006', 'barber.a2@notify.test');

insert into public.shops (id, name, slug, address_line, location, is_active) values
  ('e1200000-0000-4000-8000-00000000000a', 'Notify Shop A', 'notify-shop-a', 'Road',
   extensions.st_setsrid(extensions.st_makepoint(76.30, 10.02), 4326)::extensions.geography, true),
  ('e1200000-0000-4000-8000-00000000000b', 'Notify Shop B', 'notify-shop-b', 'Road',
   extensions.st_setsrid(extensions.st_makepoint(76.31, 10.03), 4326)::extensions.geography, true);

insert into public.shop_members (shop_id, user_id, role) values
  ('e1200000-0000-4000-8000-00000000000a', 'e1200000-0000-4000-8000-000000000001', 'owner'),
  ('e1200000-0000-4000-8000-00000000000a', 'e1200000-0000-4000-8000-000000000002', 'manager'),
  ('e1200000-0000-4000-8000-00000000000a', 'e1200000-0000-4000-8000-000000000003', 'barber'),
  ('e1200000-0000-4000-8000-00000000000a', 'e1200000-0000-4000-8000-000000000006', 'barber'),
  ('e1200000-0000-4000-8000-00000000000b', 'e1200000-0000-4000-8000-000000000005', 'owner');

insert into public.barbers (id, shop_id, user_id, display_name) values
  ('e1200000-0000-4000-8000-0000000000a1', 'e1200000-0000-4000-8000-00000000000a', 'e1200000-0000-4000-8000-000000000003', 'Arun'),
  ('e1200000-0000-4000-8000-0000000000a2', 'e1200000-0000-4000-8000-00000000000a', 'e1200000-0000-4000-8000-000000000006', 'Bijoy');

insert into public.services (id, shop_id, name, duration_minutes, price_paise) values
  ('e1200000-0000-4000-8000-0000000000c1', 'e1200000-0000-4000-8000-00000000000a', 'Haircut', 30, 20000);

insert into public.barber_services (barber_id, service_id, shop_id) values
  ('e1200000-0000-4000-8000-0000000000a1', 'e1200000-0000-4000-8000-0000000000c1', 'e1200000-0000-4000-8000-00000000000a');

insert into public.working_hours (barber_id, shop_id, weekday, start_time, end_time)
select 'e1200000-0000-4000-8000-0000000000a1', 'e1200000-0000-4000-8000-00000000000a', d, '00:00', '23:45'
from generate_series(0, 6) as d;

insert into public.push_tokens (user_id, token, platform) values
  ('e1200000-0000-4000-8000-000000000001', 'ExponentPushToken[owner-phone]', 'android'),
  ('e1200000-0000-4000-8000-000000000001', 'ExponentPushToken[owner-tablet]', 'android'),
  ('e1200000-0000-4000-8000-000000000002', 'ExponentPushToken[manager]', 'android'),
  ('e1200000-0000-4000-8000-000000000003', 'ExponentPushToken[barber-a1]', 'android'),
  ('e1200000-0000-4000-8000-000000000004', 'ExponentPushToken[customer]', 'android'),
  ('e1200000-0000-4000-8000-000000000005', 'ExponentPushToken[owner-b]', 'android'),
  ('e1200000-0000-4000-8000-000000000006', 'ExponentPushToken[barber-a2]', 'android');

-- Realtime -------------------------------------------------------------------------------------
select ok(
  exists (select 1 from pg_publication_tables
          where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bookings'),
  'bookings are published to Supabase Realtime'
);

select is(
  (select count(*)::int from pg_publication_tables
   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename <> 'bookings'),
  0,
  'no other table is published'
);

-- New booking ----------------------------------------------------------------------------------
select tests.login_as('e1200000-0000-4000-8000-000000000004');
create temporary table booked on commit drop as
select * from public.book_appointment(
  'e1200000-0000-4000-8000-0000000000a1', 'e1200000-0000-4000-8000-0000000000c1', tests.local_ts(1, '10:00')
);
grant select on booked to public;

reset role;
select results_eq(
  $$ select url, secret, event, booking_id from tests.queued_notifications() $$,
  $$ select 'http://notify.test/notify-booking', 'test-secret', 'created', id from booked $$,
  'a new booking queues one notify-booking request with the secret, event and id'
);

select is(
  (select convert_from(q.body, 'utf8')::jsonb - 'event' - 'booking_id'
   from net.http_request_queue q where q.url = 'http://notify.test/notify-booking'),
  '{}'::jsonb,
  'the request carries no customer details'
);

select tests.login_service_role();
select results_eq(
  $$ select token from public.booking_notification_tokens((select id from booked)) order by token $$,
  $$ values ('ExponentPushToken[barber-a1]'), ('ExponentPushToken[manager]'),
            ('ExponentPushToken[owner-phone]'), ('ExponentPushToken[owner-tablet]') $$,
  'owners, managers and the booked barber are notified on every device'
);

select is_empty(
  $$ select 1 from public.booking_notification_tokens((select id from booked))
     where token in ('ExponentPushToken[customer]', 'ExponentPushToken[owner-b]', 'ExponentPushToken[barber-a2]') $$,
  'the customer, other shops and other barbers are not notified'
);

select tests.login_as('e1200000-0000-4000-8000-000000000001');
select throws_ok(
  $$ select * from public.booking_notification_tokens((select id from booked)) $$,
  '42501', null,
  'clients cannot list notification tokens'
);

-- Changes that do not notify -------------------------------------------------------------------
reset role;
update public.bookings set customer_notes = 'Short on the sides' where id = (select id from booked);
select is(
  (select count(*)::int from tests.queued_notifications()),
  1,
  'editing a booking without cancelling it queues nothing'
);

-- Cancellation ---------------------------------------------------------------------------------
select tests.login_as('e1200000-0000-4000-8000-000000000001');
select lives_ok(
  $$ select public.cancel_booking((select id from booked), 'Shop closed early') $$,
  'the owner cancels the booking'
);

reset role;
select results_eq(
  $$ select event, booking_id from tests.queued_notifications() offset 1 $$,
  $$ select 'cancelled', id from booked $$,
  'a cancellation queues a cancelled notification'
);

select tests.login_service_role();
select results_eq(
  $$ select token from public.booking_notification_tokens((select id from booked)) order by token $$,
  $$ values ('ExponentPushToken[barber-a1]'), ('ExponentPushToken[manager]') $$,
  'whoever cancelled (the owner) is not notified about their own cancellation'
);

reset role;
update public.bookings set status = 'cancelled' where id = (select id from booked);
select is(
  (select count(*)::int from tests.queued_notifications()),
  2,
  'an update that leaves an already-cancelled booking cancelled queues nothing'
);

-- A customer cancellation notifies the owner too.
select tests.login_as('e1200000-0000-4000-8000-000000000004');
create temporary table booked2 on commit drop as
select * from public.book_appointment(
  'e1200000-0000-4000-8000-0000000000a1', 'e1200000-0000-4000-8000-0000000000c1', tests.local_ts(2, '10:00')
);
grant select on booked2 to public;
select lives_ok(
  $$ select public.cancel_booking((select id from booked2)) $$,
  'the customer cancels their own booking'
);

select tests.login_service_role();
select results_eq(
  $$ select token from public.booking_notification_tokens((select id from booked2)) order by token $$,
  $$ values ('ExponentPushToken[barber-a1]'), ('ExponentPushToken[manager]'),
            ('ExponentPushToken[owner-phone]'), ('ExponentPushToken[owner-tablet]') $$,
  'a customer cancellation notifies all staff'
);

reset role;
select is(
  (select count(*)::int from tests.queued_notifications()),
  4,
  'the second booking queued created and cancelled requests'
);

-- A completed booking does not notify.
update public.bookings set status = 'completed' where id = (select id from booked2);
select is(
  (select count(*)::int from tests.queued_notifications()),
  4,
  'marking a booking completed or no-show queues nothing'
);

-- A barber who left the shop is no longer notified.
delete from public.shop_members
where shop_id = 'e1200000-0000-4000-8000-00000000000a' and user_id = 'e1200000-0000-4000-8000-000000000003';
select tests.login_service_role();
select is_empty(
  $$ select 1 from public.booking_notification_tokens((select id from booked2))
     where token = 'ExponentPushToken[barber-a1]' $$,
  'a barber who is no longer a member is not notified'
);

-- Not configured -------------------------------------------------------------------------------
reset role;
delete from vault.secrets where name = 'notify_booking_secret';
select tests.login_as('e1200000-0000-4000-8000-000000000004');
select lives_ok(
  $$ select public.book_appointment(
       'e1200000-0000-4000-8000-0000000000a1', 'e1200000-0000-4000-8000-0000000000c1', tests.local_ts(3, '10:00')) $$,
  'bookings still work when notifications are not configured'
);

reset role;
select is(
  (select count(*)::int from tests.queued_notifications()),
  4,
  'without the Vault secret nothing is queued'
);

select ok(
  not exists (select 1 from net.http_request_queue q where q.url = 'http://notify.test/notify-booking'
              and q.headers ->> 'X-Webhook-Secret' is null),
  'no request is ever sent without the secret'
);

select * from finish();
rollback;
