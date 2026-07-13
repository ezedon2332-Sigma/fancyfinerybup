-- Fancy Finery — combined Phase 1 apply script (schema + seed).
-- Paste into the Supabase SQL Editor and Run. Safe to re-run.
-- Excludes the legacy-drop migration (that's a one-time cleanup).


-- ============================================================
-- supabase/migrations/20260712000001_init_schema.sql
-- ============================================================
-- Fancy Finery — Phase 1: core schema
-- Single-brand clothing store: catalog, media, variants, orders.
-- Money is stored as INTEGER minor units (kobo). Idempotent where practical.

-- Extensions -----------------------------------------------------------------
create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- Enums ----------------------------------------------------------------------
do $$ begin
  create type public.user_role as enum ('customer', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.product_status as enum ('draft', 'published', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.order_status as enum ('pending', 'paid', 'fulfilled', 'cancelled');
exception when duplicate_object then null; end $$;

-- updated_at helper ----------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- profiles (1:1 with auth.users) ---------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text,
  avatar_url text,
  role       public.user_role not null default 'customer',
  created_at timestamptz not null default now()
);

-- categories -----------------------------------------------------------------
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  description text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

-- products -------------------------------------------------------------------
create table if not exists public.products (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  description text,
  price       integer not null check (price >= 0), -- minor units (kobo)
  currency    text not null default 'NGN',
  category_id uuid references public.categories (id) on delete set null,
  status      public.product_status not null default 'draft',
  featured    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists products_status_idx   on public.products (status);
create index if not exists products_category_idx on public.products (category_id);
create index if not exists products_featured_idx on public.products (featured) where featured;

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- product_images -------------------------------------------------------------
create table if not exists public.product_images (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references public.products (id) on delete cascade,
  storage_path text not null,
  alt          text,
  sort_order   integer not null default 0
);

create index if not exists product_images_product_idx on public.product_images (product_id);

-- product_variants (size/color inventory) ------------------------------------
create table if not exists public.product_variants (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  size       text,
  color      text,
  sku        text unique,
  stock_qty  integer not null default 0 check (stock_qty >= 0)
);

create index if not exists product_variants_product_idx on public.product_variants (product_id);

-- orders ---------------------------------------------------------------------
create table if not exists public.orders (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.profiles (id) on delete restrict,
  status             public.order_status not null default 'pending',
  total              integer not null check (total >= 0), -- minor units
  currency           text not null default 'NGN',
  paystack_reference text unique,
  shipping_name      text,
  shipping_email     text,
  shipping_phone     text,
  shipping_address   text,
  shipping_city      text,
  shipping_state     text,
  shipping_country   text,
  created_at         timestamptz not null default now()
);

create index if not exists orders_user_idx   on public.orders (user_id);
create index if not exists orders_status_idx on public.orders (status);

-- order_items ----------------------------------------------------------------
create table if not exists public.order_items (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders (id) on delete cascade,
  product_id    uuid references public.products (id) on delete set null,
  variant_id    uuid references public.product_variants (id) on delete set null,
  name_snapshot text not null,
  unit_price    integer not null check (unit_price >= 0), -- minor units at purchase
  qty           integer not null check (qty > 0)
);

create index if not exists order_items_order_idx on public.order_items (order_id);


-- ============================================================
-- supabase/migrations/20260712000002_rls_policies.sql
-- ============================================================
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


-- ============================================================
-- supabase/migrations/20260712000003_profiles_trigger.sql
-- ============================================================
-- Fancy Finery — Phase 1: auto-provision a profile row on signup.
-- Runs as SECURITY DEFINER so it can insert into public.profiles regardless of
-- RLS. Pulls display name / avatar from OAuth metadata when present (Google).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ============================================================
-- supabase/migrations/20260712000004_storage.sql
-- ============================================================
-- Fancy Finery — Phase 1: product image storage.
-- Public-read bucket (product photos are public); writes are admin-only.

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- Public read of objects in the product-images bucket.
drop policy if exists product_images_public_read on storage.objects;
create policy product_images_public_read on storage.objects
  for select using (bucket_id = 'product-images');

-- Admin-only write (insert/update/delete) in the product-images bucket.
drop policy if exists product_images_admin_insert on storage.objects;
create policy product_images_admin_insert on storage.objects
  for insert with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists product_images_admin_update on storage.objects;
create policy product_images_admin_update on storage.objects
  for update using (bucket_id = 'product-images' and public.is_admin())
  with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists product_images_admin_delete on storage.objects;
create policy product_images_admin_delete on storage.objects
  for delete using (bucket_id = 'product-images' and public.is_admin());


-- ============================================================
-- supabase/seed.sql
-- ============================================================
-- Fancy Finery — Phase 1 seed data (safe to re-run).
-- Image `storage_path` values point at existing files in /public for now; once
-- real uploads land in the `product-images` bucket, replace them with bucket
-- paths. The Phase 2 image resolver handles both.

-- Categories -----------------------------------------------------------------
insert into public.categories (name, slug, description, sort_order) values
  ('Dresses',     'dresses',     'Refined day-to-evening dresses.',        1),
  ('Outerwear',   'outerwear',   'Statement coats and tailored jackets.',  2),
  ('Tops',        'tops',        'Blouses, shirts and knitwear.',          3),
  ('Accessories', 'accessories', 'Finishing touches for every look.',      4)
on conflict (slug) do nothing;

-- Products -------------------------------------------------------------------
insert into public.products (name, slug, description, price, currency, category_id, status, featured)
values
  ('Golden Hour Gown', 'golden-hour-gown',
   'A floor-length silk gown with a subtle gold sheen. Made for the spotlight.',
   45000000, 'NGN', (select id from public.categories where slug = 'dresses'), 'published', true),
  ('Midnight Tailored Coat', 'midnight-tailored-coat',
   'Structured wool-blend coat in deep black with a sharp lapel.',
   38000000, 'NGN', (select id from public.categories where slug = 'outerwear'), 'published', true),
  ('Ivory Silk Blouse', 'ivory-silk-blouse',
   'An effortless ivory blouse in pure silk. Understated luxury.',
   15000000, 'NGN', (select id from public.categories where slug = 'tops'), 'published', false),
  ('Amber Evening Dress', 'amber-evening-dress',
   'Fitted amber cocktail dress with a draped neckline.',
   29000000, 'NGN', (select id from public.categories where slug = 'dresses'), 'published', true),
  ('Noir Wrap Dress', 'noir-wrap-dress',
   'A timeless black wrap dress that moves with you.',
   22000000, 'NGN', (select id from public.categories where slug = 'dresses'), 'published', false),
  ('Draft — Spring Trench', 'draft-spring-trench',
   'Lightweight trench (not yet released — used to test draft visibility).',
   34000000, 'NGN', (select id from public.categories where slug = 'outerwear'), 'draft', false)
on conflict (slug) do nothing;

-- Product images -------------------------------------------------------------
insert into public.product_images (product_id, storage_path, alt, sort_order)
select p.id, v.storage_path, v.alt, v.sort_order
from (values
  ('golden-hour-gown',        'women.jpg',    'Golden Hour Gown',        0),
  ('midnight-tailored-coat',  'women2.jpeg',  'Midnight Tailored Coat',  0),
  ('ivory-silk-blouse',       'women3.jpeg',  'Ivory Silk Blouse',       0),
  ('amber-evening-dress',     'women4.jpeg',  'Amber Evening Dress',     0),
  ('noir-wrap-dress',         'women5.jpeg',  'Noir Wrap Dress',         0),
  ('draft-spring-trench',     'women6.jpeg',  'Spring Trench',           0)
) as v(slug, storage_path, alt, sort_order)
join public.products p on p.slug = v.slug
where not exists (
  select 1 from public.product_images pi where pi.product_id = p.id
);

-- Product variants (sizes) ---------------------------------------------------
insert into public.product_variants (product_id, size, color, sku, stock_qty)
select p.id, v.size, v.color, v.sku, v.stock_qty
from (values
  ('golden-hour-gown',       'S',  'Gold',  'FF-GHG-S',  5),
  ('golden-hour-gown',       'M',  'Gold',  'FF-GHG-M',  4),
  ('golden-hour-gown',       'L',  'Gold',  'FF-GHG-L',  2),
  ('midnight-tailored-coat', 'S',  'Black', 'FF-MTC-S',  3),
  ('midnight-tailored-coat', 'M',  'Black', 'FF-MTC-M',  6),
  ('ivory-silk-blouse',      'S',  'Ivory', 'FF-ISB-S',  8),
  ('ivory-silk-blouse',      'M',  'Ivory', 'FF-ISB-M',  8),
  ('amber-evening-dress',    'M',  'Amber', 'FF-AED-M',  4),
  ('amber-evening-dress',    'L',  'Amber', 'FF-AED-L',  3),
  ('noir-wrap-dress',        'S',  'Black', 'FF-NWD-S',  7),
  ('noir-wrap-dress',        'M',  'Black', 'FF-NWD-M',  5)
) as v(slug, size, color, sku, stock_qty)
join public.products p on p.slug = v.slug
on conflict (sku) do nothing;

