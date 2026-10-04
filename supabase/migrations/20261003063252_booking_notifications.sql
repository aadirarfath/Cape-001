-- Push notifications for new and cancelled bookings.
--
-- After a booking is inserted, or its status changes to 'cancelled', a trigger queues an HTTP
-- POST to the notify-booking Edge Function with pg_net. pg_net sends queued requests only after
-- the transaction commits, so rolled-back bookings never notify anyone.
--
-- The function URL and a shared secret are read from Vault (names below). If either is missing
-- the trigger does nothing, so environments without notifications keep working. Set them once
-- per environment (supabase/seed.sql does it for local development):
--   select vault.create_secret('<functions url>/notify-booking', 'notify_booking_url');
--   select vault.create_secret('<random secret>', 'notify_booking_secret');
-- The Edge Function must be given the same secret as NOTIFY_BOOKING_SECRET.

create extension if not exists pg_net with schema extensions;

create function private.queue_booking_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  select s.decrypted_secret into v_url
  from vault.decrypted_secrets s where s.name = 'notify_booking_url';

  select s.decrypted_secret into v_secret
  from vault.decrypted_secrets s where s.name = 'notify_booking_secret';

  if v_url is null or v_url = '' or v_secret is null or v_secret = '' then
    return null;
  end if;

  -- Only the id and event travel; the function reloads the booking with the service role.
  perform net.http_post(
    url := v_url,
    body := jsonb_build_object(
      'event', case when tg_op = 'INSERT' then 'created' else 'cancelled' end,
      'booking_id', new.id
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Webhook-Secret', v_secret
    ),
    timeout_milliseconds := 5000
  );

  return null;
end;
$$;

revoke all on function private.queue_booking_notification() from public;

create trigger bookings_notify_created
  after insert on public.bookings
  for each row execute function private.queue_booking_notification();

create trigger bookings_notify_cancelled
  after update of status on public.bookings
  for each row
  when (new.status = 'cancelled' and old.status is distinct from new.status)
  execute function private.queue_booking_notification();

-- Who to notify about a booking: the shop's owners and managers and the booked barber's linked
-- account (if still a member), each with all of their push tokens. The person who caused the
-- event is left out: the customer for a new booking, cancelled_by for a cancellation.
-- Service role only (the Edge Function).
create function public.booking_notification_tokens(p_booking_id uuid)
returns table (user_id uuid, token text)
language sql
stable
security invoker
set search_path = ''
as $$
  select distinct t.user_id, t.token
  from public.bookings bk
  cross join lateral (
    select m.user_id
    from public.shop_members m
    where m.shop_id = bk.shop_id
      and m.role in ('owner', 'manager')
    union
    select b.user_id
    from public.barbers b
    join public.shop_members m on m.shop_id = b.shop_id and m.user_id = b.user_id
    where b.id = bk.barber_id
  ) r
  join public.push_tokens t on t.user_id = r.user_id
  where bk.id = p_booking_id
    and r.user_id is distinct from (
      case when bk.status = 'cancelled' then bk.cancelled_by else bk.customer_id end
    );
$$;

revoke all on function public.booking_notification_tokens(uuid) from public, anon, authenticated;
grant execute on function public.booking_notification_tokens(uuid) to service_role;
