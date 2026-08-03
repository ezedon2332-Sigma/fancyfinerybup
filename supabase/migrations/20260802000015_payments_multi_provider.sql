-- Fancy Finery — multi-provider payments (Paystack + Stripe).
--
-- Two additions, both additive & idempotent:
--   1. `payment_reference` — a provider-agnostic charge reference. Paystack and
--      Stripe each key their charge to this one column, so the confirm/verify
--      path is identical for both. (`paystack_reference` from the init schema is
--      left in place for back-compat; new charges write `payment_reference`.)
--   2. `payment_events` — an append-only log of every webhook we accept. It is
--      the idempotency ledger (a provider re-sending an event is deduped on
--      `(provider, event_id)`) and the audit trail for disputes.
--
-- Apply in the Supabase SQL editor before activating online payments.

-- 1) Provider-agnostic charge reference -------------------------------------
alter table public.orders
  add column if not exists payment_reference text;

-- Unique so a reference maps to exactly one order. NULLs are allowed and do not
-- collide (Postgres treats NULLs as distinct in a unique index), so orders that
-- never start an online payment are unaffected.
create unique index if not exists orders_payment_reference_key
  on public.orders (payment_reference);

-- 2) Webhook / payment event ledger -----------------------------------------
create table if not exists public.payment_events (
  id          uuid primary key default gen_random_uuid(),
  provider    text not null,                 -- 'paystack' | 'stripe'
  event_id    text,                          -- provider's event id, for dedupe
  event_type  text,                          -- e.g. 'charge.success'
  reference   text,                          -- our payment_reference, when known
  order_id    uuid references public.orders (id) on delete set null,
  raw         jsonb,                          -- full payload, for audit/disputes
  created_at  timestamptz not null default now()
);

-- Idempotency: the same provider event can only be recorded once. Partial index
-- so rows without an event_id (should not happen, but never block the ledger)
-- are still insertable.
create unique index if not exists payment_events_provider_event_id_key
  on public.payment_events (provider, event_id)
  where event_id is not null;

create index if not exists payment_events_reference_idx
  on public.payment_events (reference);
create index if not exists payment_events_order_idx
  on public.payment_events (order_id);

-- RLS: writes only ever happen through the service-role webhook (which bypasses
-- RLS), so there are no insert/update policies. Admins may read for support.
alter table public.payment_events enable row level security;
drop policy if exists payment_events_admin_read on public.payment_events;
create policy payment_events_admin_read on public.payment_events
  for select using (public.is_admin());
