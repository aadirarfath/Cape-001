-- DPDP Act: Customer Account Deletion & Anonymisation
--
-- Customers may request account deletion. Under data protection regulations (DPDP Act),
-- their personally identifiable information (PII) must be removed.
-- However, historical bookings must be preserved for shops' accounting, tax, and auditing
-- records (bookings.customer_id has ON DELETE RESTRICT).
--
-- The delete_my_account() function:
-- 1. Checks that the user is authenticated.
-- 2. Prevents deleting an account if the user is the owner of a shop (must delete or transfer shop first).
-- 3. Cancels any upcoming active bookings ('pending' or 'confirmed') with a clear reason.
-- 4. Removes user push tokens.
-- 5. Removes shop memberships if the user is a non-owner member (barber/manager).
-- 6. Anonymises the profile: clears full_name ('Deleted Account'), phone (null), and avatar_url (null).
-- 7. Deletes auth user personal data in auth.users and bans the user from signing in.
-- 8. Invalidates any active auth sessions/refresh tokens.

create or replace function public.delete_my_account()
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

  -- Shop owners must transfer ownership or delete the shop first
  if exists (
    select 1 from public.shop_members
    where user_id = v_uid and role = 'owner'
  ) then
    raise exception 'CANNOT_DELETE_SHOP_OWNER';
  end if;

  -- Cancel future bookings
  update public.bookings
  set status = 'cancelled',
      cancelled_at = now(),
      cancelled_by = v_uid,
      cancellation_reason = 'Account deleted by customer'
  where customer_id = v_uid
    and starts_at > now()
    and status in ('pending', 'confirmed');

  -- Delete push tokens
  delete from public.push_tokens where user_id = v_uid;

  -- If the user was linked to a barber profile, unlink them
  update public.barbers set user_id = null where user_id = v_uid;

  -- Remove from any non-owner shop memberships
  delete from public.shop_members where user_id = v_uid;

  -- Anonymise profile (clear name, phone, avatar)
  update public.profiles
  set full_name = 'Deleted Account',
      phone = null,
      avatar_url = null,
      updated_at = now()
  where id = v_uid;

  -- Clear personal data in auth.users and ban login
  update auth.users
  set phone = null,
      phone_change = null,
      email = null,
      email_change = null,
      raw_user_meta_data = '{}'::jsonb,
      raw_app_meta_data = '{}'::jsonb,
      banned_until = 'infinity'
  where id = v_uid;

  -- Invalidate active sessions
  begin
    delete from auth.refresh_tokens
    where session_id in (select id from auth.sessions where user_id = v_uid);
    delete from auth.sessions where user_id = v_uid;
  exception when undefined_table then
    null;
  end;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
