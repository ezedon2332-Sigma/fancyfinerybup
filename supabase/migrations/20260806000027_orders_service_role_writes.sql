-- Fancy Finery — security: order creation is server-side only.
--
-- The previous INSERT policies allowed a signed-in customer to write any row to
-- `orders`/`order_items` as long as `user_id = auth.uid()` — with no guard on
-- `total`, `unit_price`, or `payment_status`. Since the browser holds the
-- publishable key + the user's JWT, a customer could POST directly to PostgREST
-- and forge a cheap/paid order, bypassing all server-side pricing.
--
-- Orders are now created exclusively by the server (the `placeOrder` use-case,
-- which recomputes every figure from the catalogue) using the service-role
-- client, so these permissive INSERT policies are removed. With no INSERT policy
-- present, RLS denies inserts from anon/authenticated; only the service role
-- (which bypasses RLS) can write. SELECT (own/admin) and UPDATE (admin) are
-- unchanged, so customers still read their own orders exactly as before.

drop policy if exists orders_insert_own on public.orders;
drop policy if exists order_items_insert_own on public.order_items;
