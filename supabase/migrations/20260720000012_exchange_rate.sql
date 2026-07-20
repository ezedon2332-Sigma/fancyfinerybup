-- Fancy Finery — live exchange-rate management.
-- Extends shipping_settings (the single source of the NGN/USD rate) with the
-- fields needed for live rates: auto/manual mode, source, and last-updated.
-- ngn_per_usd remains the EFFECTIVE integer rate used by shipping + display;
-- auto mode keeps it fresh from a live API, manual mode pins it. Idempotent.

alter table public.shipping_settings
  add column if not exists rate_mode       text not null default 'auto',
  add column if not exists rate_source     text,
  add column if not exists rate_updated_at timestamptz;

alter table public.shipping_settings
  drop constraint if exists shipping_settings_rate_mode_check;
alter table public.shipping_settings
  add constraint shipping_settings_rate_mode_check
  check (rate_mode in ('auto', 'manual'));

-- RLS already exists on shipping_settings (public read, admin write); the live
-- refresh writes with the service-role key, so it isn't gated by is_admin().
