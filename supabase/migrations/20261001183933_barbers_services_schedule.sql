-- Barbers, services, which barber offers which service, weekly working hours and time off.
--
-- Child tables carry shop_id and use composite foreign keys, so a row can never point at a
-- barber or service from a different shop. shop_id is also what the RLS policies check.

create table public.barbers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  -- Optional login. Owners can add barbers who never sign in and link an account later.
  user_id uuid references public.profiles (id) on delete set null,
  display_name text not null check (char_length(display_name) between 1 and 80),
  bio text check (char_length(bio) <= 500),
  avatar_url text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, shop_id),
  unique (shop_id, user_id)
);

create index barbers_shop_id_idx on public.barbers (shop_id);
create index barbers_user_id_idx on public.barbers (user_id) where user_id is not null;

create trigger barbers_set_updated_at
  before update on public.barbers
  for each row execute function private.set_updated_at();

create table public.services (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  description text check (char_length(description) <= 500),
  duration_minutes integer not null check (duration_minutes between 5 and 480),
  price_paise integer not null check (price_paise >= 0),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, shop_id)
);

create index services_shop_id_idx on public.services (shop_id);

create trigger services_set_updated_at
  before update on public.services
  for each row execute function private.set_updated_at();

create table public.barber_services (
  barber_id uuid not null,
  service_id uuid not null,
  shop_id uuid not null,
  primary key (barber_id, service_id),
  foreign key (barber_id, shop_id) references public.barbers (id, shop_id) on delete cascade,
  foreign key (service_id, shop_id) references public.services (id, shop_id) on delete cascade
);

create index barber_services_service_id_idx on public.barber_services (service_id);
create index barber_services_shop_id_idx on public.barber_services (shop_id);

-- Weekly schedule in the shop's local wall-clock time (Asia/Kolkata). `time` is deliberate:
-- these are times of day, not instants. Several rows per day allow split shifts / breaks.
create table public.working_hours (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid not null,
  shop_id uuid not null,
  weekday smallint not null check (weekday between 0 and 6), -- 0 = Sunday, as extract(dow)
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  check (end_time > start_time),
  foreign key (barber_id, shop_id) references public.barbers (id, shop_id) on delete cascade,
  constraint working_hours_no_overlap exclude using gist (
    barber_id with =,
    weekday with =,
    private.time_range(start_time, end_time) with &&
  )
);

create index working_hours_shop_id_idx on public.working_hours (shop_id);

create table public.time_off (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid not null,
  shop_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text check (char_length(reason) <= 200),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  foreign key (barber_id, shop_id) references public.barbers (id, shop_id) on delete cascade
);

create index time_off_barber_id_ends_at_idx on public.time_off (barber_id, ends_at);
create index time_off_shop_id_idx on public.time_off (shop_id);

-- True when the current user is the linked account of this barber and still a member of the
-- barber's shop.
create function private.is_linked_barber(p_barber_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.barbers b
    join public.shop_members m on m.shop_id = b.shop_id and m.user_id = b.user_id
    where b.id = p_barber_id
      and b.user_id = (select auth.uid())
  );
$$;

revoke all on function private.is_linked_barber(uuid) from public;
grant execute on function private.is_linked_barber(uuid) to anon, authenticated;

-- RLS -----------------------------------------------------------------------------------
-- Catalogue tables (barbers, services, barber_services, working_hours) are public for
-- active shops so the website can browse them; members always see their own shop.
-- Only owners and managers write them.

alter table public.barbers enable row level security;
alter table public.services enable row level security;
alter table public.barber_services enable row level security;
alter table public.working_hours enable row level security;
alter table public.time_off enable row level security;

revoke insert, update, delete, truncate on
  public.barbers, public.services, public.barber_services, public.working_hours
  from anon;
revoke truncate on
  public.barbers, public.services, public.barber_services, public.working_hours
  from authenticated;
revoke all on public.time_off from anon;
revoke truncate on public.time_off from authenticated;

-- barbers
create policy "Active barbers of active shops are public; members see their shop"
  on public.barbers for select
  to anon, authenticated
  using (
    (is_active and exists (select 1 from public.shops s where s.id = shop_id and s.is_active))
    or private.is_shop_member(shop_id)
  );

