-- Local development seed (runs on `pnpm db:reset`). Never run against production.
--
-- Users (password for all: password123)
--   admin@cape001.test               platform admin
--   owner.edappally@cape001.test     owner, Edappally shop
--   manager.edappally@cape001.test   manager, Edappally shop
--   arjun@cape001.test               barber with a login, Edappally shop
--   owner.kakkanad@cape001.test      owner, Kakkanad shop
--   owner.fortkochi@cape001.test     owner, Fort Kochi shop
--   customer@cape001.test            customer
--   customer2@cape001.test           customer

-- Users ----------------------------------------------------------------------------------

with seed_users (id, email, full_name) as (
  values
    ('00000000-0000-4000-8000-000000000001'::uuid, 'admin@cape001.test', 'Platform Admin'),
    ('00000000-0000-4000-8000-000000000002'::uuid, 'owner.edappally@cape001.test', 'Rajesh Menon'),
    ('00000000-0000-4000-8000-000000000003'::uuid, 'manager.edappally@cape001.test', 'Divya Pillai'),
    ('00000000-0000-4000-8000-000000000004'::uuid, 'arjun@cape001.test', 'Arjun Das'),
    ('00000000-0000-4000-8000-000000000005'::uuid, 'owner.kakkanad@cape001.test', 'Suresh Nair'),
    ('00000000-0000-4000-8000-000000000006'::uuid, 'owner.fortkochi@cape001.test', 'Thomas Varghese'),
    ('00000000-0000-4000-8000-000000000007'::uuid, 'customer@cape001.test', 'Anjali Krishnan'),
    ('00000000-0000-4000-8000-000000000008'::uuid, 'customer2@cape001.test', 'Rahul Thomas')
),
inserted_users as (
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new
  )
  select
    '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email,
    extensions.crypt('password123', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', full_name),
    now(), now(), '', '', '', ''
  from seed_users
  returning id, email
)
insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select
  gen_random_uuid(), id, id::text, 'email',
  jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
  now(), now(), now()
from inserted_users;

-- Profiles are created by the on_auth_user_created trigger.

insert into public.platform_admins (user_id)
values ('00000000-0000-4000-8000-000000000001');

-- Shops (already approved) ----------------------------------------------------------------

insert into public.shops (
  id, name, slug, description, phone, address_line, area, city, postal_code, location,
  slot_interval_minutes, max_days_ahead, cancellation_cutoff_minutes,
  is_active, approved_at, approved_by, created_by
)
values
  (
    '10000000-0000-4000-8000-000000000001', 'Fade Theory', 'fade-theory-edappally',
    'Modern fades, beard sculpting and hair spa near Lulu Mall.', '+91 98470 10001',
    'NH 66, opposite Lulu Mall', 'Edappally', 'Kochi', '682024',
    extensions.st_setsrid(extensions.st_makepoint(76.3083, 10.0261), 4326)::extensions.geography,
    15, 30, 30, true, now(), '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002'
  ),
  (
    '10000000-0000-4000-8000-000000000002', 'Infopark Grooming Lounge', 'infopark-grooming-kakkanad',
    'Quick cuts for the Infopark crowd, open late on weekdays.', '+91 98470 10002',
    'Seaport-Airport Road, near Kakkanad Junction', 'Kakkanad', 'Kochi', '682030',
    extensions.st_setsrid(extensions.st_makepoint(76.3419, 10.0159), 4326)::extensions.geography,
    15, 30, 30, true, now(), '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000005'
  ),
  (
    '10000000-0000-4000-8000-000000000003', 'Fort Kochi Barber Co.', 'fort-kochi-barber-co',
    'Classic shaves and heritage cuts on Princess Street.', '+91 98470 10003',
    'Princess Street', 'Fort Kochi', 'Kochi', '682001',
    extensions.st_setsrid(extensions.st_makepoint(76.2422, 9.9658), 4326)::extensions.geography,
    30, 21, 60, true, now(), '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000006'
  );

insert into public.shop_members (shop_id, user_id, role)
values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'owner'),
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000003', 'manager'),
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000004', 'barber'),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000005', 'owner'),
  ('10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000006', 'owner');

-- Barbers (only Arjun has a login) --------------------------------------------------------

