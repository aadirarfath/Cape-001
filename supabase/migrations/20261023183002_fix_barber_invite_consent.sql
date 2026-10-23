-- Expose pending invites and a consent-gated accept function.

create or replace function public.my_barber_invites()
returns table (
  barber_id uuid,
  shop_id uuid,
  shop_name text,
  display_name text,
  invited_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    b.id as barber_id,
    b.shop_id,
    s.name as shop_name,
    b.display_name,
    bi.created_at as invited_at
  from private.barber_invites bi
  join public.barbers b on b.id = bi.barber_id
  join public.shops s on s.id = b.shop_id
  where bi.phone = (
    select phone from public.profiles where id = (select auth.uid())
  )
    and b.user_id is null;
$$;

create or replace function public.accept_barber_invite(p_barber_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_phone text;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  select phone into v_phone from public.profiles where id = v_uid;

  -- verify the invite exists for this phone
  if not exists (
    select 1 from private.barber_invites bi
    join public.barbers b on b.id = bi.barber_id
    where bi.barber_id = p_barber_id and bi.phone = v_phone and b.user_id is null
  ) then
    raise exception 'INVITE_NOT_FOUND';
  end if;

  update public.barbers set user_id = v_uid where id = p_barber_id and user_id is null;
  delete from private.barber_invites where barber_id = p_barber_id and phone = v_phone;
end;
$$;

create or replace function public.decline_barber_invite(p_barber_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_phone text;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  select phone into v_phone from public.profiles where id = v_uid;
  delete from private.barber_invites where barber_id = p_barber_id and phone = v_phone;
end;
$$;
