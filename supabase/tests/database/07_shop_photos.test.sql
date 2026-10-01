-- Shop photos: bucket limits, {shop_id}/ prefixed storage writes, and shop_photos RLS.
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
-- Shop A (active): owner, manager, barber member. Shop B (active): owner. Shop C: inactive.
insert into auth.users (id, email) values
  ('e7000000-0000-4000-8000-000000000001', 'owner.a@photos.test'),
  ('e7000000-0000-4000-8000-000000000002', 'manager.a@photos.test'),
  ('e7000000-0000-4000-8000-000000000003', 'barber.a@photos.test'),
  ('e7000000-0000-4000-8000-000000000004', 'owner.b@photos.test');

insert into public.shops (id, name, slug, address_line, location, is_active) values
  ('e7000000-0000-4000-8000-00000000000a', 'Photo Shop A', 'photo-shop-a', 'Road',
   extensions.st_setsrid(extensions.st_makepoint(76.30, 10.02), 4326)::extensions.geography, true),
  ('e7000000-0000-4000-8000-00000000000b', 'Photo Shop B', 'photo-shop-b', 'Road',
   extensions.st_setsrid(extensions.st_makepoint(76.31, 10.03), 4326)::extensions.geography, true),
  ('e7000000-0000-4000-8000-00000000000c', 'Photo Shop C', 'photo-shop-c', 'Road',
   extensions.st_setsrid(extensions.st_makepoint(76.32, 10.04), 4326)::extensions.geography, false);

insert into public.shop_members (shop_id, user_id, role) values
  ('e7000000-0000-4000-8000-00000000000a', 'e7000000-0000-4000-8000-000000000001', 'owner'),
  ('e7000000-0000-4000-8000-00000000000a', 'e7000000-0000-4000-8000-000000000002', 'manager'),
  ('e7000000-0000-4000-8000-00000000000a', 'e7000000-0000-4000-8000-000000000003', 'barber'),
  ('e7000000-0000-4000-8000-00000000000b', 'e7000000-0000-4000-8000-000000000004', 'owner');

insert into public.shop_photos (shop_id, storage_path) values
  ('e7000000-0000-4000-8000-00000000000c', 'e7000000-0000-4000-8000-00000000000c/hidden.jpg');

-- Bucket ---------------------------------------------------------------------------------------
select results_eq(
  $$ select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'shop-photos' $$,
  $$ values (true, 5242880::bigint, array['image/jpeg', 'image/png', 'image/webp']) $$,
  'shop-photos is public, 5 MB max, JPEG/PNG/WebP only'
);

-- Storage writes -------------------------------------------------------------------------------
select tests.login_as('e7000000-0000-4000-8000-000000000001');
select lives_ok(
  $$ insert into storage.objects (bucket_id, name) values ('shop-photos', 'e7000000-0000-4000-8000-00000000000a/front.jpg') $$,
  'owner can upload under their shop prefix'
);

select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('shop-photos', 'front.jpg') $$,
  '42501', null,
  'uploads outside a {shop_id}/ prefix are rejected'
);

select tests.login_as('e7000000-0000-4000-8000-000000000002');
select lives_ok(
  $$ insert into storage.objects (bucket_id, name) values ('shop-photos', 'e7000000-0000-4000-8000-00000000000a/inside.jpg') $$,
  'manager can upload under their shop prefix'
);

select tests.login_as('e7000000-0000-4000-8000-000000000003');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('shop-photos', 'e7000000-0000-4000-8000-00000000000a/barber.jpg') $$,
  '42501', null,
  'a barber member cannot upload shop photos'
);

select tests.login_as('e7000000-0000-4000-8000-000000000004');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('shop-photos', 'e7000000-0000-4000-8000-00000000000a/evil.jpg') $$,
  '42501', null,
  'another shop''s owner cannot upload under that shop''s prefix'
);

-- Updates and deletes by another shop's owner match no rows (deletes as the Storage API runs them).
update storage.objects set name = 'e7000000-0000-4000-8000-00000000000b/stolen.jpg'
where bucket_id = 'shop-photos' and name = 'e7000000-0000-4000-8000-00000000000a/front.jpg';
select set_config('storage.allow_delete_query', 'true', true);
delete from storage.objects where bucket_id = 'shop-photos';
select set_config('storage.allow_delete_query', 'false', true);

reset role;
select results_eq(
  $$ select name from storage.objects where bucket_id = 'shop-photos' order by name $$,
  $$ values ('e7000000-0000-4000-8000-00000000000a/front.jpg'), ('e7000000-0000-4000-8000-00000000000a/inside.jpg') $$,
  'another shop''s owner cannot move or delete that shop''s photos'
);

select tests.login_anon();
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('shop-photos', 'e7000000-0000-4000-8000-00000000000a/anon.jpg') $$,
  '42501', null,
  'anon cannot upload'
);

-- shop_photos table ----------------------------------------------------------------------------
select tests.login_as('e7000000-0000-4000-8000-000000000001');
select lives_ok(
  $$ insert into public.shop_photos (shop_id, storage_path, alt_text)
     values ('e7000000-0000-4000-8000-00000000000a', 'e7000000-0000-4000-8000-00000000000a/front.jpg', 'Shop front') $$,
  'owner can add a photo row for their shop'
);

select throws_ok(
  $$ insert into public.shop_photos (shop_id, storage_path)
     values ('e7000000-0000-4000-8000-00000000000a', 'e7000000-0000-4000-8000-00000000000b/x.jpg') $$,
  '23514', null,
  'a photo row must point inside its own shop''s folder'
);

select tests.login_as('e7000000-0000-4000-8000-000000000004');
select throws_ok(
  $$ insert into public.shop_photos (shop_id, storage_path)
     values ('e7000000-0000-4000-8000-00000000000a', 'e7000000-0000-4000-8000-00000000000a/evil.jpg') $$,
  '42501', null,
  'another shop''s owner cannot add photo rows'
);

update public.shop_photos set alt_text = 'hacked' where shop_id = 'e7000000-0000-4000-8000-00000000000a';
reset role;
select is(
  (select alt_text from public.shop_photos where storage_path = 'e7000000-0000-4000-8000-00000000000a/front.jpg'),
  'Shop front',
  'another shop''s owner cannot edit photo rows'
);

select tests.login_anon();
select results_eq(
  $$ select storage_path from public.shop_photos order by storage_path $$,
  $$ values ('e7000000-0000-4000-8000-00000000000a/front.jpg') $$,
  'anon sees photos of active shops only'
);

select throws_ok(
  $$ insert into public.shop_photos (shop_id, storage_path)
     values ('e7000000-0000-4000-8000-00000000000a', 'e7000000-0000-4000-8000-00000000000a/anon.jpg') $$,
  '42501', null,
  'anon cannot add photo rows'
);

select * from finish();
rollback;