create policy "Owners and managers can add barbers"
  on public.barbers for insert
  to authenticated
  with check (private.has_shop_role(shop_id, '{owner,manager}'));

create policy "Owners and managers can update barbers"
  on public.barbers for update
  to authenticated
  using (private.has_shop_role(shop_id, '{owner,manager}'))
  with check (private.has_shop_role(shop_id, '{owner,manager}'));

create policy "Owners and managers can delete barbers"
  on public.barbers for delete
  to authenticated
  using (private.has_shop_role(shop_id, '{owner,manager}'));

-- services
create policy "Active services of active shops are public; members see their shop"
  on public.services for select
  to anon, authenticated
  using (
    (is_active and exists (select 1 from public.shops s where s.id = shop_id and s.is_active))
    or private.is_shop_member(shop_id)
  );

create policy "Owners and managers can add services"
  on public.services for insert
  to authenticated
  with check (private.has_shop_role(shop_id, '{owner,manager}'));

create policy "Owners and managers can update services"
  on public.services for update
  to authenticated
  using (private.has_shop_role(shop_id, '{owner,manager}'))
  with check (private.has_shop_role(shop_id, '{owner,manager}'));

create policy "Owners and managers can delete services"
  on public.services for delete
  to authenticated
  using (private.has_shop_role(shop_id, '{owner,manager}'));

-- barber_services
create policy "Barber services of active shops are public; members see their shop"
  on public.barber_services for select
  to anon, authenticated
  using (
    exists (select 1 from public.shops s where s.id = shop_id and s.is_active)
    or private.is_shop_member(shop_id)
  );

create policy "Owners and managers can add barber services"
  on public.barber_services for insert
  to authenticated
  with check (private.has_shop_role(shop_id, '{owner,manager}'));

create policy "Owners and managers can update barber services"
  on public.barber_services for update
  to authenticated
  using (private.has_shop_role(shop_id, '{owner,manager}'))
  with check (private.has_shop_role(shop_id, '{owner,manager}'));

create policy "Owners and managers can delete barber services"
  on public.barber_services for delete
  to authenticated
  using (private.has_shop_role(shop_id, '{owner,manager}'));

-- working_hours
create policy "Working hours of active shops are public; members see their shop"
  on public.working_hours for select
  to anon, authenticated
  using (
    exists (select 1 from public.shops s where s.id = shop_id and s.is_active)
    or private.is_shop_member(shop_id)
  );

create policy "Owners and managers can add working hours"
  on public.working_hours for insert
  to authenticated
  with check (private.has_shop_role(shop_id, '{owner,manager}'));

create policy "Owners and managers can update working hours"
  on public.working_hours for update
  to authenticated
  using (private.has_shop_role(shop_id, '{owner,manager}'))
  with check (private.has_shop_role(shop_id, '{owner,manager}'));

create policy "Owners and managers can delete working hours"
  on public.working_hours for delete
  to authenticated
  using (private.has_shop_role(shop_id, '{owner,manager}'));

-- time_off: private to the shop. Owners/managers manage everyone's; a barber manages only
-- their own. Customers never read it directly; get_available_slots accounts for it.
create policy "Owners, managers and the barber can see time off"
  on public.time_off for select
  to authenticated
  using (
    private.has_shop_role(shop_id, '{owner,manager}')
    or private.is_linked_barber(barber_id)
  );

create policy "Owners, managers and the barber can add time off"
  on public.time_off for insert
  to authenticated
  with check (
    private.has_shop_role(shop_id, '{owner,manager}')
    or private.is_linked_barber(barber_id)
  );

create policy "Owners, managers and the barber can update time off"
  on public.time_off for update
  to authenticated
  using (
    private.has_shop_role(shop_id, '{owner,manager}')
    or private.is_linked_barber(barber_id)
  )
  with check (
    private.has_shop_role(shop_id, '{owner,manager}')
    or private.is_linked_barber(barber_id)
  );

create policy "Owners, managers and the barber can delete time off"
  on public.time_off for delete
  to authenticated
  using (
    private.has_shop_role(shop_id, '{owner,manager}')
    or private.is_linked_barber(barber_id)
  );
