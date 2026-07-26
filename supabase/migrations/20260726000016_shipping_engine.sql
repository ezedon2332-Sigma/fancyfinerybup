-- Fancy Finery — enterprise shipping engine.
--
-- Replaces flat per-country prices with a zone / country-override / weight-
-- bracket rate table, the model Shopify and the carriers themselves use.
--
-- Resolution order at checkout:
--   1. cart weight  -> weight bracket
--   2. destination  -> country override rate, else its zone's rate
--   3. method       -> the rate row for that method
--
-- The legacy `shipping_countries` table is deliberately left in place and
-- untouched. The engine falls back to it whenever no zone rate is configured,
-- so checkout keeps working from the moment this migration lands and switches
-- over gradually as the admin fills the rate table in.
--
-- Future carrier APIs (DHL, FedEx, UPS, Shippo, EasyPost…) plug in through
-- shipping_methods.rate_source + .carrier_code without touching this schema.
--
-- Additive & safe: nothing here drops or rewrites existing data.

-- 1) Product weight ----------------------------------------------------------
-- Canonical grams so arithmetic never touches floats; weight_unit is only the
-- unit the admin prefers to type and read.
alter table public.products
  add column if not exists weight_grams integer not null default 0
    check (weight_grams >= 0),
  add column if not exists weight_unit text not null default 'g'
    check (weight_unit in ('g', 'kg'));

-- 2) Shipping zones ----------------------------------------------------------
create table if not exists public.shipping_zones (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  name       text not null,
  enabled    boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shipping_zones_enabled_idx
  on public.shipping_zones (enabled, sort_order);

-- 3) Country -> zone assignment ----------------------------------------------
-- A country belongs to at most one zone; the primary key enforces that, which
-- is what keeps rate resolution unambiguous.
create table if not exists public.shipping_zone_countries (
  country_code text primary key,
  zone_id      uuid not null references public.shipping_zones (id) on delete cascade,
  created_at   timestamptz not null default now()
);

create index if not exists shipping_zone_countries_zone_idx
  on public.shipping_zone_countries (zone_id);

-- 4) Shipping methods ---------------------------------------------------------
create table if not exists public.shipping_methods (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique,
  name         text not null,
  description  text,
  -- 'table'   -> priced from shipping_rates below
  -- 'carrier' -> priced by a live carrier API at quote time
  rate_source  text not null default 'table'
    check (rate_source in ('table', 'carrier')),
  -- Adapter key for the carrier integration, e.g. 'dhl', 'fedex', 'shippo'.
  carrier_code text,
  -- Opaque per-carrier configuration (account numbers, service codes…).
  carrier_config jsonb not null default '{}'::jsonb,
  enabled      boolean not null default true,
  sort_order   integer not null default 0,
  min_days     integer not null default 3 check (min_days >= 0),
  max_days     integer not null default 10 check (max_days >= 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint shipping_methods_carrier_needs_code
    check (rate_source <> 'carrier' or carrier_code is not null)
);

create index if not exists shipping_methods_enabled_idx
  on public.shipping_methods (enabled, sort_order);

-- 5) Weight brackets ----------------------------------------------------------
-- One shared ladder. `max_grams is null` is the open-ended top bracket (20kg+).
create table if not exists public.shipping_weight_brackets (
  id         uuid primary key default gen_random_uuid(),
  label      text not null,
  min_grams  integer not null check (min_grams >= 0),
  max_grams  integer check (max_grams is null or max_grams > min_grams),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint shipping_weight_brackets_min_key unique (min_grams)
);

create index if not exists shipping_weight_brackets_order_idx
  on public.shipping_weight_brackets (min_grams);

