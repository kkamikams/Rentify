alter table public.shops
  add column if not exists category_images jsonb not null default '{}'::jsonb;

alter table public.shops enable row level security;

drop policy if exists "Shop members can update their shop" on public.shops;
create policy "Shop members can update their shop"
  on public.shops
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.shop_members
      where shop_members.shop_id = shops.id
        and shop_members.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.shop_members
      where shop_members.shop_id = shops.id
        and shop_members.user_id = auth.uid()
    )
  );

notify pgrst, 'reload schema';
