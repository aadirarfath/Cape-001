-- Booking API: book_appointment, cancel_booking, update_booking_status,
-- get_available_slots and nearby_shops.
--
-- Errors are raised with SQLSTATE P0001 and a stable code as the message (e.g. 'SLOT_TAKEN'),
-- so clients can match on error.message. The codes are mirrored in @cape001/core.

create function public.book_appointment(
  p_barber_id uuid,
  p_service_id uuid,
  p_starts_at timestamptz,
  p_customer_notes text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_max_active_bookings constant integer := 3;
  v_tz constant text := private.app_time_zone();
  v_uid uuid := (select auth.uid());
  v_barber public.barbers;
  v_shop public.shops;
  v_service public.services;
  v_ends_at timestamptz;
  v_local_start timestamp;
  v_local_end timestamp;
  v_window_start timestamp;
  v_booking public.bookings;
  v_constraint text;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  if p_barber_id is null or p_service_id is null or p_starts_at is null then
    raise exception 'INVALID_REQUEST';
  end if;

  select * into v_barber from public.barbers b where b.id = p_barber_id and b.is_active;
  if not found then
    raise exception 'INVALID_BARBER';
  end if;

  select * into v_shop from public.shops s where s.id = v_barber.shop_id;
  if not v_shop.is_active then
    raise exception 'SHOP_UNAVAILABLE';
  end if;

  select * into v_service
  from public.services sv
  where sv.id = p_service_id and sv.shop_id = v_shop.id and sv.is_active;
  if not found then
    raise exception 'INVALID_SERVICE';
  end if;

  if not exists (
    select 1 from public.barber_services bs
    where bs.barber_id = v_barber.id and bs.service_id = v_service.id
  ) then
    raise exception 'SERVICE_NOT_OFFERED';
  end if;

  if p_starts_at <= now() then
    raise exception 'SLOT_IN_PAST';
  end if;

  v_local_start := p_starts_at at time zone v_tz;
  if v_local_start::date > (now() at time zone v_tz)::date + v_shop.max_days_ahead then
    raise exception 'TOO_FAR_AHEAD';
  end if;

  v_ends_at := p_starts_at + make_interval(mins => v_service.duration_minutes);
  v_local_end := v_ends_at at time zone v_tz;

  -- The whole appointment must fit inside one working-hours window on that local day.
  select v_local_start::date + wh.start_time into v_window_start
  from public.working_hours wh
  where wh.barber_id = v_barber.id
    and wh.weekday = extract(dow from v_local_start)
    and v_local_start::date + wh.start_time <= v_local_start
    and v_local_start::date + wh.end_time >= v_local_end;
  if not found then
    raise exception 'OUTSIDE_WORKING_HOURS';
  end if;

  -- Start times must sit on the shop's slot grid, as offered by get_available_slots.
  if mod(extract(epoch from (v_local_start - v_window_start)), v_shop.slot_interval_minutes * 60) <> 0 then
    raise exception 'INVALID_TIME';
  end if;

  if exists (
    select 1 from public.time_off t
    where t.barber_id = v_barber.id
      and t.starts_at < v_ends_at
      and t.ends_at > p_starts_at
  ) then
    raise exception 'BARBER_UNAVAILABLE';
  end if;

  -- Serialise concurrent requests from the same customer so the limit cannot be raced.
  perform pg_advisory_xact_lock(hashtextextended('book_appointment:' || v_uid::text, 0));

  if (
    select count(*) from public.bookings b
    where b.customer_id = v_uid
      and b.status in ('pending', 'confirmed')
      and b.starts_at > now()
  ) >= c_max_active_bookings then
    raise exception 'BOOKING_LIMIT_REACHED';
  end if;

  -- bookings_no_overlap is the real guarantee against double booking: of two concurrent
  -- inserts for the same slot, the second blocks until the first commits, then fails.
  begin
    insert into public.bookings (
      customer_id, shop_id, barber_id, service_id, starts_at, ends_at,
      status, price_paise, duration_minutes, customer_notes
    )
    values (
      v_uid, v_shop.id, v_barber.id, v_service.id, p_starts_at, v_ends_at,
      'confirmed', v_service.price_paise, v_service.duration_minutes, p_customer_notes
    )
    returning * into v_booking;
  exception
    when exclusion_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'bookings_no_overlap' then
        raise exception 'SLOT_TAKEN';
      end if;
      raise;
  end;

  return v_booking;
end;
$$;

-- Customers can cancel their own booking up to the shop's cancellation cutoff;
-- owners and managers can cancel any booking of their shop at any time.
create function public.cancel_booking(p_booking_id uuid, p_reason text default null)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_booking public.bookings;
  v_is_manager boolean;
  v_cutoff_minutes integer;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select * into v_booking from public.bookings b where b.id = p_booking_id for update;
  if not found then
    raise exception 'BOOKING_NOT_FOUND';
  end if;

  v_is_manager := private.has_shop_role(v_booking.shop_id, '{owner,manager}');

  if not v_is_manager and v_booking.customer_id <> v_uid then
    raise exception 'NOT_AUTHORIZED';
  end if;

  if v_booking.status not in ('pending', 'confirmed') then
    raise exception 'BOOKING_NOT_CANCELLABLE';
  end if;

  if not v_is_manager then
    select s.cancellation_cutoff_minutes into v_cutoff_minutes
    from public.shops s where s.id = v_booking.shop_id;

    if now() > v_booking.starts_at - make_interval(mins => v_cutoff_minutes) then
      raise exception 'CANCELLATION_WINDOW_PASSED';
    end if;
  end if;

  update public.bookings b
  set status = 'cancelled',
      cancelled_at = now(),
      cancelled_by = v_uid,
      cancellation_reason = p_reason
  where b.id = p_booking_id
  returning * into v_booking;

  return v_booking;
end;
$$;

-- Staff status updates: pending -> confirmed, and confirmed -> completed / no_show once the
-- appointment has started. Owners/managers for any booking of their shop, barbers for their own.
-- Cancellation goes through cancel_booking.
create function public.update_booking_status(p_booking_id uuid, p_status public.booking_status)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_booking public.bookings;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select * into v_booking from public.bookings b where b.id = p_booking_id for update;
  if not found then
    raise exception 'BOOKING_NOT_FOUND';
  end if;

  if not (
    private.has_shop_role(v_booking.shop_id, '{owner,manager}')
    or private.is_linked_barber(v_booking.barber_id)
  ) then
    raise exception 'NOT_AUTHORIZED';
  end if;

  if not (
    (v_booking.status = 'pending' and p_status = 'confirmed')
    or (
      v_booking.status = 'confirmed'
      and p_status in ('completed', 'no_show')
      and v_booking.starts_at <= now()
    )
  ) then
    raise exception 'INVALID_STATUS_TRANSITION';
  end if;

  update public.bookings b
  set status = p_status
  where b.id = p_booking_id
  returning * into v_booking;

  return v_booking;
end;
$$;

-- Free start times for a barber + service on a local (Asia/Kolkata) date. Public: it reveals
-- only free slots, never who booked or why a barber is away.
create function public.get_available_slots(p_barber_id uuid, p_service_id uuid, p_date date)
returns table (starts_at timestamptz, ends_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  with ctx as (
    select b.id as barber_id, s.slot_interval_minutes, sv.duration_minutes
    from public.barbers b
    join public.shops s on s.id = b.shop_id and s.is_active
    join public.services sv on sv.id = p_service_id and sv.shop_id = b.shop_id and sv.is_active
    join public.barber_services bs on bs.barber_id = b.id and bs.service_id = sv.id
    where b.id = p_barber_id
      and b.is_active
      and p_date <= (now() at time zone private.app_time_zone())::date + s.max_days_ahead
  ),
  candidates as (
    select
      local_start at time zone private.app_time_zone() as starts_at,
      (local_start + make_interval(mins => ctx.duration_minutes)) at time zone private.app_time_zone() as ends_at
    from ctx
    join public.working_hours wh
      on wh.barber_id = ctx.barber_id
     and wh.weekday = extract(dow from p_date)
    cross join lateral generate_series(
      p_date + wh.start_time,
      p_date + wh.end_time - make_interval(mins => ctx.duration_minutes),
      make_interval(mins => ctx.slot_interval_minutes)
    ) as local_start
  )
  select c.starts_at, c.ends_at
  from candidates c
  where c.starts_at > now()
    and not exists (
      select 1 from public.bookings bk
      where bk.barber_id = p_barber_id
        and bk.status in ('pending', 'confirmed')
        and bk.starts_at < c.ends_at
        and bk.ends_at > c.starts_at
    )
    and not exists (
      select 1 from public.time_off t
      where t.barber_id = p_barber_id
        and t.starts_at < c.ends_at
        and t.ends_at > c.starts_at
    )
  order by c.starts_at;
$$;

-- Active shops within p_radius_m metres (capped at 50 km) of a point, nearest first.
-- Longitude first, like PostGIS: nearby_shops(76.30, 10.02).
create function public.nearby_shops(
  p_lng double precision,
  p_lat double precision,
  p_radius_m integer default 5000
)
returns table (
  id uuid,
  name text,
  slug text,
  address_line text,
  area text,
  city text,
  phone text,
  lng double precision,
  lat double precision,
  distance_m double precision
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_point extensions.geography;
  v_radius double precision := least(greatest(coalesce(p_radius_m, 5000), 1), 50000);
begin
  if p_lng is null or p_lat is null
     or p_lng not between -180 and 180
     or p_lat not between -90 and 90 then
    raise exception 'INVALID_LOCATION';
  end if;

  v_point := extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography;

  return query
    select
      s.id, s.name, s.slug, s.address_line, s.area, s.city, s.phone,
      extensions.st_x(s.location::extensions.geometry),
      extensions.st_y(s.location::extensions.geometry),
      extensions.st_distance(s.location, v_point)
    from public.shops s
    where s.is_active
      and extensions.st_dwithin(s.location, v_point, v_radius)
    order by extensions.st_distance(s.location, v_point), s.id
    limit 50;
end;
$$;

revoke all on function public.book_appointment(uuid, uuid, timestamptz, text) from public, anon;
revoke all on function public.cancel_booking(uuid, text) from public, anon;
revoke all on function public.update_booking_status(uuid, public.booking_status) from public, anon;
revoke all on function public.get_available_slots(uuid, uuid, date) from public;
revoke all on function public.nearby_shops(double precision, double precision, integer) from public;

grant execute on function public.book_appointment(uuid, uuid, timestamptz, text) to authenticated;
grant execute on function public.cancel_booking(uuid, text) to authenticated;
grant execute on function public.update_booking_status(uuid, public.booking_status) to authenticated;
grant execute on function public.get_available_slots(uuid, uuid, date) to anon, authenticated;
grant execute on function public.nearby_shops(double precision, double precision, integer) to anon, authenticated;
