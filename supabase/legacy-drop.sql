-- Fancy Finery — decommission the legacy `Products` TABLE.
-- RUN THIS ONLY AFTER `node scripts/seed.mjs` has migrated the rows and
-- re-uploaded their images into the `product-images` bucket.
--
-- The legacy `Products` STORAGE BUCKET can't be removed via SQL (a storage
-- trigger blocks it) — delete it with the Storage API instead:
--   node scripts/drop-legacy-bucket.mjs
--
-- NOT part of a fresh setup (excluded from apply_all.sql).

drop table if exists public."Products";
