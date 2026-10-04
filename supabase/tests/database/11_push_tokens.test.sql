-- push_tokens: users can read and manage only their own Expo push tokens.
begin;
create extension if not exists pgtap with schema extensions;

select plan(14);

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
  ('e1100000-0000-4000-8000-000000000001', 'one@push.test'),
  ('e1100000-0000-4000-8000-000000000002', 'two@push.test');

-- Tests ----------------------------------------------------------------------------------------
select tests.login_as('e1100000-0000-4000-8000-000000000001');
select lives_ok(
  $$ insert into public.push_tokens (token, platform) values ('ExponentPushToken[device-one]', 'android') $$,
  'a user can register a token'
);

select results_eq(
  $$ select user_id from public.push_tokens $$,
  $$ values ('e1100000-0000-4000-8000-000000000001'::uuid) $$,
  'the token belongs to the current user by default'
);

select throws_ok(
  $$ insert into public.push_tokens (user_id, token, platform)
     values ('e1100000-0000-4000-8000-000000000002', 'ExponentPushToken[planted]', 'android') $$,
  '42501', null,
  'a user cannot register a token for someone else'
);

select throws_ok(
  $$ insert into public.push_tokens (token, platform) values ('not-an-expo-token', 'android') $$,
  '23514', null,
  'only Expo push tokens are accepted'
);

select throws_ok(
  $$ insert into public.push_tokens (token, platform) values ('ExponentPushToken[x]', 'windows') $$,
  '23514', null,
  'platform must be android or ios'
);

select lives_ok(
  $$ insert into public.push_tokens (token, platform) values ('ExponentPushToken[device-one]', 'ios')
     on conflict (user_id, token) do update set token = excluded.token, platform = excluded.platform $$,
  're-registering the same device upserts (as supabase-js upsert does)'
);

select throws_ok(
  $$ update public.push_tokens set user_id = 'e1100000-0000-4000-8000-000000000002' $$,
  '42501', null,
  'a token cannot be handed to another user'
);

-- Another user ---------------------------------------------------------------------------------
select tests.login_as('e1100000-0000-4000-8000-000000000002');
select is_empty(
  $$ select 1 from public.push_tokens $$,
  'a user cannot see someone else''s tokens'
);

update public.push_tokens set platform = 'android';
delete from public.push_tokens;

reset role;
select results_eq(
  $$ select user_id, platform from public.push_tokens $$,
  $$ values ('e1100000-0000-4000-8000-000000000001'::uuid, 'ios') $$,
  'a user cannot change or delete someone else''s tokens'
);

select tests.login_as('e1100000-0000-4000-8000-000000000002');
select lives_ok(
  $$ insert into public.push_tokens (token, platform) values ('ExponentPushToken[device-one]', 'android') $$,
  'the same device can also be registered by a second user (shared phone)'
);

select tests.login_anon();
select throws_ok(
  $$ select 1 from public.push_tokens $$,
  '42501', null,
  'anon cannot read tokens'
);

select throws_ok(
  $$ insert into public.push_tokens (user_id, token, platform)
     values ('e1100000-0000-4000-8000-000000000001', 'ExponentPushToken[anon]', 'android') $$,
  '42501', null,
  'anon cannot register tokens'
);

-- Logging out deletes the device's token.
select tests.login_as('e1100000-0000-4000-8000-000000000001');
select lives_ok(
  $$ delete from public.push_tokens where token = 'ExponentPushToken[device-one]' $$,
  'a user can delete their own token'
);

reset role;
select results_eq(
  $$ select user_id from public.push_tokens $$,
  $$ values ('e1100000-0000-4000-8000-000000000002'::uuid) $$,
  'only the user''s own row was deleted'
);

select * from finish();
rollback;
