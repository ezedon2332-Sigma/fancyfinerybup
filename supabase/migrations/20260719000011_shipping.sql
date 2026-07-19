-- Fancy Finery — worldwide shipping schema.
-- Adds per-country shipping config, global settings, order shipping fields,
-- tracking, and remaps existing orders onto the new status lifecycle.
-- Safe to re-run (idempotent).

-- 1) Global settings (single row): exchange rate for international (USD) orders.
create table if not exists public.shipping_settings (
  id          boolean primary key default true check (id),
  ngn_per_usd integer not null default 1600 check (ngn_per_usd > 0),
  updated_at  timestamptz not null default now()
);
insert into public.shipping_settings (id) values (true) on conflict (id) do nothing;

-- 2) Per-country shipping configuration. Prices are NGN minor units (kobo).
create table if not exists public.shipping_countries (
  code              text primary key,               -- ISO 3166-1 alpha-2
  name              text not null,
  zone              text not null,
  enabled           boolean not null default true,
  standard_price    integer not null default 0 check (standard_price >= 0),
  standard_min_days integer not null default 3 check (standard_min_days >= 0),
  standard_max_days integer not null default 10 check (standard_max_days >= 0),
  express_price     integer check (express_price is null or express_price >= 0),
  express_min_days  integer not null default 1 check (express_min_days >= 0),
  express_max_days  integer not null default 4 check (express_max_days >= 0),
  free_over         integer check (free_over is null or free_over >= 0),
  updated_at        timestamptz not null default now()
);
create index if not exists shipping_countries_zone_idx
  on public.shipping_countries (zone);
create index if not exists shipping_countries_enabled_idx
  on public.shipping_countries (enabled);

-- 3) Order shipping fields (denormalised, like the existing shipping_* columns).
alter table public.orders
  add column if not exists subtotal              integer not null default 0 check (subtotal >= 0),
  add column if not exists shipping_cost         integer not null default 0 check (shipping_cost >= 0),
  add column if not exists shipping_method       text,
  add column if not exists shipping_country_code text,
  add column if not exists shipping_postal       text,
  add column if not exists shipping_apartment    text,
  add column if not exists tracking_number       text,
  add column if not exists updated_at            timestamptz not null default now();

-- Backfill: existing orders had no separate subtotal/shipping — subtotal = total.
update public.orders set subtotal = total where subtotal = 0 and total > 0;

-- Every tracking number is unique (only enforced on non-null values).
create unique index if not exists orders_tracking_number_key
  on public.orders (tracking_number) where tracking_number is not null;

-- 4) Remap legacy statuses onto the shipping lifecycle (values added in prior migration).
update public.orders set status = 'processing' where status = 'pending';
update public.orders set status = 'processing' where status = 'paid';
update public.orders set status = 'delivered'  where status = 'fulfilled';
-- 'cancelled' is unchanged.

-- New orders default to 'processing'.
alter table public.orders alter column status set default 'processing';

-- 5) Keep updated_at fresh (reuse the shared trigger fn from init_schema).
drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

drop trigger if exists shipping_countries_set_updated_at on public.shipping_countries;
create trigger shipping_countries_set_updated_at
  before update on public.shipping_countries
  for each row execute function public.set_updated_at();

drop trigger if exists shipping_settings_set_updated_at on public.shipping_settings;
create trigger shipping_settings_set_updated_at
  before update on public.shipping_settings
  for each row execute function public.set_updated_at();

-- 6) Row Level Security: public read (checkout needs rates), admin-only writes.
alter table public.shipping_countries enable row level security;
drop policy if exists shipping_countries_public_read on public.shipping_countries;
create policy shipping_countries_public_read on public.shipping_countries
  for select using (true);
drop policy if exists shipping_countries_admin_write on public.shipping_countries;
create policy shipping_countries_admin_write on public.shipping_countries
  for all using (public.is_admin()) with check (public.is_admin());

alter table public.shipping_settings enable row level security;
drop policy if exists shipping_settings_public_read on public.shipping_settings;
create policy shipping_settings_public_read on public.shipping_settings
  for select using (true);
drop policy if exists shipping_settings_admin_write on public.shipping_settings;
create policy shipping_settings_admin_write on public.shipping_settings
  for all using (public.is_admin()) with check (public.is_admin());
