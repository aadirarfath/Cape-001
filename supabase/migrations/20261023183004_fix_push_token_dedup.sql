-- When a token is registered by user A, remove it from any other user's account first.
-- This ensures one device maps to one user's notifications.
create or replace function public.register_push_token(p_token text)
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

  -- Remove from other users first (device changed hands)
  delete from public.push_tokens where token = p_token and user_id <> v_uid;

  -- Upsert for this user
  insert into public.push_tokens (user_id, token)
  values (v_uid, p_token)
  on conflict (user_id, token) do update set updated_at = now();
end;
$$;
