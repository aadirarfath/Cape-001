-- Seat reservation: hold_seat() and hold_seats() SECURITY DEFINER functions.
--
-- These are the only way clients create seat-type bookings. They check
-- availability, enforce the per-user seat cap, and insert the booking in
-- 'held' status. The partial unique index on bookings.seat_id is the final
-- concurrency guard: if two transactions race past the check, exactly one
-- insert wins.

-- hold_seat: hold a single seat for the calling user.
-- Returns the new booking row (in 'held' status).
create function public.hold_seat(
  p_show_id  uuid,
  p_seat_id  uuid
)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_hold_minutes      constant integer := 10;
  c_max_seats_per_user constant integer := 6;
  v_uid   uuid := (select auth.uid());
  v_show  public.shows;
  v_seat  public.seats;
  v_held_count integer;
  v_booking public.bookings;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  -- Validate show
  select * into v_show
  from public.shows sh
  where sh.id = p_show_id
    and sh.is_active
    and exists (select 1 from public.shops s where s.id = sh.shop_id and s.is_active);
  if not found then
    raise exception 'SHOW_NOT_FOUND';
  end if;

  -- Validate seat belongs to the show
  select * into v_seat
  from public.seats se
  where se.id = p_seat_id
    and se.show_id = p_show_id
    and se.is_active;
  if not found then
    raise exception 'SEAT_NOT_FOUND';
  end if;

  -- Lazily expire overdue holds so inventory is released immediately
  update public.bookings
  set status = 'expired'
  where status = 'held'
    and hold_expires_at < now();

  -- Enforce per-user seat cap for this show
  select count(*) into v_held_count
  from public.bookings b
  where b.customer_id = v_uid
    and b.seat_id in (
      select id from public.seats where show_id = p_show_id
    )
    and b.status in ('held', 'confirmed');
  if v_held_count >= c_max_seats_per_user then
    raise exception 'SEAT_LIMIT_REACHED';
  end if;

  -- Insert the hold; the unique index catches concurrent races.
  begin
    insert into public.bookings (
      customer_id, shop_id, seat_id,
      -- barber_id and service_id are not used for seat bookings; we reference the
      -- show's shop. The NOT NULL constraints on barber_id/service_id don't apply
      -- because the columns are nullable after the schema extension migration.
      -- price/duration are stored as snapshots.
      price_paise, duration_minutes,
      status, hold_expires_at,
      -- starts_at / ends_at reflect the show window.
      starts_at, ends_at
    )
    values (
      v_uid,
      v_show.shop_id,
      p_seat_id,
      v_seat.price_paise,
      -- duration_minutes: length of the show in minutes (stored as a snapshot)
      greatest(1, extract(epoch from (v_show.ends_at - v_show.starts_at))::integer / 60),
      'held',
      now() + make_interval(mins => c_hold_minutes),
      v_show.starts_at,
      v_show.ends_at
    )
    returning * into v_booking;
  exception
    when unique_violation then
      raise exception 'SEAT_TAKEN';
  end;

  return v_booking;
end;
$$;

-- hold_seats: hold multiple seats in a single all-or-nothing transaction.
-- Returns an array of the new booking rows.
create function public.hold_seats(
  p_show_id  uuid,
  p_seat_ids uuid[]
)
returns setof public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_hold_minutes      constant integer := 10;
  c_max_seats_per_user constant integer := 6;
  v_uid         uuid := (select auth.uid());
  v_show        public.shows;
  v_seat        public.seats;
  v_held_count  integer;
  v_booking     public.bookings;
  v_seat_id     uuid;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  if p_seat_ids is null or array_length(p_seat_ids, 1) is null then
    raise exception 'INVALID_REQUEST';
  end if;

  -- Validate show
  select * into v_show
  from public.shows sh
  where sh.id = p_show_id
    and sh.is_active
    and exists (select 1 from public.shops s where s.id = sh.shop_id and s.is_active);
  if not found then
    raise exception 'SHOW_NOT_FOUND';
  end if;

  -- Lazily expire overdue holds so inventory is released immediately
  update public.bookings
  set status = 'expired'
  where status = 'held'
    and hold_expires_at < now();

  -- Enforce per-user seat cap
  select count(*) into v_held_count
  from public.bookings b
  where b.customer_id = v_uid
    and b.seat_id in (
      select id from public.seats where show_id = p_show_id
    )
    and b.status in ('held', 'confirmed');
  if v_held_count + array_length(p_seat_ids, 1) > c_max_seats_per_user then
    raise exception 'SEAT_LIMIT_REACHED';
  end if;

  -- Hold each seat; any collision rolls back the entire transaction.
  foreach v_seat_id in array p_seat_ids loop
    select * into v_seat
    from public.seats se
    where se.id = v_seat_id
      and se.show_id = p_show_id
      and se.is_active;
    if not found then
      raise exception 'SEAT_NOT_FOUND';
    end if;

    begin
      insert into public.bookings (
        customer_id, shop_id, seat_id,
        price_paise, duration_minutes,
        status, hold_expires_at,
        starts_at, ends_at
      )
      values (
        v_uid,
        v_show.shop_id,
        v_seat_id,
        v_seat.price_paise,
        greatest(1, extract(epoch from (v_show.ends_at - v_show.starts_at))::integer / 60),
        'held',
        now() + make_interval(mins => c_hold_minutes),
        v_show.starts_at,
        v_show.ends_at
      )
      returning * into v_booking;
    exception
      when unique_violation then
        raise exception 'SEAT_TAKEN';
    end;

    return next v_booking;
  end loop;

  return;
end;
$$;

revoke all on function public.hold_seat(uuid, uuid) from public, anon;
revoke all on function public.hold_seats(uuid, uuid[]) from public, anon;

grant execute on function public.hold_seat(uuid, uuid) to authenticated;
grant execute on function public.hold_seats(uuid, uuid[]) to authenticated;
