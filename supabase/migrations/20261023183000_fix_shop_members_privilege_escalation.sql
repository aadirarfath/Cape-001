-- Security fix: remove direct insert/update grants on shop_members from authenticated role.
-- Membership is now only created via create_shop and claim_barber_invites (both SECURITY DEFINER).
-- Add a security definer function for owners to manage existing members (remove / change role).

revoke insert, update on public.shop_members from authenticated;

-- Hide user-id columns (created_by, approved_by) from shops to prevent id harvesting.
-- Revoke the blanket select, then re-grant all columns except those two.
revoke select on public.shops from anon, authenticated;

grant select (
  id, name, slug, description, phone,
  address_line, area, city, postal_code, location,
  is_active, cancellation_cutoff_minutes, slot_interval_minutes,
  max_days_ahead, approved_at, created_at, updated_at
) on public.shops to anon, authenticated;

-- Security definer function: owner removes a member or changes their role.
create or replace function public.update_shop_member(
  p_shop_id uuid,
  p_user_id uuid,
  p_role public.shop_role default null,
  p_remove boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if not private.has_shop_role(p_shop_id, '{owner}') then
    raise exception 'NOT_AUTHORIZED';
  end if;
  -- can't remove yourself (the owner)
  if p_user_id = v_uid then
    raise exception 'CANNOT_MODIFY_SELF';
  end if;

  if p_remove then
    delete from public.shop_members
    where shop_id = p_shop_id and user_id = p_user_id;
  elsif p_role is not null then
    update public.shop_members
    set role = p_role
    where shop_id = p_shop_id and user_id = p_user_id;
  end if;
end;
$$;
