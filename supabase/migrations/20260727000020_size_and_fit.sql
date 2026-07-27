-- Fancy Finery — size & fit attributes on products.
--
-- Fit type and the model's stats are per-product editorial facts, so they live
-- on the product rather than in a shared chart. The chart itself is derived
-- from the category (men / women / children) in src/domain/sizing.ts; storing
-- charts per product would duplicate the same nine rows across the catalogue.

alter table public.products
  add column if not exists fit_type text not null default 'regular'
    check (fit_type in ('slim', 'regular', 'relaxed', 'oversized')),
  -- The model shown in the photography, for the "model is X, wearing Y" note.
  -- Nullable together: a partial set renders nothing rather than half a claim.
  add column if not exists model_height_cm integer
    check (model_height_cm is null or (model_height_cm between 100 and 250)),
  add column if not exists model_weight_kg integer
    check (model_weight_kg is null or (model_weight_kg between 25 and 250)),
  add column if not exists model_size text;

create index if not exists products_fit_type_idx on public.products (fit_type);
