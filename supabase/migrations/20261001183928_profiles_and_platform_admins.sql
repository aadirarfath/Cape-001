-- Profiles (one per auth user) and platform admins (who approve shops).

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text check (char_length(full_name) <= 120),
  phone text check (char_length(phone) <= 20),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- Create a profile automatically for every new auth user.
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (new.id, new.raw_user_meta_data ->> 'full_name', new.phone);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

alter table public.profiles enable row level security;

-- Profiles are only created by the trigger; users may edit a few columns of their own row.
revoke insert, update, delete, truncate on public.profiles from anon, authenticated;
grant update (full_name, phone, avatar_url) on public.profiles to authenticated;

create policy "Users can read their own profile"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Further profile read policies (shop staff, customers) are added in later migrations.

-- Platform admins. Rows are managed by the platform team with the service role; clients
-- can only check whether they themselves are an admin.
create table public.platform_admins (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;

revoke all on public.platform_admins from anon, authenticated;
grant select on public.platform_admins to authenticated;

create policy "Admins can see their own admin row"
  on public.platform_admins for select
  to authenticated
  using (user_id = (select auth.uid()));

create function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.platform_admins a where a.user_id = (select auth.uid())
  );
$$;

revoke all on function private.is_platform_admin() from public;
grant execute on function private.is_platform_admin() to anon, authenticated;
