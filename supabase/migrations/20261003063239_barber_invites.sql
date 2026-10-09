-- Barber invites by phone number.
--
-- An owner attaches a phone number to a barber (invite_barber). When the person with that phone
-- logs in to the partner app, claim_barber_invites links them: barbers.user_id is set and they
-- become a 'barber' member of the shop. The phone is taken from auth.users, i.e. verified by OTP
-- (supabase/config.toml keeps [auth.sms] enable_confirmations on so it can't be self-asserted).
--
-- Invites live in their own table rather than on barbers, because barbers rows are public.
--
-- barbers.user_id is also no longer writable by clients: before this migration an owner or
-- manager could point a barber row at any user.

create table public.barber_invites (
  barber_id uuid primary key,
  shop_id uuid not null,
  -- E.164 Indian mobile, as produced by indianMobileSchema in @cape001/core.
  phone text not null check (phone ~ '^\+91[6-9][0-9]{9}$'),
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (barber_id, shop_id) references public.barbers (id, shop_id) on delete cascade,
  -- One open invite per phone per shop.
  unique (shop_id, phone)
);

create index barber_invites_phone_idx on public.barber_invites (phone);

alter table public.barber_invites enable row level security;

-- Read-only for clients; written by invite_barber and claim_barber_invites.
revoke all on public.barber_invites from anon;
revoke insert, update, delete, truncate on public.barber_invites from authenticated;

create policy "Owners and managers can see their shop's barber invites"
  on public.barber_invites for select
  to authenticated
  using (private.has_shop_role(shop_id, '{owner,manager}'));

-- barbers: user_id is set only by the database (and id / shop_id never change on update).
revoke insert, update on public.barbers from authenticated;
grant insert (id, shop_id, display_name, bio, avatar_url, is_active, sort_order)
  on public.barbers to authenticated;
grant update (display_name, bio, avatar_url, is_active, sort_order)
  on public.barbers to authenticated;

-- The verified phone of the current user in E.164 ('+919847012345'), or null.
-- auth.users stores phones without the '+'.
create function private.current_user_verified_phone()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select '+' || u.phone
  from auth.users u
  where u.id = (select auth.uid())
    and u.phone is not null
    and u.phone <> ''
    and u.phone_confirmed_at is not null;
$$;

revoke all on function private.current_user_verified_phone() from public;

-- Invite an unlinked barber by phone, replace their invite, or (p_phone null) withdraw it.
-- Owners only.
create function public.invite_barber(p_barber_id uuid, p_phone text)
returns public.barber_invites
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_barber public.barbers;
  v_invite public.barber_invites;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select * into v_barber from public.barbers b where b.id = p_barber_id for update;
  if not found then
    raise exception 'INVALID_BARBER';
  end if;

  if not private.has_shop_role(v_barber.shop_id, '{owner}') then
    raise exception 'NOT_AUTHORIZED';
  end if;

  if v_barber.user_id is not null then
    raise exception 'BARBER_ALREADY_LINKED';
  end if;

  if p_phone is null then
    delete from public.barber_invites i where i.barber_id = v_barber.id;
    return null;
  end if;

  if p_phone !~ '^\+91[6-9][0-9]{9}$' then
    raise exception 'INVALID_PHONE';
  end if;

  -- Already invited for another barber of this shop, or already linked to one.
  if exists (
    select 1 from public.barber_invites i
    where i.shop_id = v_barber.shop_id
      and i.phone = p_phone
      and i.barber_id <> v_barber.id
  ) or exists (
    select 1 from public.barbers b
    join auth.users u on u.id = b.user_id
    where b.shop_id = v_barber.shop_id
      and '+' || u.phone = p_phone
  ) then
    raise exception 'PHONE_ALREADY_INVITED';
  end if;

  insert into public.barber_invites (barber_id, shop_id, phone, invited_by)
  values (v_barber.id, v_barber.shop_id, p_phone, v_uid)
  on conflict (barber_id) do update
    set phone = excluded.phone,
        invited_by = excluded.invited_by,
        created_at = now()
  returning * into v_invite;

  return v_invite;
end;
$$;

-- Link every open invite for the current user's verified phone. The partner app calls this after
-- login; it is safe to call repeatedly. Returns the barbers rows linked by this call.
-- If the user is already a member of the shop (e.g. its owner), their existing role is kept.
create function public.claim_barber_invites()
returns setof public.barbers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_phone text;
  v_barber_id uuid;
  v_barber public.barbers;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  v_phone := private.current_user_verified_phone();
  if v_phone is null then
    return;
  end if;

  for v_barber_id in
    select i.barber_id
    from public.barber_invites i
    join public.barbers b on b.id = i.barber_id
    where i.phone = v_phone
      and b.user_id is null
      -- A shop can't have two barber rows for one person.
      and not exists (
        select 1 from public.barbers o where o.shop_id = i.shop_id and o.user_id = v_uid
      )
    order by i.created_at
    for update of b
  loop
    update public.barbers b
    set user_id = v_uid
    where b.id = v_barber_id
    returning * into v_barber;

    delete from public.barber_invites i where i.barber_id = v_barber_id;

    insert into public.shop_members (shop_id, user_id, role)
    values (v_barber.shop_id, v_uid, 'barber')
    on conflict (shop_id, user_id) do nothing;

    return next v_barber;
  end loop;
end;
$$;

revoke all on function public.invite_barber(uuid, text) from public, anon;
revoke all on function public.claim_barber_invites() from public, anon;
grant execute on function public.invite_barber(uuid, text) to authenticated;
grant execute on function public.claim_barber_invites() to authenticated;
