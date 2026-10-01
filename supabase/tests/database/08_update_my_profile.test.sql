-- Profiles: read-only for clients; the name changes only through update_my_profile.
begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

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
insert into auth.users (id, email, phone) values
  ('e8000000-0000-4000-8000-000000000001', 'me@profile.test', '919999900001'),
  ('e8000000-0000-4000-8000-000000000002', 'other@profile.test', '919999900002');

-- Tests ----------------------------------------------------------------------------------------
select tests.login_as('e8000000-0000-4000-8000-000000000001');

select is(
  (select full_name from public.update_my_profile('   Anjali    Krishnan  ')),
  'Anjali Krishnan',
  'update_my_profile trims and collapses whitespace'
);

select throws_ok(
  $$ select public.update_my_profile(' A ') $$,
  'P0001', 'INVALID_NAME',
  'names shorter than 2 characters are rejected'
);

select throws_ok(
  $$ select public.update_my_profile(repeat('a', 61)) $$,
  'P0001', 'INVALID_NAME',
  'names longer than 60 characters are rejected'
);

select lives_ok(
  $$ select public.update_my_profile(repeat('a', 60)) $$,
  'a 60-character name is accepted'
);

select throws_ok(
  $$ update public.profiles set phone = '910000000000' where id = 'e8000000-0000-4000-8000-000000000001' $$,
  '42501', null,
  'customers cannot change their phone directly'
);

select throws_ok(
  $$ update public.profiles set full_name = 'Direct' where id = 'e8000000-0000-4000-8000-000000000001' $$,
  '42501', null,
  'customers cannot change their name directly either'
);

select throws_ok(
  $$ update public.profiles set avatar_url = 'https://x.test/a.png' where id = 'e8000000-0000-4000-8000-000000000001' $$,
  '42501', null,
  'customers cannot change other profile columns directly'
);

reset role;
select results_eq(
  $$ select full_name, phone from public.profiles where id in ('e8000000-0000-4000-8000-000000000001', 'e8000000-0000-4000-8000-000000000002') order by id $$,
  $$ values (repeat('a', 60), '919999900001'), (null, '919999900002') $$,
  'only the caller''s own name changed; phones are untouched'
);

select tests.login_anon();
select throws_ok(
  $$ select public.update_my_profile('Anon User') $$,
  '42501', null,
  'anon cannot call update_my_profile'
);

select * from finish();
rollback;
