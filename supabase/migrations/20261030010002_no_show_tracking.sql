-- No-show tracking for shops & repeat no-show booking protection.
--
-- 1. get_customer_no_show_count: allows staff (owners, managers, barbers) to see
--    how many times a customer has no-showed at their shop (or customer to check their own).
-- 2. book_appointment: updated to check if the customer has 3 or more no-shows at
--    the shop within the past 90 days, raising 'TOO_MANY_NO_SHOWS'.

create or replace function public.get_customer_no_show_count(
  p_customer_id uuid,
  p_shop_id uuid default null
)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  if p_customer_id is null then
    raise exception 'INVALID_REQUEST';
  end if;

  -- Customer may view their own; staff may view if they belong to the shop
  if v_uid <> p_customer_id then
    if p_shop_id is null or not (
      private.has_shop_role(p_shop_id, '{owner,manager,barber}')
    ) then
      raise exception 'NOT_AUTHORIZED';
    end if;
  end if;

  return (
    select count(*)::integer
    from public.bookings b
    where b.customer_id = p_customer_id
      and (p_shop_id is null or b.shop_id = p_shop_id)
      and b.status = 'no_show'
  );
end;
$$;

revoke all on function public.get_customer_no_show_count(uuid, uuid) from public, anon;
grant execute on function public.get_customer_no_show_count(uuid, uuid) to authenticated;

-- Replace book_appointment to enforce the repeat no-show limit
create or replace function public.book_appointment(
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
  c_max_recent_no_shows constant integer := 3;
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

  -- Reject customers with repeated recent no-shows at this shop
  if (
    select count(*) from public.bookings b
    where b.customer_id = v_uid
      and b.shop_id = v_shop.id
      and b.status = 'no_show'
      and b.starts_at >= (now() - interval '90 days')
  ) >= c_max_recent_no_shows then
    raise exception 'TOO_MANY_NO_SHOWS';
  end if;

  if (
    select count(*) from public.bookings b
    where b.customer_id = v_uid
      and b.status in ('pending', 'confirmed')
      and b.starts_at > now()
  ) >= c_max_active_bookings then
    raise exception 'BOOKING_LIMIT_REACHED';
  end if;

  -- bookings_no_overlap is the real guarantee against double booking
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
