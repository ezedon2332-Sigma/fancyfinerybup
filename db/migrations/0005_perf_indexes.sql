-- Indexes for query shapes introduced by this migration.
--
-- `order_items.product_id` had no index: nothing used to filter or group by it.
-- The sales-backed Best Sellers and Trending rows (src/infrastructure/db/
-- sales-service.ts) group every order line by product, and the product-review
-- "verified purchase" check looks up lines by product for one customer. Both
-- scan the whole table without this.
CREATE INDEX IF NOT EXISTS "order_items_product_idx"
  ON "order_items" ("product_id");

-- Sales rankings only ever count settled orders. A partial index keeps it small
-- (cancelled and unpaid rows are excluded) and matches the predicate exactly.
CREATE INDEX IF NOT EXISTS "orders_settled_idx"
  ON "orders" ("created_at" DESC)
  WHERE "payment_status" = 'paid' AND "status" <> 'cancelled';
