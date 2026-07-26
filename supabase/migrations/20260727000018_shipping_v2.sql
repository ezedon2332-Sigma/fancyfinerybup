-- Fancy Finery — one authoritative shipping, tax and discount schema.
--
-- REUSES the existing tables rather than recreating them, so nothing is lost:
--   shipping_zones            11 rows  kept as-is
--   shipping_zone_countries   87 rows  kept as-is
--   shipping_methods           1 row   kept, becomes the courier record
--   shipping_weight_brackets   8 rows  kept, extended to 20 kg+
--   shipping_rates            80 rows  kept, extended to the new brackets
--   shipping_settings          1 row   kept — this is the LIVE EXCHANGE RATE
--   shipping_countries       249 rows  kept for the enable/disable flags only;
--                                      its legacy standard_/express_ price
--                                      columns are no longer read by anything
--
-- ADDS what the premium system needs and the old one never had:
--   tax_rules            destination-based tax, replacing one global rate
--   discount_codes       coupons, campaigns, free-shipping promos
--   discount_redemptions usage audit, so limits can actually be enforced
--
-- The single pricing identity, implemented once in domain/shipping/pricing.ts:
--   Grand Total = Subtotal + Shipping + Tax − Discount
--
-- All money is NGN minor units (kobo) at rest; conversion to the order
-- currency happens once, at the edge.

-- 1) Extend the weight ladder to 20 kg+ ---------------------------------------
-- 1 kg bands from 5 kg, then one open-ended band so a heavy parcel always
-- prices rather than silently failing to quote.
insert into public.shipping_weight_brackets (label, min_grams, max_grams, sort_order)
select format('%s – %s kg', w.kg, w.kg + 1), w.kg * 1000, (w.kg + 1) * 1000, 100 + w.kg
from generate_series(5, 19) as w(kg)
where not exists (
  select 1 from public.shipping_weight_brackets b where b.min_grams = w.kg * 1000
);

insert into public.shipping_weight_brackets (label, min_grams, max_grams, sort_order)
select '20 kg +', 20000, null, 200
where not exists (
  select 1 from public.shipping_weight_brackets b where b.min_grams = 20000
);

-- 2) Price the new bands from each country's own progression -------------------
-- base = the published 4–5 kg price, per_kg = the rate its existing bands imply.
-- Bounded bands price at their upper edge; the open-ended band takes one more
-- step. Only fills gaps, so re-running never overwrites an admin's edits.
with card(country_code, base_naira, per_kg_naira) as (
  values
    ('AU', 201000, 24000), ('FI', 160000, 20000), ('MX', 171000, 23000),
    ('ZW', 194000, 25000), ('ZA', 147000, 19000), ('US', 173000, 22000),
    ('CA', 173000, 22000), ('GB', 150000, 19000), ('NL', 157000, 20000),
    ('FR', 158000, 20000)
),
ups as (select id from public.shipping_methods where code = 'ups-express'),
target as (
  select
    c.country_code,
    b.id as bracket_id,
    (c.base_naira + c.per_kg_naira * (
      coalesce(b.max_grams / 1000, (b.min_grams / 1000) + 1) - 5
    )) * 100 as price_kobo
  from card c
  cross join public.shipping_weight_brackets b
  where b.min_grams >= 5000
)
insert into public.shipping_rates (country_code, method_id, bracket_id, price, enabled)
select t.country_code, u.id, t.bracket_id, t.price_kobo, true
from target t cross join ups u
where not exists (
  select 1 from public.shipping_rates r
  where r.country_code = t.country_code and r.bracket_id = t.bracket_id
);

-- 3) Couriers ------------------------------------------------------------------
-- shipping_methods already carries carrier_code/min_days/max_days, so it is the
-- courier record. Only presentation fields are missing.
alter table public.shipping_methods
  add column if not exists display_name text,
  add column if not exists tracking_url_template text;

update public.shipping_methods
   set display_name = coalesce(display_name, 'UPS'),
       carrier_code = coalesce(carrier_code, 'ups'),
       tracking_url_template = coalesce(
         tracking_url_template,
         'https://www.ups.com/track?tracknum={tracking}'
       )
 where code = 'ups-express';

-- 4) Destination-based tax ------------------------------------------------------
-- One row per destination, most specific wins: country beats zone beats global.
-- Absence of a matching enabled rule means "No Tax", which the UI states
-- explicitly rather than hiding the line.
create table if not exists public.tax_rules (
  id           uuid primary key default gen_random_uuid(),
  scope        text not null check (scope in ('global', 'zone', 'country')),
  country_code text,
  zone_id      uuid references public.shipping_zones (id) on delete cascade,
  rate_bps     integer not null default 0 check (rate_bps between 0 and 10000),
  label        text not null default 'VAT',
  -- Whether the rate applies to shipping as well as goods; jurisdictions differ.
  applies_to_shipping boolean not null default false,
  enabled      boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- A scope must carry exactly the key it claims.
  constraint tax_rules_scope_key check (
    (scope = 'global'  and country_code is null and zone_id is null) or
    (scope = 'zone'    and country_code is null and zone_id is not null) or
    (scope = 'country' and country_code is not null and zone_id is null)
  )
);

