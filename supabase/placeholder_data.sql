-- Placeholder shops for the hosted project. Edit or delete these rows before launch.
--
-- Unlike seed.sql this creates no users, passwords or platform admins, so it is safe to run
-- against production. Run it once in the Supabase dashboard SQL editor. Running it again does
-- nothing if the placeholder shops already exist.
--
-- Optional: set owner_phone below to the phone number of an account that has already signed
-- in to the partner app (e.g. '+91 98470 12345'). That account becomes the owner of all three
-- shops so it can manage them. Leave it null to create the shops without an owner.

do $$
declare
  owner_phone constant text := '+91 99999 99999';
  owner_id uuid;
  edappally constant uuid := 'c0000000-0000-4000-8000-000000000001';
  kakkanad constant uuid := 'c0000000-0000-4000-8000-000000000002';
  fortkochi constant uuid := 'c0000000-0000-4000-8000-000000000003';
begin
  if exists (select 1 from public.shops where id in (edappally, kakkanad, fortkochi)) then
    raise notice 'Placeholder shops already exist; nothing to do.';
    return;
  end if;

  if owner_phone is not null then
    select id into owner_id
    from auth.users
    where regexp_replace(phone, '\D', '', 'g') = regexp_replace(owner_phone, '\D', '', 'g');

    if owner_id is null then
      raise exception 'No account with phone %. Sign in to the partner app with it first.', owner_phone;
    end if;
  end if;

  -- Shops (already approved and visible on the website) --------------------------------------

  insert into public.shops (
    id, name, slug, description, phone, address_line, area, city, postal_code, location,
    slot_interval_minutes, max_days_ahead, cancellation_cutoff_minutes,
    is_active, approved_at, approved_by, created_by
  )
  values
    (
      edappally, 'Fade Theory', 'fade-theory-edappally',
      'Modern fades, beard sculpting and hair spa near Lulu Mall.', '+91 98470 10001',
      'NH 66, opposite Lulu Mall', 'Edappally', 'Kochi', '682024',
      extensions.st_setsrid(extensions.st_makepoint(76.3083, 10.0261), 4326)::extensions.geography,
      15, 30, 30, true, now(), null, owner_id
    ),
    (
      kakkanad, 'Infopark Grooming Lounge', 'infopark-grooming-kakkanad',
      'Quick cuts for the Infopark crowd, open late on weekdays.', '+91 98470 10002',
      'Seaport-Airport Road, near Kakkanad Junction', 'Kakkanad', 'Kochi', '682030',
      extensions.st_setsrid(extensions.st_makepoint(76.3419, 10.0159), 4326)::extensions.geography,
      15, 30, 30, true, now(), null, owner_id
    ),
    (
      fortkochi, 'Fort Kochi Barber Co.', 'fort-kochi-barber-co',
      'Classic shaves and heritage cuts on Princess Street.', '+91 98470 10003',
      'Princess Street', 'Fort Kochi', 'Kochi', '682001',
      extensions.st_setsrid(extensions.st_makepoint(76.2422, 9.9658), 4326)::extensions.geography,
      30, 21, 60, true, now(), null, owner_id
    );

  if owner_id is not null then
    insert into public.shop_members (shop_id, user_id, role)
    values (edappally, owner_id, 'owner'), (kakkanad, owner_id, 'owner'), (fortkochi, owner_id, 'owner');
  end if;

  -- Barbers (no logins; link accounts later from the partner app) ----------------------------

  insert into public.barbers (shop_id, display_name, bio, sort_order)
  values
    (edappally, 'Arjun', 'Skin fades and textured crops.', 1),
    (edappally, 'Faisal', 'Beard specialist.', 2),
    (edappally, 'Vishnu', 'Classic cuts and kids.', 3),
    (kakkanad, 'Nikhil', 'Fast, sharp office cuts.', 1),
    (kakkanad, 'Shibu', 'Hair spa and colouring.', 2),
    (fortkochi, 'Joseph', 'Thirty years of straight-razor shaves.', 1),
    (fortkochi, 'Anwar', 'Pompadours and vintage styles.', 2);

  -- Services (prices in paise) ---------------------------------------------------------------

  insert into public.services (shop_id, name, duration_minutes, price_paise, sort_order)
  values
    (edappally, 'Haircut', 30, 30000, 1),
    (edappally, 'Beard Trim', 15, 15000, 2),
    (edappally, 'Haircut + Beard', 45, 40000, 3),
    (edappally, 'Kids Haircut', 20, 20000, 4),
    (edappally, 'Hair Spa', 45, 80000, 5),
    (kakkanad, 'Haircut', 30, 25000, 1),
    (kakkanad, 'Beard Trim', 15, 12000, 2),
    (kakkanad, 'Clean Shave', 20, 10000, 3),
    (kakkanad, 'Hair Colour', 60, 90000, 4),
    (fortkochi, 'Heritage Cut', 30, 35000, 1),
    (fortkochi, 'Straight-Razor Shave', 30, 25000, 2),
    (fortkochi, 'Cut + Shave', 60, 55000, 3),
    (fortkochi, 'Head Massage', 30, 30000, 4);

  -- Every barber offers every service of their shop, except the specialist services.
  insert into public.barber_services (barber_id, service_id, shop_id)
  select b.id, s.id, b.shop_id
  from public.barbers b
  join public.services s on s.shop_id = b.shop_id
  where b.shop_id in (edappally, kakkanad, fortkochi)
    and not (s.name = 'Hair Spa' and b.display_name <> 'Faisal')
    and not (s.name = 'Hair Colour' and b.display_name <> 'Shibu');

  -- Working hours (local Asia/Kolkata wall-clock time; weekday 0 = Sunday) --------------------

  -- Edappally: Mon-Sat 09:30-13:30 and 14:30-20:30, Sun 10:00-14:00.
  insert into public.working_hours (barber_id, shop_id, weekday, start_time, end_time)
  select b.id, b.shop_id, d, w.start_time, w.end_time
  from public.barbers b
  cross join generate_series(1, 6) as d
  cross join (values (time '09:30', time '13:30'), (time '14:30', time '20:30')) as w (start_time, end_time)
  where b.shop_id = edappally
  union all
  select b.id, b.shop_id, 0, time '10:00', time '14:00'
  from public.barbers b
  where b.shop_id = edappally;

  -- Kakkanad: Mon-Sat 09:00-13:00 and 14:00-21:00, closed Sunday.
  insert into public.working_hours (barber_id, shop_id, weekday, start_time, end_time)
  select b.id, b.shop_id, d, w.start_time, w.end_time
  from public.barbers b
  cross join generate_series(1, 6) as d
  cross join (values (time '09:00', time '13:00'), (time '14:00', time '21:00')) as w (start_time, end_time)
  where b.shop_id = kakkanad;

  -- Fort Kochi: Tue-Sun 10:00-19:00, closed Monday.
  insert into public.working_hours (barber_id, shop_id, weekday, start_time, end_time)
  select b.id, b.shop_id, d, time '10:00', time '19:00'
  from public.barbers b
  cross join (values (0), (2), (3), (4), (5), (6)) as days (d)
  where b.shop_id = fortkochi;

  raise notice 'Placeholder shops created.';
end
$$;
