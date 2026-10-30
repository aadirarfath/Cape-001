-- 14_account_deletion.test.sql: Tests DPDP Act customer account deletion and anonymisation.
begin;
create extension if not exists pgtap with schema extensions;

select plan(7);

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
-- User 1: normal customer
-- User 2: shop owner
insert into auth.users (id, email, phone, raw_user_meta_data) values
  ('e1400000-0000-4000-8000-000000000001', 'cust@dpdp.test', '919847000001', '{"full_name": "Arun Kumar"}'::jsonb),
  ('e1400000-0000-4000-8000-000000000002', 'owner@dpdp.test', '919847000002', '{"full_name": "Shop Owner"}'::jsonb);

-- Set profile names
update public.profiles set full_name = 'Arun Kumar', phone = '919847000001' where id = 'e1400000-0000-4000-8000-000000000001';
update public.profiles set full_name = 'Shop Owner', phone = '919847000002' where id = 'e1400000-0000-4000-8000-000000000002';

-- Create a shop owned by user 2
insert into public.shops (id, name, slug, address_line, location, area)
values (
  's1400000-0000-4000-8000-000000000001',
  'DPDP Barber Shop',
  'dpdp-shop',
  'Main Road, Palakkad',
  extensions.st_point(76.65, 10.78)::extensions.geography,
  'Palakkad Town'
);

insert into public.shop_members (shop_id, user_id, role)
values ('s1400000-0000-4000-8000-000000000001', 'e1400000-0000-4000-8000-000000000002', 'owner');

-- Add push token for user 1
insert into public.push_tokens (user_id, token, platform)
values ('e1400000-0000-4000-8000-000000000001', 'ExponentPushToken[dpdp-token-1]', 'android');

-- Tests ----------------------------------------------------------------------------------------

-- Test 1: Anonymous cannot call delete_my_account
select tests.login_anon();
select throws_ok(
  $$ select public.delete_my_account() $$,
  '42501', null,
  'anonymous cannot call delete_my_account'
);

-- Test 2: Shop owner cannot delete account without transferring shop
select tests.login_as('e1400000-0000-4000-8000-000000000002');
select throws_ok(
  $$ select public.delete_my_account() $$,
  'P0001', 'CANNOT_DELETE_SHOP_OWNER',
  'shop owner cannot delete account'
);

-- Test 3: Customer can delete account
select tests.login_as('e1400000-0000-4000-8000-000000000001');
select lives_ok(
  $$ select public.delete_my_account() $$,
  'customer can delete their account'
);

-- Test 4: Profile is anonymised
select is(
  (select full_name from public.profiles where id = 'e1400000-0000-4000-8000-000000000001'),
  'Deleted Account',
  'profile full_name is replaced with Deleted Account'
);

select is(
  (select phone from public.profiles where id = 'e1400000-0000-4000-8000-000000000001'),
  null,
  'profile phone is cleared'
);

-- Test 5: Push tokens removed
select is_empty(
  $$ select 1 from public.push_tokens where user_id = 'e1400000-0000-4000-8000-000000000001' $$,
  'push tokens are deleted'
);

-- Test 6: Auth user personal data is cleared and user is banned
select ok(
  (select phone is null and banned_until is not null from auth.users where id = 'e1400000-0000-4000-8000-000000000001'),
  'auth user PII is cleared and user is banned'
);

select * from finish();
rollback;