-- 6) Rates --------------------------------------------------------------------
-- Exactly one of zone_id / country_code is set. A country_code row is the
-- override and always wins over its zone's row for the same method+bracket.
-- Prices are NGN minor units (kobo), matching the rest of the catalogue.
create table if not exists public.shipping_rates (
  id           uuid primary key default gen_random_uuid(),
  zone_id      uuid references public.shipping_zones (id) on delete cascade,
  country_code text,
  method_id    uuid not null references public.shipping_methods (id) on delete cascade,
  bracket_id   uuid not null references public.shipping_weight_brackets (id) on delete cascade,
  price        integer not null default 0 check (price >= 0),
  -- Free over this NGN subtotal; null = no threshold at this scope.
  free_over    integer check (free_over is null or free_over >= 0),
  enabled      boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint shipping_rates_one_scope check (
    (zone_id is not null and country_code is null) or
    (zone_id is null and country_code is not null)
  )
);

-- One rate per scope+method+bracket. Two partial indexes because NULLs do not
-- compare equal in a plain unique constraint, which would let duplicates in.
create unique index if not exists shipping_rates_zone_key
  on public.shipping_rates (zone_id, method_id, bracket_id)
  where zone_id is not null;
create unique index if not exists shipping_rates_country_key
  on public.shipping_rates (country_code, method_id, bracket_id)
  where country_code is not null;

create index if not exists shipping_rates_lookup_zone_idx
  on public.shipping_rates (zone_id, method_id) where enabled;
create index if not exists shipping_rates_lookup_country_idx
  on public.shipping_rates (country_code, method_id) where enabled;

-- 7) Order-level money breakdown ----------------------------------------------
-- Checkout shows subtotal / shipping / tax / discount / grand total, so the
-- order has to persist each line rather than recomputing it later.
alter table public.orders
  add column if not exists tax        integer not null default 0 check (tax >= 0),
  add column if not exists discount   integer not null default 0 check (discount >= 0),
  add column if not exists total_weight_grams integer not null default 0
    check (total_weight_grams >= 0);

-- 8) Tax + discount settings ---------------------------------------------------
-- Basis points (1% = 100) so percentages stay exact in integer maths.
alter table public.shipping_settings
  add column if not exists tax_rate_bps integer not null default 0
    check (tax_rate_bps >= 0 and tax_rate_bps <= 10000),
  add column if not exists tax_label text not null default 'VAT',
  add column if not exists tax_enabled boolean not null default false,
  add column if not exists discount_bps integer not null default 0
    check (discount_bps >= 0 and discount_bps <= 10000),
  add column if not exists discount_label text not null default 'Discount',
  add column if not exists discount_enabled boolean not null default false,
  -- Fallback when a product has no weight recorded, so a mis-configured
  -- catalogue cannot silently quote everything at the 0g bracket.
  add column if not exists default_item_weight_grams integer not null default 500
    check (default_item_weight_grams >= 0);

-- 9) updated_at triggers --------------------------------------------------------
drop trigger if exists shipping_zones_set_updated_at on public.shipping_zones;
create trigger shipping_zones_set_updated_at
  before update on public.shipping_zones
  for each row execute function public.set_updated_at();

drop trigger if exists shipping_methods_set_updated_at on public.shipping_methods;
create trigger shipping_methods_set_updated_at
  before update on public.shipping_methods
  for each row execute function public.set_updated_at();

drop trigger if exists shipping_rates_set_updated_at on public.shipping_rates;
create trigger shipping_rates_set_updated_at
  before update on public.shipping_rates
  for each row execute function public.set_updated_at();

-- 10) RLS: public read (checkout quotes), admin-only writes ----------------------
-- Same posture as the existing shipping_countries table.
do $$
declare t text;
begin
  foreach t in array array[
    'shipping_zones', 'shipping_zone_countries', 'shipping_methods',
    'shipping_weight_brackets', 'shipping_rates'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_public_read', t);
    execute format(
      'create policy %I on public.%I for select using (true)',
      t || '_public_read', t
    );
    execute format('drop policy if exists %I on public.%I', t || '_admin_write', t);
    execute format(
      'create policy %I on public.%I for all using (public.is_admin()) with check (public.is_admin())',
      t || '_admin_write', t
    );
  end loop;
end $$;

-- 11) Seed: the zones, the ladder, and one method ---------------------------------
insert into public.shipping_zones (code, name, sort_order) values
  ('nigeria',       'Nigeria',        10),
  ('west-africa',   'West Africa',    20),
  ('rest-africa',   'Rest of Africa', 30),
  ('united-states', 'United States',  40),
  ('canada',        'Canada',         50),
  ('united-kingdom','United Kingdom', 60),
  ('european-union','European Union', 70),
  ('middle-east',   'Middle East',    80),
  ('asia-pacific',  'Asia-Pacific',   90),
  ('australia',     'Australia',     100),
  ('rest-of-world', 'Rest of World', 110)
