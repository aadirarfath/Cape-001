-- Barber invites: owner-only invite_barber, claim_barber_invites matching the verified auth
-- phone, membership on claim, idempotency, and barbers.user_id no longer client-writable.
begin;
create extension if not exists pgtap with schema extensions;

select plan(28);

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
-- e9..01 owner A (phone confirmed), 02 manager A, 03 invitee (phone confirmed),
-- 04 user whose phone is NOT confirmed, 05 owner B.
insert into auth.users (id, email, phone, phone_confirmed_at) values
  ('e9000000-0000-4000-8000-000000000001', 'owner.a@invites.test', '919847000001', now()),
  ('e9000000-0000-4000-8000-000000000002', 'manager.a@invites.test', null, null),
  ('e9000000-0000-4000-8000-000000000003', null, '919847000003', now()),
  ('e9000000-0000-4000-8000-000000000004', null, '919847000004', null),
  ('e9000000-0000-4000-8000-000000000005', 'owner.b@invites.test', null, null);

insert into public.shops (id, name, slug, address_line, location, is_active) values
  ('e9000000-0000-4000-8000-00000000000a', 'Invite Shop A', 'invite-shop-a', 'Road',
   extensions.st_setsrid(extensions.st_makepoint(76.30, 10.02), 4326)::extensions.geography, true),
  ('e9000000-0000-4000-8000-00000000000b', 'Invite Shop B', 'invite-shop-b', 'Road',
   extensions.st_setsrid(extensions.st_makepoint(76.31, 10.03), 4326)::extensions.geography, true);

insert into public.shop_members (shop_id, user_id, role) values
  ('e9000000-0000-4000-8000-00000000000a', 'e9000000-0000-4000-8000-000000000001', 'owner'),
  ('e9000000-0000-4000-8000-00000000000a', 'e9000000-0000-4000-8000-000000000002', 'manager'),
  ('e9000000-0000-4000-8000-00000000000b', 'e9000000-0000-4000-8000-000000000005', 'owner');

-- A1, A2, A3 (A3 is for the owner themselves) in shop A; B1 in shop B. None linked.
insert into public.barbers (id, shop_id, display_name) values
  ('e9000000-0000-4000-8000-0000000000a1', 'e9000000-0000-4000-8000-00000000000a', 'Basheer'),
  ('e9000000-0000-4000-8000-0000000000a2', 'e9000000-0000-4000-8000-00000000000a', 'Manu'),
  ('e9000000-0000-4000-8000-0000000000a3', 'e9000000-0000-4000-8000-00000000000a', 'Owner Cuts'),
  ('e9000000-0000-4000-8000-0000000000b1', 'e9000000-0000-4000-8000-00000000000b', 'Basheer B');

-- Inviting -------------------------------------------------------------------------------------
select tests.login_as('e9000000-0000-4000-8000-000000000002');
select throws_ok(
  $$ select public.invite_barber('e9000000-0000-4000-8000-0000000000a1', '+919847000003') $$,
  'P0001', 'NOT_AUTHORIZED',
  'a manager cannot invite barbers'
);

select tests.login_as('e9000000-0000-4000-8000-000000000005');
select throws_ok(
  $$ select public.invite_barber('e9000000-0000-4000-8000-0000000000a1', '+919847000003') $$,
  'P0001', 'NOT_AUTHORIZED',
  'another shop''s owner cannot invite this shop''s barbers'
);

select tests.login_as('e9000000-0000-4000-8000-000000000001');
select throws_ok(
  $$ select public.invite_barber('e9000000-0000-4000-8000-0000000000a1', '9847000003') $$,
  'P0001', 'INVALID_PHONE',
  'the phone must be E.164 (+91 and a 10-digit mobile)'
);

select throws_ok(
  $$ select public.invite_barber('e9000000-0000-4000-8000-0000000000ff', '+919847000003') $$,
  'P0001', 'INVALID_BARBER',
  'inviting an unknown barber fails'
);

select lives_ok(
  $$ select public.invite_barber('e9000000-0000-4000-8000-0000000000a1', '+919847000003') $$,
  'the owner can invite a barber by phone'
);

select lives_ok(
  $$ select public.invite_barber('e9000000-0000-4000-8000-0000000000a1', '+919847000003') $$,
  'inviting the same barber again replaces the invite'
);

select throws_ok(
  $$ select public.invite_barber('e9000000-0000-4000-8000-0000000000a2', '+919847000003') $$,
  'P0001', 'PHONE_ALREADY_INVITED',
  'one phone cannot be invited for two barbers of the same shop'
);

-- An invite to an unconfirmed phone, and shop B inviting the same person.
select lives_ok(
  $$ select public.invite_barber('e9000000-0000-4000-8000-0000000000a2', '+919847000004') $$,
  'the owner can invite a second barber with another phone'
);

select tests.login_as('e9000000-0000-4000-8000-000000000005');
select lives_ok(
  $$ select public.invite_barber('e9000000-0000-4000-8000-0000000000b1', '+919847000003') $$,
  'another shop can invite the same person'
);

