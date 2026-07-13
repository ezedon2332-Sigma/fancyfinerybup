-- Fancy Finery — decommission the legacy `Products` table + bucket.
-- RUN THIS ONLY AFTER `node scripts/seed.mjs` has migrated the rows and
-- re-uploaded their images into the `product-images` bucket. Otherwise the
-- 2 legacy products lose their source data.
--
-- NOT included in apply_all.sql — this is a one-time cleanup, not part of a
-- fresh setup.

-- Remove legacy storage objects then the bucket.
delete from storage.objects where bucket_id = 'Products';
delete from storage.buckets where id = 'Products';

-- Drop the old table (capital P).
drop table if exists public."Products";
