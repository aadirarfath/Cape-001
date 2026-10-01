-- Shops, shop membership (owner / manager / barber), role helpers and the shop lifecycle:
-- self-serve creation via create_shop (inactive), approval by a platform admin.

create table public.shops (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 100),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 60),
  description text check (char_length(description) <= 1000),
  phone text check (char_length(phone) <= 20),
  address_line text not null check (char_length(address_line) between 3 and 200),
  area text check (char_length(area) <= 100),
  city text not null default 'Kochi' check (char_length(city) between 2 and 100),
  state text not null default 'Kerala',
  postal_code text check (postal_code ~ '^[1-9][0-9]{5}$'),
  location extensions.geography(point, 4326) not null,
  -- Booking settings
  slot_interval_minutes integer not null default 15 check (slot_interval_minutes between 5 and 120),
  max_days_ahead integer not null default 30 check (max_days_ahead between 1 and 365),
  cancellation_cutoff_minutes integer not null default 30 check (cancellation_cutoff_minutes between 0 and 10080),
  -- Lifecycle: new shops are inactive until a platform admin approves them.
  is_active boolean not null default false,
  approved_at timestamptz,
  approved_by uuid references public.profiles (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index shops_location_idx on public.shops using gist (location);
create index shops_active_idx on public.shops (is_active) where is_active;

create trigger shops_set_updated_at
  before update on public.shops
  for each row execute function private.set_updated_at();

create table public.shop_members (
  shop_id uuid not null references public.shops (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.shop_role not null,
  created_at timestamptz not null default now(),
  primary key (shop_id, user_id)
);

create index shop_members_user_id_idx on public.shop_members (user_id);

-- Role helpers. SECURITY DEFINER so policies on shop_members (and everything else) can call
-- them without recursing through shop_members' own RLS.
create function private.has_shop_role(p_shop_id uuid, p_roles public.shop_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.shop_members m
    where m.shop_id = p_shop_id
      and m.user_id = (select auth.uid())
      and m.role = any (p_roles)
  );
$$;

create function private.is_shop_member(p_shop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_shop_role(p_shop_id, enum_range(null::public.shop_role));
$$;

revoke all on function private.has_shop_role(uuid, public.shop_role[]) from public;
revoke all on function private.is_shop_member(uuid) from public;
grant execute on function private.has_shop_role(uuid, public.shop_role[]) to anon, authenticated;
grant execute on function private.is_shop_member(uuid) to anon, authenticated;

-- A shop must always keep at least one owner. Cascading deletes of the whole shop are allowed.
create function private.prevent_last_owner_removal()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.role = 'owner'
     and (tg_op = 'DELETE' or new.role <> 'owner' or new.shop_id <> old.shop_id)
     and exists (select 1 from public.shops s where s.id = old.shop_id)
     and not exists (
       select 1 from public.shop_members m
       where m.shop_id = old.shop_id and m.role = 'owner' and m.user_id <> old.user_id
     )
  then
    raise exception 'LAST_OWNER' using detail = 'A shop must keep at least one owner.';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger shop_members_keep_an_owner
  before update or delete on public.shop_members
  for each row execute function private.prevent_last_owner_removal();

-- RLS: shops ---------------------------------------------------------------------------

alter table public.shops enable row level security;

-- Shops are created only through create_shop and never deleted by clients.
-- Owners/managers may edit details and booking settings, but not the approval columns.
revoke insert, update, delete, truncate on public.shops from anon, authenticated;
grant update (
  name, description, phone, address_line, area, city, state, postal_code, location,
  slot_interval_minutes, max_days_ahead, cancellation_cutoff_minutes
) on public.shops to authenticated;

create policy "Active shops are public; members and admins see their shops"
  on public.shops for select
  to anon, authenticated
  using (
    is_active
    or private.is_shop_member(id)
    or private.is_platform_admin()
  );

create policy "Owners and managers can update their shop"
  on public.shops for update
  to authenticated
  using (private.has_shop_role(id, '{owner,manager}'))
  with check (private.has_shop_role(id, '{owner,manager}'));

-- RLS: shop_members --------------------------------------------------------------------

alter table public.shop_members enable row level security;

revoke all on public.shop_members from anon;
revoke truncate on public.shop_members from authenticated;

create policy "Members see their shop's members; users see their own memberships"
  on public.shop_members for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or private.is_shop_member(shop_id)
    or private.is_platform_admin()
  );

create policy "Owners can add members"
  on public.shop_members for insert
  to authenticated
  with check (private.has_shop_role(shop_id, '{owner}'));

create policy "Owners can change member roles"
  on public.shop_members for update
  to authenticated
  using (private.has_shop_role(shop_id, '{owner}'))
  with check (private.has_shop_role(shop_id, '{owner}'));

create policy "Owners can remove members"
  on public.shop_members for delete
  to authenticated
  using (private.has_shop_role(shop_id, '{owner}'));

-- Members of the same shop can see each other's profiles (names, phone numbers).
create policy "Shop members can read co-member profiles"
  on public.profiles for select
  to authenticated
  using (
    exists (
      select 1 from public.shop_members m
      where m.user_id = profiles.id
        and private.is_shop_member(m.shop_id)
    )
  );

-- Shop lifecycle functions --------------------------------------------------------------

create function public.create_shop(
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
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  if p_lng is null or p_lat is null
     or p_lng not between -180 and 180
     or p_lat not between -90 and 90 then
    raise exception 'INVALID_LOCATION';
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

create function public.approve_shop(p_shop_id uuid)
returns public.shops
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shop public.shops;
begin
  if not private.is_platform_admin() then
    raise exception 'NOT_AUTHORIZED';
  end if;

  update public.shops
  set is_active = true,
      approved_at = coalesce(approved_at, now()),
      approved_by = coalesce(approved_by, (select auth.uid()))
  where id = p_shop_id
  returning * into v_shop;

  if not found then
    raise exception 'SHOP_NOT_FOUND';
  end if;

  return v_shop;
end;
$$;

create function public.suspend_shop(p_shop_id uuid)
returns public.shops
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shop public.shops;
begin
  if not private.is_platform_admin() then
    raise exception 'NOT_AUTHORIZED';
  end if;

  update public.shops
  set is_active = false
  where id = p_shop_id
  returning * into v_shop;

  if not found then
    raise exception 'SHOP_NOT_FOUND';
  end if;

  return v_shop;
end;
$$;

revoke all on function public.create_shop(text, text, double precision, double precision, text, text, text, text, text, text) from public, anon;
revoke all on function public.approve_shop(uuid) from public, anon;
revoke all on function public.suspend_shop(uuid) from public, anon;
grant execute on function public.create_shop(text, text, double precision, double precision, text, text, text, text, text, text) to authenticated;
grant execute on function public.approve_shop(uuid) to authenticated;
grant execute on function public.suspend_shop(uuid) to authenticated;
