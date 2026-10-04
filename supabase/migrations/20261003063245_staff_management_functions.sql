-- Functions for the partner app:
--   my_shops            the current user's shops, role, own barber row and shop coordinates
--   set_shop_location   move a shop's map pin (owners/managers)
--   set_barber_services replace the services a barber offers (owners/managers)
--   set_working_hours   replace a barber's weekly hours (owners/managers)
-- The two "set_" replace functions run in one transaction, so a failed save never leaves a
-- barber with half of their old hours or services.

-- Shops the current user belongs to. lng/lat are returned as numbers so the app never has to
-- decode PostGIS values. barber_id is the user's own barbers row in that shop, if linked.
create function public.my_shops()
returns table (
  shop_id uuid,
  role public.shop_role,
  barber_id uuid,
  lng double precision,
  lat double precision
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    m.shop_id,
    m.role,
    b.id,
    extensions.st_x(s.location::extensions.geometry),
    extensions.st_y(s.location::extensions.geometry)
  from public.shop_members m
  join public.shops s on s.id = m.shop_id
  left join public.barbers b on b.shop_id = m.shop_id and b.user_id = m.user_id
  where m.user_id = (select auth.uid())
  order by m.created_at, m.shop_id;
$$;

-- Runs as the caller, so the shops update policy and column grants apply.
create function public.set_shop_location(p_shop_id uuid, p_lng double precision, p_lat double precision)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  if p_lng is null or p_lat is null
     or p_lng not between -180 and 180
     or p_lat not between -90 and 90 then
    raise exception 'INVALID_LOCATION';
  end if;

  update public.shops s
  set location = extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography
  where s.id = p_shop_id;

  if not found then
    raise exception 'NOT_AUTHORIZED';
  end if;
end;
$$;

-- Loads a barber and checks the caller is an owner or manager of the barber's shop.
create function private.barber_for_staff_edit(p_barber_id uuid)
returns public.barbers
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_barber public.barbers;
begin
  if (select auth.uid()) is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select * into v_barber from public.barbers b where b.id = p_barber_id;
  if not found then
    raise exception 'INVALID_BARBER';
  end if;

  if not private.has_shop_role(v_barber.shop_id, '{owner,manager}') then
    raise exception 'NOT_AUTHORIZED';
  end if;

  return v_barber;
end;
$$;

revoke all on function private.barber_for_staff_edit(uuid) from public;

create function public.set_barber_services(p_barber_id uuid, p_service_ids uuid[])
returns setof public.barber_services
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_barber public.barbers := private.barber_for_staff_edit(p_barber_id);
  v_ids uuid[] := coalesce(p_service_ids, '{}');
begin
  if exists (
    select 1 from unnest(v_ids) as x(id)
    where not exists (
      select 1 from public.services sv where sv.id = x.id and sv.shop_id = v_barber.shop_id
    )
  ) then
    raise exception 'INVALID_SERVICE';
  end if;

  delete from public.barber_services bs
  where bs.barber_id = v_barber.id
    and bs.service_id <> all (v_ids);

  insert into public.barber_services (barber_id, service_id, shop_id)
  select v_barber.id, x.id, v_barber.shop_id
  from (select distinct unnest(v_ids) as id) x
  on conflict (barber_id, service_id) do nothing;

  return query
    select * from public.barber_services bs where bs.barber_id = v_barber.id;
end;
$$;

-- p_hours: a JSON array of {"weekday": 0-6 (0 = Sunday), "start_time": "09:30", "end_time": "13:30"}
-- in Asia/Kolkata wall-clock time. Several entries per day allow split shifts. An empty array
-- means the barber has no working hours.
create function public.set_working_hours(p_barber_id uuid, p_hours jsonb)
returns setof public.working_hours
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_barber public.barbers := private.barber_for_staff_edit(p_barber_id);
begin
  if p_hours is null or jsonb_typeof(p_hours) <> 'array' then
    raise exception 'INVALID_WORKING_HOURS';
  end if;

  begin
    delete from public.working_hours wh where wh.barber_id = v_barber.id;

    insert into public.working_hours (barber_id, shop_id, weekday, start_time, end_time)
    select v_barber.id, v_barber.shop_id, x.weekday, x.start_time, x.end_time
    from jsonb_to_recordset(p_hours) as x(weekday smallint, start_time time, end_time time);
  exception
    when check_violation          -- weekday out of range, end before start
      or exclusion_violation      -- overlapping shifts on one day
      or not_null_violation       -- missing field
      or invalid_text_representation
      or invalid_datetime_format
      or datetime_field_overflow
      or numeric_value_out_of_range
      or invalid_parameter_value  -- an element that isn't an object
    then
      raise exception 'INVALID_WORKING_HOURS';
  end;

  return query
    select * from public.working_hours wh
    where wh.barber_id = v_barber.id
    order by wh.weekday, wh.start_time;
end;
$$;

revoke all on function public.my_shops() from public, anon;
revoke all on function public.set_shop_location(uuid, double precision, double precision) from public, anon;
revoke all on function public.set_barber_services(uuid, uuid[]) from public, anon;
revoke all on function public.set_working_hours(uuid, jsonb) from public, anon;
grant execute on function public.my_shops() to authenticated;
grant execute on function public.set_shop_location(uuid, double precision, double precision) to authenticated;
grant execute on function public.set_barber_services(uuid, uuid[]) to authenticated;
grant execute on function public.set_working_hours(uuid, jsonb) to authenticated;
