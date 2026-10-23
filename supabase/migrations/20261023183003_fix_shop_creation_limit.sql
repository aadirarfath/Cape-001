-- Add a limit: one account may have at most 3 pending (unapproved) shops at a time.
create or replace function public.create_shop(
  p_name text,
  p_slug text,
  p_lng double precision,
  p_lat double precision,
  p_address_line text,
  p_area text default null,
  p_city text default 'Kochi',
  p_postal_code text default null,
  p_phone text default null,
  p_description text default null
)
returns public.shops
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_shop public.shops;
  v_pending_count integer;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  if p_lng is null or p_lat is null
     or p_lng not between -180 and 180
     or p_lat not between -90 and 90 then
    raise exception 'INVALID_LOCATION';
  end if;

  select count(*) into v_pending_count
  from public.shops s
  join public.shop_members sm on sm.shop_id = s.id and sm.user_id = v_uid and sm.role = 'owner'
  where s.is_active = false;

  if v_pending_count >= 3 then
    raise exception 'TOO_MANY_PENDING_SHOPS';
  end if;

  begin
    insert into public.shops (
      name, slug, description, phone, address_line, area, city, postal_code, location, created_by
    )
    values (
      p_name, p_slug, p_description, p_phone, p_address_line, p_area, p_city, p_postal_code,
      extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography,
      v_uid
    )
    returning * into v_shop;
  exception
    when unique_violation then
      raise exception 'SLUG_TAKEN';
  end;

  insert into public.shop_members (shop_id, user_id, role)
  values (v_shop.id, v_uid, 'owner');

  return v_shop;
end;
$$;
