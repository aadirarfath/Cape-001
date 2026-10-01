-- Extensions, the private helper schema, shared enums and shared trigger functions.

create extension if not exists postgis with schema extensions;
create extension if not exists btree_gist with schema extensions;

-- Internal helpers live in `private`, which is not exposed through the Data API.
-- Clients need USAGE so that RLS policies can call the helper functions.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

create type public.shop_role as enum ('owner', 'manager', 'barber');

-- 'pending' is reserved for bookings awaiting online payment (Razorpay, later phase).
create type public.booking_status as enum ('pending', 'confirmed', 'completed', 'cancelled', 'no_show');

create type public.payment_status as enum ('created', 'authorized', 'captured', 'failed', 'refunded');

-- All local wall-clock maths (working hours, slot dates) happens in India Standard Time.
create function private.app_time_zone()
returns text
language sql
immutable
set search_path = ''
as $$ select 'Asia/Kolkata' $$;

-- Wall-clock time range, used to stop a barber's working-hours rows from overlapping.
create type private.time_range as range (subtype = time);

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