create unique index if not exists tax_rules_country_key
  on public.tax_rules (country_code) where scope = 'country';
create unique index if not exists tax_rules_zone_key
  on public.tax_rules (zone_id) where scope = 'zone';
create unique index if not exists tax_rules_global_key
  on public.tax_rules ((true)) where scope = 'global';
create index if not exists tax_rules_enabled_idx on public.tax_rules (enabled);

-- Carry the old single global rate over so behaviour is unchanged on day one.
insert into public.tax_rules (scope, rate_bps, label, enabled)
select 'global', s.tax_rate_bps, coalesce(s.tax_label, 'VAT'), s.tax_enabled
from public.shipping_settings s
where not exists (select 1 from public.tax_rules where scope = 'global');

-- 5) Discounts -------------------------------------------------------------------
create table if not exists public.discount_codes (
  id               uuid primary key default gen_random_uuid(),
  code             text not null,
  description      text,
  campaign         text,
  kind             text not null
    check (kind in ('percent', 'fixed', 'free_shipping')),
  -- percent -> basis points; fixed -> NGN kobo; free_shipping -> neither.
  percent_bps      integer check (percent_bps between 0 and 10000),
  amount_kobo      integer check (amount_kobo >= 0),
  min_subtotal_kobo integer not null default 0 check (min_subtotal_kobo >= 0),
  -- Caps a percentage discount so "50% off" cannot run away on a large bag.
  max_discount_kobo integer check (max_discount_kobo >= 0),
  first_time_only  boolean not null default false,
  starts_at        timestamptz,
  ends_at          timestamptz,
  usage_limit      integer check (usage_limit is null or usage_limit > 0),
  used_count       integer not null default 0 check (used_count >= 0),
  per_customer_limit integer check (per_customer_limit is null or per_customer_limit > 0),
  enabled          boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- The value column has to match the kind, or the engine cannot price it.
  constraint discount_codes_value_matches_kind check (
    (kind = 'percent'       and percent_bps is not null) or
    (kind = 'fixed'         and amount_kobo is not null) or
    (kind = 'free_shipping')
  )
);

-- Codes are compared case-insensitively: "BLACKFRIDAY" and "BlackFriday" are one.
create unique index if not exists discount_codes_code_key
  on public.discount_codes (upper(code));
create index if not exists discount_codes_enabled_idx
  on public.discount_codes (enabled, starts_at, ends_at);
create index if not exists discount_codes_campaign_idx
  on public.discount_codes (campaign);

create table if not exists public.discount_redemptions (
  id         uuid primary key default gen_random_uuid(),
  code_id    uuid not null references public.discount_codes (id) on delete cascade,
  order_id   uuid references public.orders (id) on delete set null,
  user_id    uuid references public.profiles (id) on delete set null,
  amount_kobo integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists discount_redemptions_code_idx
  on public.discount_redemptions (code_id, created_at desc);
create index if not exists discount_redemptions_user_idx
  on public.discount_redemptions (user_id);
-- Enforces per_customer_limit = 1 and makes "first order only" checkable.
create unique index if not exists discount_redemptions_once_per_order
  on public.discount_redemptions (code_id, order_id)
  where order_id is not null;

-- Keep used_count honest without a round trip from the application.
create or replace function public.bump_discount_usage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.discount_codes
     set used_count = used_count + 1, updated_at = now()
   where id = new.code_id;
  return new;
end;
$$;

drop trigger if exists discount_redemptions_bump on public.discount_redemptions;
create trigger discount_redemptions_bump
  after insert on public.discount_redemptions
  for each row execute function public.bump_discount_usage();

drop trigger if exists tax_rules_set_updated_at on public.tax_rules;
create trigger tax_rules_set_updated_at
  before update on public.tax_rules
  for each row execute function public.set_updated_at();

drop trigger if exists discount_codes_set_updated_at on public.discount_codes;
create trigger discount_codes_set_updated_at
  before update on public.discount_codes
  for each row execute function public.set_updated_at();

-- 6) Orders carry the applied discount so history stays explainable -------------
alter table public.orders
  add column if not exists discount_code text,
  add column if not exists tax_label text,
  add column if not exists courier_name text,
  add column if not exists estimated_min_days integer,
  add column if not exists estimated_max_days integer;

-- New orders may have no method selected; the legacy check would reject null.
alter table public.orders drop constraint if exists orders_shipping_method_check;

-- 7) RLS ---------------------------------------------------------------------------
-- Rates, zones and brackets are public reference data the rates page reads.
-- Discounts and redemptions are not: a readable coupon table is a giveaway.
alter table public.tax_rules            enable row level security;
alter table public.discount_codes       enable row level security;
alter table public.discount_redemptions enable row level security;

drop policy if exists "tax rules readable" on public.tax_rules;
create policy "tax rules readable" on public.tax_rules for select using (true);
-- No policies on discount_codes or discount_redemptions: server-role only.
