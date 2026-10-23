-- Security fix: require shop to be approved (is_active = true) before uploads are allowed.

-- Drop old insert policy and re-create with approval check.
drop policy "Owners and managers can upload their shop photos" on storage.objects;

create policy "Owners and managers can upload their shop photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'shop-photos'
    and private.has_shop_role(private.shop_id_from_path(name), '{owner,manager}')
    and exists (select 1 from public.shops s where s.id = private.shop_id_from_path(name) and s.is_active)
  );

-- Drop old update policy and re-create with approval check.
drop policy "Owners and managers can replace their shop photos" on storage.objects;

create policy "Owners and managers can replace their shop photos"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'shop-photos'
    and private.has_shop_role(private.shop_id_from_path(name), '{owner,manager}')
    and exists (select 1 from public.shops s where s.id = private.shop_id_from_path(name) and s.is_active)
  )
  with check (
    bucket_id = 'shop-photos'
    and private.has_shop_role(private.shop_id_from_path(name), '{owner,manager}')
    and exists (select 1 from public.shops s where s.id = private.shop_id_from_path(name) and s.is_active)
  );
