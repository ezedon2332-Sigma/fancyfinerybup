-- Fancy Finery — make webhook idempotency survive a failed handler.
--
-- The ledger deduped on `(provider, event_id)` alone, which meant an event was
-- treated as "handled" the instant it was *recorded* — before the work was done.
-- If the handler then failed (provider verify timing out, a database blip, the
-- function hitting its wall clock), the provider's retry hit the existing row,
-- was deduped away, and the charge was never settled. Dedupe-before-work makes
-- retries safe by making them useless.
--
-- `processed_at` splits the two states apart:
--   * row absent            → first delivery, process it
--   * row present, NULL     → a previous attempt died mid-flight, process again
--   * row present, timestamp→ genuinely handled, safe to skip
--
-- Reprocessing stays safe regardless: orders only ever flip to paid through a
-- conditional update that requires the row to still be unpaid/failed, so the
-- database decides the single winner (see markOrderPaid in
-- src/infrastructure/payments/confirm.ts).
--
-- Additive and idempotent. Apply in the Supabase SQL editor.

alter table public.payment_events
  add column if not exists processed_at timestamptz;

-- Existing rows predate the column. They were recorded by the old code, which
-- only ever recorded an event it was about to handle, so backfill them as
-- handled rather than leaving them to be replayed on the next delivery.
update public.payment_events
  set processed_at = created_at
  where processed_at is null;

-- Lets the sweep for stuck events stay cheap as the ledger grows.
create index if not exists payment_events_unprocessed_idx
  on public.payment_events (created_at)
  where processed_at is null;
