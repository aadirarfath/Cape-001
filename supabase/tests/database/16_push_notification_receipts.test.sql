-- 16_push_notification_receipts.test.sql: Tests RLS and isolation on push tickets & retries.
begin;
create extension if not exists pgtap with schema extensions;

select plan(5);

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
  ('e1600000-0000-4000-8000-000000000001', 'user@receipts.test');

-- Tests ----------------------------------------------------------------------------------------

-- Test 1: Anonymous cannot read push_notification_tickets
select tests.login_anon();
select throws_ok(
  $$ select * from public.push_notification_tickets $$,
  '42501', null,
  'anonymous cannot read push_notification_tickets'
);

-- Test 2: Authenticated user cannot insert into push_notification_tickets
select tests.login_as('e1600000-0000-4000-8000-000000000001');
select throws_ok(
  $$ insert into public.push_notification_tickets (ticket_id, token) values ('t-1', 'ExponentPushToken[abc]') $$,
  '42501', null,
  'authenticated user cannot insert into push_notification_tickets'
);

-- Test 3: Authenticated user cannot read push_notification_tickets
select throws_ok(
  $$ select * from public.push_notification_tickets $$,
  '42501', null,
  'authenticated user cannot read push_notification_tickets'
);

-- Test 4: Authenticated user cannot insert into push_notification_retries
select throws_ok(
  $$ insert into public.push_notification_retries (message) values ('{}'::jsonb) $$,
  '42501', null,
  'authenticated user cannot insert into push_notification_retries'
);

-- Test 5: Authenticated user cannot read push_notification_retries
select throws_ok(
  $$ select * from public.push_notification_retries $$,
  '42501', null,
  'authenticated user cannot read push_notification_retries'
);

select * from finish();
rollback;