-- Who can see invites --------------------------------------------------------------------------
select tests.login_as('e9000000-0000-4000-8000-000000000002');
select results_eq(
  $$ select barber_id, phone from public.barber_invites order by phone $$,
  $$ values ('e9000000-0000-4000-8000-0000000000a1'::uuid, '+919847000003'),
            ('e9000000-0000-4000-8000-0000000000a2'::uuid, '+919847000004') $$,
  'the manager sees their own shop''s invites only'
);

select tests.login_as('e9000000-0000-4000-8000-000000000003');
select is_empty(
  $$ select 1 from public.barber_invites $$,
  'a non-member cannot see invites (not even for their own phone)'
);

select tests.login_anon();
select throws_ok(
  $$ select 1 from public.barber_invites $$,
  '42501', null,
  'anon cannot read invites'
);

select is_empty(
  $$ select 1 from public.barbers b
     where b.id = 'e9000000-0000-4000-8000-0000000000a1'
       and (to_jsonb(b) ? 'invited_phone' or to_jsonb(b) ? 'phone') $$,
  'public barbers rows carry no phone number'
);

-- Direct writes are blocked --------------------------------------------------------------------
select tests.login_as('e9000000-0000-4000-8000-000000000001');
select throws_ok(
  $$ insert into public.barber_invites (barber_id, shop_id, phone)
     values ('e9000000-0000-4000-8000-0000000000a3', 'e9000000-0000-4000-8000-00000000000a', '+919847000009') $$,
  '42501', null,
  'invites cannot be inserted directly'
);

select throws_ok(
  $$ update public.barbers set user_id = 'e9000000-0000-4000-8000-000000000003'
     where id = 'e9000000-0000-4000-8000-0000000000a1' $$,
  '42501', null,
  'the owner cannot set barbers.user_id directly'
);

select throws_ok(
  $$ insert into public.barbers (shop_id, user_id, display_name)
     values ('e9000000-0000-4000-8000-00000000000a', 'e9000000-0000-4000-8000-000000000003', 'Sneaky') $$,
  '42501', null,
  'a barber cannot be created already linked to a user'
);

select lives_ok(
  $$ update public.barbers set display_name = 'Basheer K', is_active = true
     where id = 'e9000000-0000-4000-8000-0000000000a1' $$,
  'the owner can still edit the barber''s name and status'
);

-- Claiming -------------------------------------------------------------------------------------
select tests.login_as('e9000000-0000-4000-8000-000000000004');
select is_empty(
  $$ select * from public.claim_barber_invites() $$,
  'a user whose phone is not confirmed claims nothing'
);

select tests.login_as('e9000000-0000-4000-8000-000000000003');
select results_eq(
  $$ select id from public.claim_barber_invites() order by id $$,
  $$ values ('e9000000-0000-4000-8000-0000000000a1'::uuid), ('e9000000-0000-4000-8000-0000000000b1'::uuid) $$,
  'the invitee claims their invites in both shops'
);

select results_eq(
  $$ select shop_id, role from public.shop_members
     where user_id = 'e9000000-0000-4000-8000-000000000003' order by shop_id $$,
  $$ values ('e9000000-0000-4000-8000-00000000000a'::uuid, 'barber'::public.shop_role),
            ('e9000000-0000-4000-8000-00000000000b'::uuid, 'barber'::public.shop_role) $$,
  'the invitee became a barber member of both shops'
);

select is_empty(
  $$ select * from public.claim_barber_invites() $$,
  'claiming again does nothing'
);

select lives_ok(
  $$ insert into public.time_off (barber_id, shop_id, starts_at, ends_at)
     values ('e9000000-0000-4000-8000-0000000000a1', 'e9000000-0000-4000-8000-00000000000a',
             now() + interval '1 day', now() + interval '1 day 2 hours') $$,
  'the linked barber can now manage their own time off'
);

reset role;
select is(
  (select count(*)::int from public.barber_invites where phone = '+919847000003'),
  0,
  'claimed invites are removed'
);

-- After linking --------------------------------------------------------------------------------
select tests.login_as('e9000000-0000-4000-8000-000000000001');
select throws_ok(
  $$ select public.invite_barber('e9000000-0000-4000-8000-0000000000a1', '+919847000005') $$,
  'P0001', 'BARBER_ALREADY_LINKED',
  'a linked barber cannot be invited again'
);

select throws_ok(
  $$ select public.invite_barber('e9000000-0000-4000-8000-0000000000a3', '+919847000003') $$,
  'P0001', 'PHONE_ALREADY_INVITED',
  'a phone already linked to a barber of the shop cannot be invited again'
);

-- The owner invites their own phone for a barber row and keeps the owner role.
select lives_ok(
  $$ select public.invite_barber('e9000000-0000-4000-8000-0000000000a3', '+919847000001') $$,
  'the owner can invite their own phone'
);

select results_eq(
  $$ select id from public.claim_barber_invites() $$,
  $$ values ('e9000000-0000-4000-8000-0000000000a3'::uuid) $$,
  'the owner claims their own barber row'
);

select is(
  (select role from public.shop_members
   where shop_id = 'e9000000-0000-4000-8000-00000000000a' and user_id = 'e9000000-0000-4000-8000-000000000001'),
  'owner'::public.shop_role,
  'an owner who is also a barber keeps the owner role'
);

select * from finish();
rollback;
