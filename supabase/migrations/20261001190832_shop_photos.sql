-- Shop photos: a public storage bucket for the image files and a table that orders them.
--
-- Files live at shop-photos/{shop_id}/{file}. The storage write policies read the shop id from
-- that first path segment, so only owners and managers of that shop can add, replace or remove
-- its photos. The partner app uploads; the website only reads.

-- Storage ---------------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'shop-photos', 'shop-photos', true, 5242880, -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp']
);

-- The shop id from a "{shop_id}/..." object path, or null if the first segment isn't a uuid.
create function private.shop_id_from_path(p_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when split_part(p_name, '/', 1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      and split_part(p_name, '/', 2) <> ''
    then split_part(p_name, '/', 1)::uuid
  end;
$$;

revoke all on function private.shop_id_from_path(text) from public;
grant execute on function private.shop_id_from_path(text) to anon, authenticated;

-- The bucket is public, so photos are served by URL without a select policy. This one only
-- lets staff list and upsert their own shop's files.
create policy "Owners and managers can list their shop photos"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'shop-photos'
    and private.has_shop_role(private.shop_id_from_path(name), '{owner,manager}')
  );

create policy "Owners and managers can upload their shop photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'shop-photos'
    and private.has_shop_role(private.shop_id_from_path(name), '{owner,manager}')
  );

create policy "Owners and managers can replace their shop photos"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'shop-photos'
    and private.has_shop_role(private.shop_id_from_path(name), '{owner,manager}')
  )
  with check (
    bucket_id = 'shop-photos'
    and private.has_shop_role(private.shop_id_from_path(name), '{owner,manager}')
  );

create policy "Owners and managers can delete their shop photos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'shop-photos'
    and private.has_shop_role(private.shop_id_from_path(name), '{owner,manager}')
  );

-- Table -----------------------------------------------------------------------------------

create table public.shop_photos (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  -- Object name inside the shop-photos bucket; must sit under the shop's own folder.
  storage_path text not null unique
    check (char_length(storage_path) <= 300 and private.shop_id_from_path(storage_path) = shop_id),
  alt_text text check (char_length(alt_text) <= 200),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index shop_photos_shop_id_sort_idx on public.shop_photos (shop_id, sort_order);

alter table public.shop_photos enable row level security;

revoke insert, update, delete, truncate on public.shop_photos from anon;
revoke truncate on public.shop_photos from authenticated;

create policy "Photos of active shops are public; members see their shop"
  on public.shop_photos for select
  to anon, authenticated
  using (
    exists (select 1 from public.shops s where s.id = shop_id and s.is_active)
    or private.is_shop_member(shop_id)
  );

create policy "Owners and managers can add photos"
  on public.shop_photos for insert
  to authenticated
  with check (private.has_shop_role(shop_id, '{owner,manager}'));

create policy "Owners and managers can update photos"
  on public.shop_photos for update
  to authenticated
  using (private.has_shop_role(shop_id, '{owner,manager}'))
  with check (private.has_shop_role(shop_id, '{owner,manager}'));

create policy "Owners and managers can delete photos"
  on public.shop_photos for delete
  to authenticated
  using (private.has_shop_role(shop_id, '{owner,manager}'));
