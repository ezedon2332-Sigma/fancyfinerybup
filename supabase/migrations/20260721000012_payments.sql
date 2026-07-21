-- Fancy Finery — payments.
-- Tracks payment state separately from the fulfilment lifecycle (status).
-- Additive & safe: existing orders default to 'unpaid' (pay-on-delivery).
-- Apply when activating online payments. `paystack_reference` already exists.

alter table public.orders
  add column if not exists payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'paid', 'failed', 'refunded')),
  add column if not exists payment_provider text,
  add column if not exists paid_at timestamptz;

create index if not exists orders_payment_status_idx
  on public.orders (payment_status);