insert into public.barbers (id, shop_id, user_id, display_name, bio, sort_order)
values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000004', 'Arjun', 'Skin fades and textured crops.', 1),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', null, 'Faisal', 'Beard specialist.', 2),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', null, 'Vishnu', 'Classic cuts and kids.', 3),
  ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000002', null, 'Nikhil', 'Fast, sharp office cuts.', 1),
  ('20000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000002', null, 'Shibu', 'Hair spa and colouring.', 2),
  ('20000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000003', null, 'Joseph', 'Thirty years of straight-razor shaves.', 1),
  ('20000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000003', null, 'Anwar', 'Pompadours and vintage styles.', 2);

-- Services (prices in paise) -------------------------------------------------------------

insert into public.services (shop_id, name, duration_minutes, price_paise, sort_order)
values
  ('10000000-0000-4000-8000-000000000001', 'Haircut', 30, 30000, 1),
  ('10000000-0000-4000-8000-000000000001', 'Beard Trim', 15, 15000, 2),
  ('10000000-0000-4000-8000-000000000001', 'Haircut + Beard', 45, 40000, 3),
  ('10000000-0000-4000-8000-000000000001', 'Kids Haircut', 20, 20000, 4),
  ('10000000-0000-4000-8000-000000000001', 'Hair Spa', 45, 80000, 5),
  ('10000000-0000-4000-8000-000000000002', 'Haircut', 30, 25000, 1),
  ('10000000-0000-4000-8000-000000000002', 'Beard Trim', 15, 12000, 2),
  ('10000000-0000-4000-8000-000000000002', 'Clean Shave', 20, 10000, 3),
  ('10000000-0000-4000-8000-000000000002', 'Hair Colour', 60, 90000, 4),
  ('10000000-0000-4000-8000-000000000003', 'Heritage Cut', 30, 35000, 1),
  ('10000000-0000-4000-8000-000000000003', 'Straight-Razor Shave', 30, 25000, 2),
  ('10000000-0000-4000-8000-000000000003', 'Cut + Shave', 60, 55000, 3),
  ('10000000-0000-4000-8000-000000000003', 'Head Massage', 30, 30000, 4);

-- Every barber offers every service of their shop, except the specialist services.
insert into public.barber_services (barber_id, service_id, shop_id)
select b.id, s.id, b.shop_id
from public.barbers b
join public.services s on s.shop_id = b.shop_id
where not (s.name = 'Hair Spa' and b.display_name <> 'Faisal')
  and not (s.name = 'Hair Colour' and b.display_name <> 'Shibu');

-- Working hours (local Asia/Kolkata wall-clock time; weekday 0 = Sunday) ------------------

-- Edappally: Mon-Sat 09:30-13:30 and 14:30-20:30, Sun 10:00-14:00.
insert into public.working_hours (barber_id, shop_id, weekday, start_time, end_time)
select b.id, b.shop_id, d, w.start_time, w.end_time
from public.barbers b
cross join generate_series(1, 6) as d
cross join (values (time '09:30', time '13:30'), (time '14:30', time '20:30')) as w (start_time, end_time)
where b.shop_id = '10000000-0000-4000-8000-000000000001'
union all
select b.id, b.shop_id, 0, time '10:00', time '14:00'
from public.barbers b
where b.shop_id = '10000000-0000-4000-8000-000000000001';

-- Kakkanad: Mon-Sat 09:00-13:00 and 14:00-21:00, closed Sunday.
insert into public.working_hours (barber_id, shop_id, weekday, start_time, end_time)
select b.id, b.shop_id, d, w.start_time, w.end_time
from public.barbers b
cross join generate_series(1, 6) as d
cross join (values (time '09:00', time '13:00'), (time '14:00', time '21:00')) as w (start_time, end_time)
where b.shop_id = '10000000-0000-4000-8000-000000000002';

-- Fort Kochi: Tue-Sun 10:00-19:00, closed Monday.
insert into public.working_hours (barber_id, shop_id, weekday, start_time, end_time)
select b.id, b.shop_id, d, time '10:00', time '19:00'
from public.barbers b
cross join (values (0), (2), (3), (4), (5), (6)) as days (d)
where b.shop_id = '10000000-0000-4000-8000-000000000003';

-- Sample time off: Faisal is away tomorrow afternoon (local time).
insert into public.time_off (barber_id, shop_id, starts_at, ends_at, reason, created_by)
values (
  '20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001',
  ((now() at time zone 'Asia/Kolkata')::date + 1 + time '14:30') at time zone 'Asia/Kolkata',
  ((now() at time zone 'Asia/Kolkata')::date + 1 + time '20:30') at time zone 'Asia/Kolkata',
  'Family function', '00000000-0000-4000-8000-000000000002'
);
