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