on conflict (code) do nothing;

insert into public.shipping_weight_brackets (label, min_grams, max_grams, sort_order) values
  ('0 – 0.5 kg',    0,     500,  10),
  ('0.5 – 1 kg',    500,   1000, 20),
  ('1 – 2 kg',      1000,  2000, 30),
  ('2 – 3 kg',      2000,  3000, 40),
  ('3 – 5 kg',      3000,  5000, 50),
  ('5 – 10 kg',     5000,  10000, 60),
  ('10 – 20 kg',    10000, 20000, 70),
  ('20 kg +',       20000, null,  80)
on conflict (min_grams) do nothing;

insert into public.shipping_methods (code, name, description, min_days, max_days, sort_order)
values ('ups-express', 'UPS Express', 'Express worldwide delivery by UPS.', 1, 4, 10)
on conflict (code) do nothing;

-- Country assignments for the seeded zones. Everything not listed falls to
-- Rest of World at quote time, so no country is left unshippable.
insert into public.shipping_zone_countries (country_code, zone_id)
select c.code, z.id
from (values
  ('NG','nigeria'),
  ('BJ','west-africa'),('BF','west-africa'),('CV','west-africa'),('CI','west-africa'),
  ('GM','west-africa'),('GH','west-africa'),('GN','west-africa'),('GW','west-africa'),
  ('LR','west-africa'),('ML','west-africa'),('MR','west-africa'),('NE','west-africa'),
  ('SN','west-africa'),('SL','west-africa'),('TG','west-africa'),
  ('ZA','rest-africa'),('KE','rest-africa'),('EG','rest-africa'),('MA','rest-africa'),
  ('TZ','rest-africa'),('UG','rest-africa'),('RW','rest-africa'),('ET','rest-africa'),
  ('CM','rest-africa'),('AO','rest-africa'),('ZM','rest-africa'),('ZW','rest-africa'),
  ('BW','rest-africa'),('NA','rest-africa'),('MZ','rest-africa'),('DZ','rest-africa'),
  ('TN','rest-africa'),
  ('US','united-states'),
  ('CA','canada'),
  ('GB','united-kingdom'),
  ('AT','european-union'),('BE','european-union'),('BG','european-union'),
  ('HR','european-union'),('CY','european-union'),('CZ','european-union'),
  ('DK','european-union'),('EE','european-union'),('FI','european-union'),
  ('FR','european-union'),('DE','european-union'),('GR','european-union'),
  ('HU','european-union'),('IE','european-union'),('IT','european-union'),
  ('LV','european-union'),('LT','european-union'),('LU','european-union'),
  ('MT','european-union'),('NL','european-union'),('PL','european-union'),
  ('PT','european-union'),('RO','european-union'),('SK','european-union'),
  ('SI','european-union'),('ES','european-union'),('SE','european-union'),
  ('AE','middle-east'),('SA','middle-east'),('QA','middle-east'),('KW','middle-east'),
  ('BH','middle-east'),('OM','middle-east'),('JO','middle-east'),('LB','middle-east'),
  ('IL','middle-east'),('TR','middle-east'),
  ('CN','asia-pacific'),('JP','asia-pacific'),('KR','asia-pacific'),('IN','asia-pacific'),
  ('SG','asia-pacific'),('MY','asia-pacific'),('TH','asia-pacific'),('ID','asia-pacific'),
  ('PH','asia-pacific'),('VN','asia-pacific'),('HK','asia-pacific'),('TW','asia-pacific'),
  ('NZ','asia-pacific'),
  ('AU','australia')
) as c(code, zone_code)
join public.shipping_zones z on z.code = c.zone_code
on conflict (country_code) do nothing;
