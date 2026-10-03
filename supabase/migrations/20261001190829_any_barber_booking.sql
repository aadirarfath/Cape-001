-- "Any available barber": combined free slots for a shop + service, and booking with whichever
-- barber is free. Both build on get_available_slots / book_appointment so the booking rules
-- (working hours, slot grid, time off, limits, double-booking guard) live in one place.

-- Every start time on a local (Asia/Kolkata) date at which at least one active barber of the
-- shop who offers the service is free. Public, like get_available_slots.
create function public.get_available_slots_any(p_shop_id uuid, p_service_id uuid, p_date date)
returns table (starts_at timestamptz, ends_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct s.starts_at, s.ends_at
  from public.barbers b
  join public.barber_services bs on bs.barber_id = b.id and bs.service_id = p_service_id
  cross join lateral public.get_available_slots(b.id, p_service_id, p_date) s
  where b.shop_id = p_shop_id
    and b.is_active
  order by s.starts_at;
$$;

-- Books p_starts_at with any barber of the shop who offers the service and is free then.
-- Barbers with the fewest active bookings that local day are tried first (then sort_order).
-- Errors that depend on the barber (taken, away, off-grid, outside hours) move on to the next
-- barber; anything else (not logged in, in the past, too far ahead, booking limit) is raised
-- straight away. If nobody is free the result is SLOT_TAKEN.
create function public.book_any_barber(
  p_shop_id uuid,
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
  v_tz constant text := private.app_time_zone();
  v_uid uuid := (select auth.uid());
  v_local_date date;
  v_barber_id uuid;
  v_any_candidate boolean := false;
  v_any_busy boolean := false;
  v_last_error text;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  if p_shop_id is null or p_service_id is null or p_starts_at is null then
    raise exception 'INVALID_REQUEST';
  end if;

  if not exists (select 1 from public.shops s where s.id = p_shop_id and s.is_active) then
    raise exception 'SHOP_UNAVAILABLE';
  end if;

  if not exists (
    select 1 from public.services sv
    where sv.id = p_service_id and sv.shop_id = p_shop_id and sv.is_active
  ) then
    raise exception 'INVALID_SERVICE';
  end if;

  v_local_date := (p_starts_at at time zone v_tz)::date;

  for v_barber_id in
    select b.id
    from public.barbers b
    join public.barber_services bs on bs.barber_id = b.id and bs.service_id = p_service_id
    where b.shop_id = p_shop_id
      and b.is_active
    order by
      (
        select count(*) from public.bookings bk
        where bk.barber_id = b.id
          and bk.status in ('pending', 'confirmed')
          and (bk.starts_at at time zone v_tz)::date = v_local_date
      ),
      b.sort_order,
      b.id
  loop
    v_any_candidate := true;
    begin
      return public.book_appointment(v_barber_id, p_service_id, p_starts_at, p_customer_notes);
    exception
      when raise_exception then
        if sqlerrm in ('SLOT_TAKEN', 'BARBER_UNAVAILABLE') then
          v_any_busy := true;
        elsif sqlerrm not in ('OUTSIDE_WORKING_HOURS', 'INVALID_TIME') then
          raise;
        end if;
        v_last_error := sqlerrm;
    end;
  end loop;

  if not v_any_candidate then
    raise exception 'SERVICE_NOT_OFFERED';
  end if;

  if v_any_busy then
    raise exception 'SLOT_TAKEN';
  end if;

  raise exception '%', v_last_error;
end;
$$;

revoke all on function public.get_available_slots_any(uuid, uuid, date) from public;
revoke all on function public.book_any_barber(uuid, uuid, timestamptz, text) from public, anon;

grant execute on function public.get_available_slots_any(uuid, uuid, date) to anon, authenticated;
grant execute on function public.book_any_barber(uuid, uuid, timestamptz, text) to authenticated;
