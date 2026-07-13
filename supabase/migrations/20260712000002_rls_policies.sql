-- Fancy Finery — Phase 1: Row Level Security
-- Principles:
--   * catalog (categories/products/images/variants): public read of PUBLISHED,
--     admin-only writes.
--   * orders/order_items: a user sees & creates only their own; admins see all;
--     the Paystack webhook uses the secret key (bypasses RLS) to mark paid.
--   * profiles: user reads/updates own; admins read all; role is not
--     self-assignable.

-- Admin check helper. SECURITY DEFINER so it reads profiles without triggering
-- the profiles RLS policies (which would recurse). Locked search_path.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

grant execute on function public.is_admin() to anon, authenticated;

-- Enable RLS -----------------------------------------------------------------
alter table public.profiles         enable row level security;
alter table public.categories       enable row level security;
alter table public.products         enable row level security;
alter table public.product_images   enable row level security;
alter table public.product_variants enable row level security;
alter table public.orders           enable row level security;
alter table public.order_items      enable row level security;

-- profiles -------------------------------------------------------------------
drop policy if exists profiles_select_self_or_admin on public.profiles;
create policy profiles_select_self_or_admin on public.profiles
  for select using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_update_self_or_admin on public.profiles;
create policy profiles_update_self_or_admin on public.profiles
  for update using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- Prevent non-admins from changing their own role (privilege escalation).
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Only admins can change a profile role';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_role on public.profiles;
create trigger profiles_guard_role
  before update on public.profiles
  for each row execute function public.guard_profile_role();

-- categories -----------------------------------------------------------------
drop policy if exists categories_select_all on public.categories;
create policy categories_select_all on public.categories
  for select using (true);

drop policy if exists categories_write_admin on public.categories;
create policy categories_write_admin on public.categories
  for all using (public.is_admin()) with check (public.is_admin());

-- products -------------------------------------------------------------------
drop policy if exists products_select_published_or_admin on public.products;
create policy products_select_published_or_admin on public.products
  for select using (status = 'published' or public.is_admin());

drop policy if exists products_write_admin on public.products;
create policy products_write_admin on public.products
  for all using (public.is_admin()) with check (public.is_admin());

-- product_images -------------------------------------------------------------
drop policy if exists product_images_select on public.product_images;
create policy product_images_select on public.product_images
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.products p
      where p.id = product_images.product_id and p.status = 'published'
    )
  );

drop policy if exists product_images_write_admin on public.product_images;
create policy product_images_write_admin on public.product_images
  for all using (public.is_admin()) with check (public.is_admin());

-- product_variants -----------------------------------------------------------
drop policy if exists product_variants_select on public.product_variants;
create policy product_variants_select on public.product_variants
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.products p
      where p.id = product_variants.product_id and p.status = 'published'
    )
  );

drop policy if exists product_variants_write_admin on public.product_variants;
create policy product_variants_write_admin on public.product_variants
  for all using (public.is_admin()) with check (public.is_admin());

-- orders ---------------------------------------------------------------------
drop policy if exists orders_select_own_or_admin on public.orders;
create policy orders_select_own_or_admin on public.orders
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists orders_insert_own on public.orders;
create policy orders_insert_own on public.orders
  for insert with check (user_id = auth.uid());

drop policy if exists orders_update_admin on public.orders;
create policy orders_update_admin on public.orders
  for update using (public.is_admin()) with check (public.is_admin());

-- order_items ----------------------------------------------------------------
drop policy if exists order_items_select on public.order_items;
create policy order_items_select on public.order_items
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.orders o
      where o.id = order_items.order_id and o.user_id = auth.uid()
    )
  );

drop policy if exists order_items_insert_own on public.order_items;
create policy order_items_insert_own on public.order_items
  for insert with check (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id and o.user_id = auth.uid()
    )
  );
