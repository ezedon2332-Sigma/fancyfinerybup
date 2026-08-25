-- Stock accounting.
--
-- Orders now decrement `product_variants.stock_qty` inside the same transaction
-- that writes the order. Cancelling puts it back — but only once. Without a
-- marker, a retried cancellation (a double-click, a webhook redelivery, an
-- admin repeating a customer's action) would credit stock a second time and
-- invent inventory that does not exist.
--
-- Nullable timestamp rather than a boolean: it records WHEN as well as whether,
-- which is what makes a stock discrepancy investigable later.
ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "stock_restored_at" timestamptz;
