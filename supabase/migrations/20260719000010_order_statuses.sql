-- Fancy Finery — shipping order-status lifecycle.
-- Adds the shipping fulfilment states to the order_status enum.
-- NOTE: kept in its OWN migration/transaction. Postgres forbids using a newly
-- added enum value in the same transaction that adds it, so the data remap that
-- consumes these values lives in the next migration (…_shipping.sql).

alter type public.order_status add value if not exists 'processing';
alter type public.order_status add value if not exists 'packed';
alter type public.order_status add value if not exists 'shipped';
alter type public.order_status add value if not exists 'out_for_delivery';
alter type public.order_status add value if not exists 'delivered';
