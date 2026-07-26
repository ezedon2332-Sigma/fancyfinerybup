-- Fancy Finery — remove the shipping module.
--
-- Drops the rate engine and the legacy per-country table. Checkout no longer
-- prices delivery at all: every order is placed with a zero shipping cost.
--
-- WHAT SURVIVES, AND WHY
--
--   shipping_settings  KEPT. Despite the name this row is where the live
--                      exchange rate lives (`ngn_per_usd`, `rate_updated_at`,
--                      the display rates). The FX service, the rate ticker,
--                      the currency selector and the hourly cron all read and
--                      write it. Dropping it would take the currency system
--                      down with the shipping module.
--
--   orders.shipping_*  KEPT. Historical orders must keep the address and the
--                      cost they were actually charged. New orders simply
--                      write shipping_cost = 0 and shipping_method = null.
--
--   products.weight_grams  KEPT. Weight is a product attribute, still edited
--                      in the admin, and any future rate engine will want it.
--
-- Order matters: rates reference zones, methods and brackets, so it goes first.

drop table if exists public.shipping_rates cascade;
drop table if exists public.shipping_zone_countries cascade;
drop table if exists public.shipping_weight_brackets cascade;
drop table if exists public.shipping_methods cascade;
drop table if exists public.shipping_zones cascade;
drop table if exists public.shipping_countries cascade;

-- shipping_method on orders was constrained to the legacy codes; new orders
-- store null, so the constraint has to go or every insert fails.
alter table public.orders
  drop constraint if exists orders_shipping_method_check;
