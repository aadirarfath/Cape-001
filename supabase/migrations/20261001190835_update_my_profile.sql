-- Profiles become read-only for clients: the only self-service edit is the display name,
-- through update_my_profile. Phone comes from auth and must not be editable by the customer.

drop policy "Users can update their own profile" on public.profiles;
revoke update on public.profiles from anon, authenticated;

create function public.update_my_profile(p_full_name text)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_name text := regexp_replace(btrim(coalesce(p_full_name, '')), '\s+', ' ', 'g');
  v_profile public.profiles;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  if char_length(v_name) not between 2 and 60 then
    raise exception 'INVALID_NAME';
  end if;

  update public.profiles p
  set full_name = v_name
  where p.id = v_uid
  returning * into v_profile;

  if not found then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  return v_profile;
end;
$$;

revoke all on function public.update_my_profile(text) from public, anon;
grant execute on function public.update_my_profile(text) to authenticated;
