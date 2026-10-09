-- Stream booking inserts and updates to the partner app through Supabase Realtime.
-- Realtime checks each change against the bookings select policy as the subscriber, so owners
-- and managers receive their shop's bookings and barbers only their own.
alter publication supabase_realtime add table public.bookings;
